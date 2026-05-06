<script setup lang="ts">
import { buildInitialTileStates } from '../../utils/boardUtils'
import { buildEdgeMap, getActiveNeighbors, getEdgeType, getNeighborId, parseTileIndex } from '../../../shared/utils/puzzleEngine'
import { calcMedalForAttempt, isExactSolve } from '../../../lib/gameTiers'
import { UI_COPY } from '../../content/uiCopy'
import type { Direction, Medal } from '../../../shared/types/game'

const route = useRoute()
const gamesApi = useGamesApi()
const sessionApi = useSessionApi()
const currentRoadLabel = useState<string | null>('current-road-label', () => null)

type ReplayGame = Awaited<ReturnType<typeof gamesApi.getGameBoard>>

const game = ref<ReplayGame | null>(null)
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
const loading = ref(true)
const submitting = ref(false)
const loadError = ref<string | null>(null)
const status = ref<string>(UI_COPY.runtime.loadingGame)
const attemptNumber = ref(1)
const lastMedal = ref<Medal | null>(null)
const lastSolved = ref(false)
const sessionId = ref('')
const playerUUID = ref('')
const showHints = ref(false)
const hintUsage = ref({
  level1: 0,
  level2: 0,
  level3: 0,
})

const busy = computed(() => loading.value || submitting.value)
const footerMessage = computed(() => hintMessage.value ?? status.value)
const headerModeLabel = computed(() => (
  game.value?.puzzleType === 'expedition'
    ? UI_COPY.boardHeader.expedition
    : UI_COPY.boardHeader.classic
))
const formattedDate = computed(() => {
  if (!game.value) return ''

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(game.value.playableAt))
})
const difficultyLabel = computed(() => {
  if (!game.value) return ''
  return `${game.value.difficultyBand.charAt(0).toUpperCase()}${game.value.difficultyBand.slice(1)}`
})
const solvedBadge = computed(() => {
  if (!ended.value || !lastSolved.value) return null
  return lastMedal.value
    ? UI_COPY.boardFooter.medalAwarded(UI_COPY.boardHeader.medals[lastMedal.value])
    : 'Solved'
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

function setBodyMode(mode: ReplayGame['puzzleType'] | null) {
  if (typeof window === 'undefined') return
  document.body.classList.remove('mode-classic', 'mode-expedition')
  if (mode) {
    document.body.classList.add(`mode-${mode}`)
  }
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

function setupGame(
  next: ReplayGame,
  options: { attemptNumber?: number; preserveSession?: boolean } = {},
) {
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
  status.value = UI_COPY.runtime.preRun(next.maxScore)
  attemptNumber.value = options.attemptNumber ?? 1
  lastMedal.value = null
  lastSolved.value = false
  hintUsage.value = { level1: 0, level2: 0, level3: 0 }
  sessionId.value = options.preserveSession && sessionId.value ? sessionId.value : newSessionId()

  const edgeMap = buildEdgeMap(next.board)
  const active = getActiveNeighbors(next.board.start, next.board.rows, next.board.cols, edgeMap, visited.value)
  activeSet.value = new Set(active)
  currentRoadLabel.value = `Road ${next.gameNo} · Archive`
  setBodyMode(next.puzzleType)
  updateTileStates()
}

async function loadReplayGame() {
  const gameNo = Number.parseInt(String(route.params.gameNo ?? ''), 10)
  if (!Number.isInteger(gameNo) || gameNo <= 0) {
    loadError.value = 'Invalid road number.'
    loading.value = false
    game.value = null
    currentRoadLabel.value = null
    setBodyMode(null)
    return
  }

  loading.value = true
  loadError.value = null
  game.value = null
  status.value = UI_COPY.runtime.loadingGame

  try {
    const next = await gamesApi.getGameBoard(gameNo)
    setupGame(next)
  } catch {
    loadError.value = 'This archived road is unavailable right now.'
    currentRoadLabel.value = null
    setBodyMode(null)
  } finally {
    loading.value = false
  }
}

async function finalizeRun(endedAtExit: boolean) {
  if (!game.value || submitting.value || !playerUUID.value || !sessionId.value) return

  submitting.value = true
  const solved = endedAtExit && isExactSolve(score.value, game.value.maxScore)
  const medal = calcMedalForAttempt(attemptNumber.value, solved)
  lastSolved.value = solved
  lastMedal.value = medal

  try {
    await sessionApi.endSession({
      playerUUID: playerUUID.value,
      gameNo: game.value.gameNo,
      puzzleType: game.value.puzzleType,
      sessionId: sessionId.value,
      score: score.value,
      moves: moves.value,
      attemptNumber: attemptNumber.value,
      solved,
      medal,
      hintsLevel1: hintUsage.value.level1,
      hintsLevel2: hintUsage.value.level2,
      hintsLevel3: hintUsage.value.level3,
    })
  } finally {
    submitting.value = false
  }
}

async function retryGame() {
  if (!game.value || loading.value || submitting.value) return
  if (!ended.value && moves.value <= 1) return

  const nextAttemptNumber = attemptNumber.value + 1

  if (!ended.value) {
    await finalizeRun(false)
  }

  setupGame(game.value, {
    attemptNumber: nextAttemptNumber,
    preserveSession: true,
  })
}

async function moveTo(tileIndex: number) {
  if (!game.value || ended.value || currentTileIndex.value === null) return
  if (!activeSet.value.has(tileIndex)) return

  const board = game.value.board
  const edgeMap = buildEdgeMap(board)
  const fromIndex = currentTileIndex.value
  const edgeType = getEdgeType(fromIndex, tileIndex, edgeMap)
  let edgeCost = 0
  if (edgeType === 'toll') {
    edgeCost = -board.tollValue
  } else if (edgeType === 'bonus') {
    edgeCost = board.bonusValue
  }

  visited.value.add(tileIndex)
  pathHistory.value = [...pathHistory.value, tileIndex]
  currentTileIndex.value = tileIndex
  score.value = score.value + (board.tiles[tileIndex] ?? 0) + edgeCost
  moves.value += 1
  hintedTiles.value.clear()
  hintMessage.value = null

  if (tileIndex === board.end) {
    ended.value = true
    const delta = game.value.maxScore - score.value
    status.value = delta === 0
      ? UI_COPY.runtime.destinationSolved
      : delta > 0
        ? UI_COPY.runtime.destinationShort(delta)
        : UI_COPY.runtime.destinationOver(Math.abs(delta))
    activeSet.value.clear()
    updateTileStates()
    await finalizeRun(true)
    return
  }

  const next = getActiveNeighbors(tileIndex, board.rows, board.cols, edgeMap, visited.value)
  activeSet.value = new Set(next)

  if (!next.length) {
    ended.value = true
    status.value = UI_COPY.runtime.deadEnd
    updateTileStates()
    await finalizeRun(false)
    return
  }

  const delta = game.value.maxScore - score.value
  status.value = delta === 0
    ? UI_COPY.runtime.exactNowFinish
    : delta > 0
      ? UI_COPY.runtime.needMore(delta)
      : UI_COPY.runtime.overBy(Math.abs(delta))

  updateTileStates()
}

async function requestHint(level: 1 | 2 | 3) {
  if (!game.value || ended.value || currentTileIndex.value === null || !playerUUID.value) return

  const res = await sessionApi.requestHint({
    playerUUID: playerUUID.value,
    gameNo: game.value.gameNo,
    puzzleType: game.value.puzzleType,
    sessionId: sessionId.value,
    level,
    currentTileIndex: currentTileIndex.value,
  })

  showHints.value = false
  hintedTiles.value.clear()

  if (res.hint.level === 1) {
    hintUsage.value = { ...hintUsage.value, level1: hintUsage.value.level1 + 1 }
    if (typeof res.hint.nextTileIndex === 'number') {
      hintedTiles.value.add(res.hint.nextTileIndex)
      hintMessage.value = UI_COPY.runtime.hint1Highlighted
    } else {
      hintMessage.value = UI_COPY.runtime.hint1Direction(res.hint.direction)
    }
    return
  }

  if (res.hint.level === 2) {
    hintUsage.value = { ...hintUsage.value, level2: hintUsage.value.level2 + 1 }
    for (const idx of res.hint.tileIndexes) hintedTiles.value.add(idx)
    hintMessage.value = UI_COPY.runtime.hint2Suggested()
    return
  }

  hintUsage.value = { ...hintUsage.value, level3: hintUsage.value.level3 + 1 }
  hintedTiles.value.add(res.hint.nextTileIndex)
  hintMessage.value = UI_COPY.runtime.hint3Next()
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

watch(() => route.params.gameNo, () => {
  if (import.meta.client) {
    void loadReplayGame()
  }
})

onMounted(() => {
  playerUUID.value = ensurePlayerUUID()
  window.addEventListener('keydown', handleKeydown)
  void loadReplayGame()
})

onUnmounted(() => {
  currentRoadLabel.value = null
  setBodyMode(null)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="shell">
    <main class="layout">
      <section v-if="loading" class="state-card">
        <p>{{ status }}</p>
      </section>

      <section v-else-if="loadError" class="state-card state-card--error">
        <p>{{ loadError }}</p>
        <NuxtLink to="/games" class="back-link back-link--inline">
          Back to Past Games
        </NuxtLink>
      </section>

      <section v-else-if="game" class="board-column">
        <header class="archive-header">
          <div class="archive-header-top">
            <NuxtLink to="/games" class="back-link">
              Back to Past Games
            </NuxtLink>
            <span class="archive-mode">{{ headerModeLabel }}</span>
          </div>

          <div class="archive-header-main">
            <div>
              <h1>Road {{ game.gameNo }}</h1>
              <p class="archive-subtitle">
                {{ formattedDate }} · {{ difficultyLabel }} difficulty · Archived replay
              </p>
            </div>

            <div class="archive-metrics">
              <article class="metric-chip">
                <span>Score</span>
                <strong>{{ score }}/{{ game.maxScore }}</strong>
              </article>
              <article class="metric-chip">
                <span>Board Coins</span>
                <strong>{{ game.totalCoins }}</strong>
              </article>
              <article class="metric-chip">
                <span>Attempt</span>
                <strong>#{{ attemptNumber }}</strong>
              </article>
            </div>
          </div>

          <p class="archive-note">
            Replay any archived road without affecting today's live board state.
          </p>
        </header>

        <GameBoard
          :board="game.board"
          :puzzle-type="game.puzzleType"
          :tiles="tiles"
          :current-tile-index="currentTileIndex"
          :active-set="activeSet"
          :visited-set="visited"
          :hinted-tiles="hintedTiles"
          :path-history="pathHistory"
          :disabled="ended || busy"
          @select="moveTo"
        />

        <section class="archive-footer">
          <div class="footer-top">
            <div class="footer-copy">
              <p class="footer-message">{{ footerMessage }}</p>

              <div v-if="solvedBadge" class="meta-row">
                <span class="meta-pill">{{ solvedBadge }}</span>
              </div>
            </div>

            <span v-if="attemptNumber > 1" class="attempt-pill">
              {{ UI_COPY.boardFooter.attemptLabel }} #{{ attemptNumber }}
            </span>
          </div>

          <div class="action-row">
            <button
              v-if="ended || moves > 1"
              type="button"
              class="primary"
              :disabled="busy"
              @click="retryGame"
            >
              {{ UI_COPY.boardFooter.retryRoad }}
            </button>

            <button
              v-if="!ended"
              type="button"
              class="ghost"
              :disabled="busy"
              @click="showHints = true"
            >
              {{ UI_COPY.boardFooter.openHint }}
            </button>

            <button type="button" class="ghost" @click="useHowToPlaySheet().openHowToPlay()">
              {{ UI_COPY.boardFooter.openHelp }}
            </button>

            <NuxtLink to="/games" class="link-button secondary-link">
              Back to Archive
            </NuxtLink>
          </div>
        </section>

        <div v-if="showHints" class="sheet-backdrop" @click.self="showHints = false">
          <section class="sheet-card" aria-label="Hints">
            <div class="sheet-header">
              <h2>{{ UI_COPY.boardFooter.hintTitle }}</h2>
              <button type="button" class="close-button" @click="showHints = false">
                {{ UI_COPY.sidebar.close }}
              </button>
            </div>

            <div class="hint-buttons">
              <button type="button" class="secondary" :disabled="busy" @click="requestHint(1)">
                <span>{{ UI_COPY.boardFooter.hintRows.level1Title }}</span>
                <small>{{ UI_COPY.boardFooter.hintRows.level1Desc }} · Used {{ hintUsage.level1 }}</small>
              </button>
              <button type="button" class="secondary" :disabled="busy" @click="requestHint(2)">
                <span>{{ UI_COPY.boardFooter.hintRows.level2Title }}</span>
                <small>{{ UI_COPY.boardFooter.hintRows.level2Desc }} · Used {{ hintUsage.level2 }}</small>
              </button>
              <button type="button" class="secondary" :disabled="busy" @click="requestHint(3)">
                <span>{{ UI_COPY.boardFooter.hintRows.level3Title }}</span>
                <small>{{ UI_COPY.boardFooter.hintRows.level3Desc }} · Used {{ hintUsage.level3 }}</small>
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: calc(100dvh - 60px);
  padding: 1.3rem;
}

.layout {
  max-width: 960px;
  margin: 0 auto;
}

.board-column {
  display: grid;
  gap: 0.9rem;
  max-width: 760px;
  margin: 0 auto;
}

.archive-header,
.archive-footer,
.state-card {
  display: grid;
  gap: 0.8rem;
  padding: 1rem 1.1rem;
  border-radius: var(--radius-xl);
  background: var(--gradient-card-status);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.28);
  box-shadow: var(--shadow-border-dark), var(--shadow-lg);
}

.state-card {
  max-width: 560px;
  margin: 4rem auto 0;
  text-align: center;
  color: var(--color-gold-bright);
}

.state-card--error {
  justify-items: center;
}

.archive-header-top,
.archive-header-main,
.footer-top,
.action-row,
.sheet-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 0.8rem;
}

.archive-header-main {
  align-items: end;
}

.back-link,
.link-button {
  text-decoration: none;
}

.back-link {
  color: rgb(var(--color-gold-rgb) / 0.8);
  font-size: 0.92rem;
  font-weight: 600;
}

.back-link:hover,
.link-button:hover {
  color: var(--color-gold);
}

.back-link--inline {
  margin-top: 0.5rem;
}

.archive-mode,
.meta-pill,
.attempt-pill {
  padding: 0.26rem 0.55rem;
  border-radius: var(--radius-full);
  background: rgb(var(--color-gold-rgb) / 0.12);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.24);
  color: rgb(var(--color-gold-rgb) / 0.88);
  font-size: 0.8rem;
  font-weight: 700;
}

.archive-header h1,
.sheet-header h2 {
  margin: 0;
  color: var(--color-gold);
}

.archive-subtitle,
.archive-note,
.footer-message,
.hint-buttons small {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.8);
}

.archive-subtitle {
  margin-top: 0.35rem;
}

.archive-note {
  font-size: 0.92rem;
}

.archive-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  justify-content: end;
}

.metric-chip {
  min-width: 92px;
  padding: 0.5rem 0.65rem;
  border-radius: var(--radius-md);
  background: rgb(var(--color-gold-rgb) / 0.08);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.18);
}

.metric-chip span {
  display: block;
  color: rgb(var(--color-gold-rgb) / 0.72);
  font-size: 0.78rem;
}

.metric-chip strong,
.footer-message {
  color: var(--color-gold-bright);
}

.metric-chip strong {
  display: block;
  margin-top: 0.18rem;
}

.footer-copy {
  display: grid;
  gap: 0.55rem;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

button,
.link-button {
  border: 0;
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.primary {
  color: var(--color-text-on-gold);
  background: var(--gradient-button-primary);
  box-shadow: 0 0 18px rgb(var(--color-gold-rgb) / 0.28);
}

.ghost,
.secondary,
.secondary-link,
.close-button {
  color: var(--color-gold);
  background: rgb(var(--color-gold-rgb) / 0.12);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.28);
}

.ghost {
  background: rgb(var(--color-gold-rgb) / 0.08);
}

button:hover:not(:disabled),
.link-button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(0 0 0 / 0.6);
  backdrop-filter: blur(4px);
}

.sheet-card {
  width: min(100%, 520px);
  max-height: min(80dvh, 680px);
  overflow: auto;
  border-radius: var(--radius-lg);
  padding: 1rem;
  background: var(--gradient-card-overlay);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.35);
  box-shadow: var(--shadow-xl);
}

.hint-buttons {
  display: grid;
  gap: 0.6rem;
  margin-top: 0.9rem;
}

.hint-buttons button {
  display: grid;
  gap: 0.22rem;
  text-align: left;
}

@media (max-width: 760px) {
  .shell {
    padding: 0.9rem;
  }

  .archive-header-top,
  .archive-header-main,
  .footer-top,
  .action-row {
    display: grid;
  }

  .archive-metrics {
    justify-content: start;
  }
}
</style>