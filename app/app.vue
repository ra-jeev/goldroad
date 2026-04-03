<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { buildInitialTileStates } from './utils/boardUtils'
import { buildEdgeMap, getActiveNeighbors, getNeighborId, parseTileIndex } from '../shared/utils/puzzleEngine'
import { calcOutcomeTier } from '../lib/gameTiers'
import type { Direction } from '../shared/types/game'

type GamePayload = Awaited<ReturnType<ReturnType<typeof useGamesApi>['getCurrentGame']>>

const gamesApi = useGamesApi()
const sessionApi = useSessionApi()

const game = ref<GamePayload | null>(null)
const tiles = ref<ReturnType<typeof buildInitialTileStates>>([])
const currentTileIndex = ref<number | null>(null)
const visited = ref<Set<number>>(new Set())
const activeSet = ref<Set<number>>(new Set())
const pathHistory = ref<number[]>([])
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

const maxScore = computed(() => game.value?.maxScore ?? 0)
const totalCoins = computed(() => game.value?.totalCoins ?? 0)
const completionPercent = computed(() => {
  if (!maxScore.value) return 0
  return Math.min(100, Math.round((score.value / maxScore.value) * 100))
})

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
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return '00000000-0000-4000-8000-000000000000'
}

function updateTileStates() {
  if (!game.value || currentTileIndex.value === null) return

  const current = currentTileIndex.value
  for (const row of tiles.value) {
    for (const tile of row) {
      tile.done = visited.value.has(tile.id)
      tile.active = activeSet.value.has(tile.id)
      tile.focus = tile.id === current
      tile.tabIndex = tile.id === current || activeSet.value.has(tile.id) ? 0 : -1
    }
  }
}

function setupGame(next: GamePayload) {
  game.value = next
  tiles.value = buildInitialTileStates(next.board)
  visited.value = new Set([next.board.start])
  pathHistory.value = [next.board.start]
  currentTileIndex.value = next.board.start
  score.value = next.board.tiles[next.board.start] ?? 0
  moves.value = 1
  ended.value = false
  submitting.value = false
  hintMessage.value = null
  hintedTiles.value = new Set()
  status.value = 'Find the richest legal path to the exit. Dark bars are blocked roads.'
  lastTier.value = null
  hintUsage.value = { level1: 0, level2: 0, level3: 0 }
  sessionId.value = newSessionId()

  const edgeMap = buildEdgeMap(next.board)
  const active = getActiveNeighbors(next.board.start, next.board.rows, next.board.cols, edgeMap, visited.value)
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
  pathHistory.value = [...pathHistory.value, tileIndex]
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

  const board = game.value.board
  const edgeMap = buildEdgeMap(board)
  const next = getActiveNeighbors(tileIndex, board.rows, board.cols, edgeMap, visited.value)
  activeSet.value = new Set(next)

  if (!next.length) {
    ended.value = true
    status.value = 'Dead end reached. This route cannot continue.'
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
    if (typeof res.hint.nextTileIndex === 'number') {
      hintedTiles.value.add(res.hint.nextTileIndex)
      hintMessage.value = 'Hint: the next best move is highlighted on the board.'
    } else {
      hintMessage.value = `Hint: move ${res.hint.direction}.`
    }
  } else if (res.hint.level === 2) {
    hintUsage.value.level2 += 1
    for (const idx of res.hint.tileIndexes) hintedTiles.value.add(idx)
    hintMessage.value = `Hint: suggested route nodes ${res.hint.tileIndexes.join(', ')}.`
  } else {
    hintUsage.value.level3 += 1
    hintedTiles.value.add(res.hint.nextTileIndex)
    hintMessage.value = `Hint: next best tile is ${res.hint.nextTileIndex}.`
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (!game.value || ended.value || loading.value || currentTileIndex.value === null) return

  const directionMap: Record<string, Direction> = {
    ArrowUp: 'top',
    ArrowRight: 'right',
    ArrowDown: 'bottom',
    ArrowLeft: 'left',
    w: 'top',
    d: 'right',
    s: 'bottom',
    a: 'left',
  }

  const direction = directionMap[event.key]
  if (!direction) return

  const [row, col] = parseTileIndex(currentTileIndex.value, game.value.board.cols)
  const neighbor = getNeighborId(row, col, direction, game.value.board.rows, game.value.board.cols)
  if (neighbor === null || !activeSet.value.has(neighbor)) return

  event.preventDefault()
  void moveTo(neighbor)
}

onMounted(async () => {
  playerUUID.value = ensurePlayerUUID()
  window.addEventListener('keydown', handleKeydown)
  await loadCurrentGame()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="shell">
    <NuxtRouteAnnouncer />

    <main class="layout">
      <GameSidebar
        :game-no="game?.gameNo ?? null"
        :score="score"
        :max-score="maxScore"
        :total-coins="totalCoins"
        :moves="moves"
        :completion-percent="completionPercent"
        :status="status"
        :hint-message="hintMessage"
        :difficulty-band="game?.difficultyBand ?? null"
        :hint-usage="hintUsage"
        :ended="ended"
        :loading="loading"
        @current="loadCurrentGame"
        @hint="requestHint"
      />

      <section class="main-stage">
        <GameBoard
          v-if="game"
          :board="game.board"
          :tiles="tiles"
          :current-tile-index="currentTileIndex"
          :active-set="activeSet"
          :visited-set="visited"
          :hinted-tiles="hintedTiles"
          :path-history="pathHistory"
          :disabled="ended || loading"
          @select="moveTo"
        />

        <CompletionPanel
          :visible="ended"
          :tier="lastTier"
          :score="score"
          :max-score="maxScore"
          :moves="moves"
          :status="status"
          :submitting="submitting || loading"
          @another="playAnother"
          @today="loadCurrentGame"
        />
      </section>
    </main>
  </div>
</template>

<style scoped>
:global(html) {
  margin: 0;
  min-height: 100%;
  background: #0d0702;
}

:global(body) {
  margin: 0;
  min-height: 100%;
  background: #0d0702;
}

:global(#__nuxt) {
  min-height: 100dvh;
}

.shell {
  min-height: 100dvh;
  padding: 1.3rem;
  background:
    radial-gradient(ellipse 70% 50% at 15% 0%, rgb(160 90 0 / 22%) 0%, transparent 55%),
    radial-gradient(ellipse 55% 45% at 85% 100%, rgb(90 40 0 / 20%) 0%, transparent 60%),
    linear-gradient(175deg, #1a0e03 0%, #110900 55%, #0d0702 100%);
}

.layout {
  max-width: 1320px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 1.1rem;
}

.main-stage {
  display: grid;
  gap: 1.1rem;
  align-content: start;
}

.layout > * {
  animation: rise-in 360ms cubic-bezier(.2, .8, .2, 1) both;
}

.layout > *:nth-child(2) {
  animation-delay: 80ms;
}

@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 980px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .shell {
    padding: 0.9rem;
  }
}
</style>
