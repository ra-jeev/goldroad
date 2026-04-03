<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { buildInitialTileStates } from './utils/boardUtils'
import { buildEdgeMap, getActiveNeighbors, getEdgeType, getNeighborId, parseTileIndex } from '../shared/utils/puzzleEngine'
import { calcOutcomeTier } from '../shared/utils/tiers'
import type { Direction } from '../shared/types/game'

type GamePayload = Awaited<ReturnType<ReturnType<typeof useGamesApi>['getCurrentGame']>>

const gamesApi = useGamesApi()
const sessionApi = useSessionApi()

const game = ref<GamePayload | null>(null)
const tiles = ref<ReturnType<typeof buildInitialTileStates>>([])
const currentTileIndex = ref<number | null>(null)
const visited = ref<Set<number>>(new Set())
const activeSet = ref<Set<number>>(new Set())
const score = ref(0)
const moves = ref(0)
const hintMessage = ref<string | null>(null)
const hintedTiles = ref<Set<number>>(new Set())
const ended = ref(false)
const loading = ref(false)
const submitting = ref(false)
const playerUUID = ref('')
const sessionId = ref('')
const status = ref('Loading game...')
const lastTier = ref<'gold' | 'silver' | 'bronze' | 'finished' | 'unfinished' | null>(null)

const hintUsage = ref({
  level1: 0,
  level2: 0,
  level3: 0,
})

const boardRows = computed(() => game.value?.board.rows ?? 0)
const boardCols = computed(() => game.value?.board.cols ?? 0)
const maxScore = computed(() => game.value?.maxScore ?? 0)
const totalCoins = computed(() => game.value?.totalCoins ?? 0)
const edgeMap = computed(() => (game.value ? buildEdgeMap(game.value.board) : new Map()))
const completionPercent = computed(() => {
  if (!maxScore.value) return 0
  return Math.min(100, Math.round((score.value / maxScore.value) * 100))
})

const EDGE_DIRECTIONS: Direction[] = ['top', 'right', 'bottom', 'left']

function ensurePlayerUUID(): string {
  if (typeof window === 'undefined') return '00000000-0000-4000-8000-000000000000'
  const key = 'goldroad-player-uuid'
  const existing = window.localStorage.getItem(key)
  if (existing) return existing

  const created = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : '00000000-0000-4000-8000-000000000000'

  window.localStorage.setItem(key, created)
  return created
}

function newSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return '00000000-0000-4000-8000-000000000000'
}

function currentBoard() {
  if (!game.value) throw new Error('Game not loaded')
  return game.value.board
}

function updateTileStates() {
  if (!game.value || currentTileIndex.value === null) return

  const active = activeSet.value
  const current = currentTileIndex.value

  for (const row of tiles.value) {
    for (const tile of row) {
      tile.done = visited.value.has(tile.id)
      tile.active = active.has(tile.id)
      tile.focus = tile.id === current
      tile.tabIndex = tile.id === current || active.has(tile.id) ? 0 : -1
    }
  }
}

function setupGame(next: GamePayload) {
  game.value = next
  tiles.value = buildInitialTileStates(next.board)
  visited.value = new Set([next.board.start])
  currentTileIndex.value = next.board.start
  score.value = next.board.tiles[next.board.start] ?? 0
  moves.value = 1
  ended.value = false
  submitting.value = false
  hintMessage.value = null
  hintedTiles.value = new Set()
  status.value = 'Find the richest route to the destination.'
  lastTier.value = null
  hintUsage.value = { level1: 0, level2: 0, level3: 0 }
  sessionId.value = newSessionId()

  const board = next.board
  const edgeMap = buildEdgeMap(board)
  const active = getActiveNeighbors(board.start, board.rows, board.cols, edgeMap, visited.value)
  activeSet.value = new Set(active)
  updateTileStates()
}

async function loadCurrentGame() {
  loading.value = true
  status.value = 'Loading today\'s road...'
  try {
    const payload = await gamesApi.getCurrentGame()
    setupGame(payload)
  } finally {
    loading.value = false
  }
}

async function playAnother() {
  if (!playerUUID.value) return
  loading.value = true
  status.value = 'Finding another road...'
  try {
    const payload = await gamesApi.getAnotherGame(playerUUID.value)
    setupGame(payload)
  } finally {
    loading.value = false
  }
}

function highestHintLevelUsed(): number {
  if (hintUsage.value.level3 > 0) return 3
  if (hintUsage.value.level2 > 0) return 2
  if (hintUsage.value.level1 > 0) return 1
  return 0
}

async function finalizeRun(reachedEnd: boolean) {
  if (!game.value || submitting.value || !playerUUID.value || !sessionId.value) return
  submitting.value = true

  const tier = calcOutcomeTier(score.value, game.value.maxScore, reachedEnd, highestHintLevelUsed())
  lastTier.value = tier

  try {
    await sessionApi.endSession({
      playerUUID: playerUUID.value,
      gameNo: game.value.gameNo,
      sessionId: sessionId.value,
      score: score.value,
      moves: moves.value,
      attempts: 1,
      tier,
      hintsLevel1: hintUsage.value.level1,
      hintsLevel2: hintUsage.value.level2,
      hintsLevel3: hintUsage.value.level3,
    })
  } finally {
    submitting.value = false
  }
}

async function moveTo(tileIndex: number) {
  if (!game.value || ended.value || currentTileIndex.value === null) return
  if (!activeSet.value.has(tileIndex)) return

  visited.value.add(tileIndex)
  currentTileIndex.value = tileIndex
  score.value += game.value.board.tiles[tileIndex] ?? 0
  moves.value += 1
  hintedTiles.value.clear()
  hintMessage.value = null

  if (tileIndex === game.value.board.end) {
    ended.value = true
    status.value = 'Destination reached.'
    activeSet.value.clear()
    updateTileStates()
    await finalizeRun(true)
    return
  }

  const board = currentBoard()
  const edgeMap = buildEdgeMap(board)
  const next = getActiveNeighbors(tileIndex, board.rows, board.cols, edgeMap, visited.value)
  activeSet.value = new Set(next)

  if (!next.length) {
    ended.value = true
    status.value = 'Dead end reached. Try another road.'
    updateTileStates()
    await finalizeRun(false)
    return
  }

  updateTileStates()
}

async function requestHint(level: 1 | 2 | 3) {
  if (!game.value || ended.value || currentTileIndex.value === null || !playerUUID.value) return

  const res = await sessionApi.requestHint({
    playerUUID: playerUUID.value,
    gameNo: game.value.gameNo,
    sessionId: sessionId.value,
    level,
    currentTileIndex: currentTileIndex.value,
  })

  hintedTiles.value.clear()
  if (res.hint.level === 1) {
    hintUsage.value.level1 += 1
    hintMessage.value = `Hint: move ${res.hint.direction}.`
  } else if (res.hint.level === 2) {
    hintUsage.value.level2 += 1
    for (const idx of res.hint.tileIndexes) hintedTiles.value.add(idx)
    hintMessage.value = `Hint: suggested route indexes ${res.hint.tileIndexes.join(', ')}.`
  } else {
    hintUsage.value.level3 += 1
    hintedTiles.value.add(res.hint.nextTileIndex)
    hintMessage.value = `Hint: next best tile is ${res.hint.nextTileIndex}.`
  }
}

function tileClass(id: number) {
  const isCurrent = currentTileIndex.value === id
  return {
    tile: true,
    current: isCurrent,
    active: activeSet.value.has(id),
    done: visited.value.has(id),
    start: game.value?.board.start === id,
    end: game.value?.board.end === id,
    hinted: hintedTiles.value.has(id),
  }
}

function edgeTypeFor(tileIndex: number, direction: Direction): 'open' | 'blocked' | 'cost' | 'bonus' | 'boundary' {
  if (!game.value) return 'boundary'
  const [row, col] = parseTileIndex(tileIndex, game.value.board.cols)
  const neighbor = getNeighborId(row, col, direction, game.value.board.rows, game.value.board.cols)
  if (neighbor === null) return 'boundary'
  return getEdgeType(tileIndex, neighbor, edgeMap.value)
}

function edgeClass(tileIndex: number, direction: Direction) {
  const type = edgeTypeFor(tileIndex, direction)
  return [
    'edge',
    `edge-${direction}`,
    `edge-${type}`,
  ]
}

onMounted(async () => {
  playerUUID.value = ensurePlayerUUID()
  await loadCurrentGame()
})
</script>

<template>
  <div class="shell">
    <NuxtRouteAnnouncer />
    <main class="panel">
      <header class="topbar">
        <div>
          <p class="eyebrow">GoldRoad</p>
          <h1>Daily Road {{ game?.gameNo ?? '...' }}</h1>
        </div>
        <button class="secondary" :disabled="loading" @click="loadCurrentGame">Today's Game</button>
      </header>

      <section class="stats">
        <article>
          <h2>Score</h2>
          <p>{{ score }} / {{ maxScore }}</p>
        </article>
        <article>
          <h2>Coins on Board</h2>
          <p>{{ totalCoins }}</p>
        </article>
        <article>
          <h2>Progress</h2>
          <p>{{ completionPercent }}%</p>
        </article>
        <article>
          <h2>Moves</h2>
          <p>{{ moves }}</p>
        </article>
      </section>

      <p class="status">{{ status }}</p>

      <section class="game-layout">
        <section
          v-if="game"
          class="board-wrap"
        >
          <div
            class="board"
            :style="{
              gridTemplateColumns: `repeat(${boardCols}, minmax(2.4rem, 1fr))`,
            }"
          >
            <button
              v-for="tile in tiles.flat()"
              :key="tile.id"
              :class="tileClass(tile.id)"
              :disabled="ended || loading"
              @click="moveTo(tile.id)"
            >
              <span
                v-for="dir in EDGE_DIRECTIONS"
                :key="`${tile.id}-${dir}`"
                :class="edgeClass(tile.id, dir)"
              />
              <span class="value">{{ tile.value }}</span>
              <span v-if="tile.start" class="tag">S</span>
              <span v-if="tile.end" class="tag">E</span>
            </button>
          </div>
        </section>

        <aside class="legend-card">
          <h2>Board Guide</h2>
          <p>Move only through highlighted tiles. Thick edge markers show constraints on the road itself.</p>

          <div class="legend-row">
            <span class="legend-line legend-blocked" />
            <span>Blocked road</span>
          </div>
          <div class="legend-row">
            <span class="legend-line legend-cost" />
            <span>Cost road</span>
          </div>
          <div class="legend-row">
            <span class="legend-line legend-bonus" />
            <span>Bonus road</span>
          </div>

          <div class="note-grid">
            <div>
              <strong>Goal</strong>
              <p>Reach <span class="inline-pill">E</span> with the richest path, not just any path.</p>
            </div>
            <div>
              <strong>Current</strong>
              <p>Orange outline marks where you stand. Blue tiles are legal next moves.</p>
            </div>
          </div>
        </aside>
      </section>

      <section class="controls">
        <div class="hints">
          <button class="secondary" :disabled="ended || loading" @click="requestHint(1)">Hint 1</button>
          <button class="secondary" :disabled="ended || loading" @click="requestHint(2)">Hint 2</button>
          <button class="secondary" :disabled="ended || loading" @click="requestHint(3)">Hint 3</button>
        </div>
        <p v-if="hintMessage" class="hint-message">{{ hintMessage }}</p>

        <div class="cta-row">
          <button class="primary" :disabled="loading || !ended" @click="playAnother">Play Another</button>
          <span v-if="lastTier" class="tier">Outcome: {{ lastTier }}</span>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
:root {
  color-scheme: light;
}

.shell {
  min-height: 100dvh;
  padding: 2rem 1rem;
  background:
    radial-gradient(1200px circle at 10% 10%, #f3f6d9 0%, transparent 45%),
    radial-gradient(900px circle at 90% 80%, #d7ebff 0%, transparent 40%),
    linear-gradient(160deg, #f8f7f2 0%, #eef4ff 100%);
}

.panel {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.2rem;
  border-radius: 18px;
  background: rgb(255 255 255 / 88%);
  backdrop-filter: blur(6px);
  box-shadow: 0 24px 50px rgb(25 39 63 / 14%);
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 1rem;
}

.eyebrow {
  margin: 0;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.75rem;
  color: #3e4f7a;
}

h1 {
  margin: 0.2rem 0 0;
  font-size: clamp(1.4rem, 2.2vw, 2rem);
  color: #17213c;
}

.stats {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.7rem;
}

.stats article {
  border-radius: 12px;
  padding: 0.75rem;
  background: #f4f7ff;
  border: 1px solid #dde6ff;
}

.stats h2 {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: #4f618f;
}

.stats p {
  margin: 0.3rem 0 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #18213f;
}

.status {
  margin: 0.9rem 0;
  color: #2e3a60;
}

.game-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 1rem;
  align-items: start;
}

.board-wrap {
  padding: 0.9rem;
  border-radius: 16px;
  background: linear-gradient(180deg, #fbfcff 0%, #eef3ff 100%);
  border: 1px solid #dbe5ff;
}

.board {
  display: grid;
  gap: 0.55rem;
}

.tile {
  position: relative;
  border: 1px solid #d2dbf4;
  background: linear-gradient(180deg, #fff 0%, #f8fbff 100%);
  border-radius: 10px;
  aspect-ratio: 1/1;
  font-weight: 700;
  color: #1d2a52;
  transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
  overflow: hidden;
}

.tile:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgb(43 58 99 / 14%);
}

.tile.active {
  border-color: #4f7dff;
  background: #eef4ff;
}

.tile.done {
  background: #f3f8e6;
  border-color: #b8d58a;
}

.tile.current {
  outline: 2px solid #f59e0b;
  outline-offset: 0;
}

.tile.start .tag,
.tile.end .tag {
  position: absolute;
  top: 0.25rem;
  right: 0.3rem;
  font-size: 0.65rem;
  border-radius: 999px;
  padding: 0.1rem 0.35rem;
  background: #16203d;
  color: #fff;
}

.tile.hinted {
  box-shadow: inset 0 0 0 2px #ef4444;
}

.value {
  position: relative;
  z-index: 2;
  font-size: 1.05rem;
}

.edge {
  position: absolute;
  z-index: 1;
  pointer-events: none;
}

.edge-top,
.edge-bottom {
  left: 14%;
  right: 14%;
  height: 6px;
  border-radius: 999px;
}

.edge-left,
.edge-right {
  top: 14%;
  bottom: 14%;
  width: 6px;
  border-radius: 999px;
}

.edge-top { top: 0.12rem; }
.edge-bottom { bottom: 0.12rem; }
.edge-left { left: 0.12rem; }
.edge-right { right: 0.12rem; }

.edge-open,
.edge-boundary {
  display: none;
}

.edge-blocked {
  background: #111827;
}

.edge-cost {
  background: #f59e0b;
}

.edge-bonus {
  background: #10b981;
}

.legend-card {
  border-radius: 16px;
  padding: 1rem;
  background: linear-gradient(180deg, #192443 0%, #24345f 100%);
  color: #ecf2ff;
  box-shadow: 0 18px 40px rgb(20 33 63 / 18%);
}

.legend-card h2 {
  margin: 0 0 0.45rem;
  font-size: 1rem;
}

.legend-card p {
  margin: 0;
  color: #d4def9;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.9rem;
}

.legend-line {
  display: inline-block;
  width: 36px;
  height: 8px;
  border-radius: 999px;
}

.legend-blocked { background: #f3f4f6; box-shadow: inset 0 0 0 3px #111827; }
.legend-cost { background: #f59e0b; }
.legend-bonus { background: #10b981; }

.note-grid {
  display: grid;
  gap: 0.8rem;
  margin-top: 1.1rem;
}

.note-grid strong {
  display: block;
  margin-bottom: 0.2rem;
}

.inline-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.3rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: #0f172a;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
}

.controls {
  margin-top: 1rem;
  display: grid;
  gap: 0.7rem;
}

.hints {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.hint-message {
  margin: 0;
  color: #7a1530;
  font-weight: 600;
}

.cta-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.tier {
  color: #1c2a4d;
  font-weight: 700;
}

button {
  border: 0;
  border-radius: 10px;
  padding: 0.55rem 0.9rem;
  font-weight: 700;
  cursor: pointer;
}

.primary {
  color: #fff;
  background: linear-gradient(135deg, #d9480f 0%, #ff7a18 100%);
}

.secondary {
  color: #203158;
  background: #e8efff;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 760px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .game-layout {
    grid-template-columns: 1fr;
  }
}
</style>
