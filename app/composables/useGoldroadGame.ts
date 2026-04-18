import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { buildInitialTileStates } from '../utils/boardUtils'
import { buildEdgeMap, getActiveNeighbors, getNeighborId, parseTileIndex, getEdgeType } from '../../shared/utils/puzzleEngine'
import { calcMedalForAttempt, isExactSolve } from '../../lib/gameTiers'
import type { Direction, Medal, OutcomeTier, PuzzleType } from '../../shared/types/game'
import { UI_COPY } from '../content/uiCopy'

type GamePayload = {
  gameNo: number
  puzzleType: PuzzleType
  board: any
  maxScore: number
  totalCoins: number
  difficultyBand: string
  playableAt: string
  nextGameAt: string | null
}

export function useGoldroadGame() {
  const gamesApi = useGamesApi()
  const sessionApi = useSessionApi()
  const localProgress = useLocalGameProgress()
  const localStats = useLocalPlayerStats()

  const availableGames = ref<{ classic: GamePayload | null; expedition: GamePayload | null }>({
    classic: null,
    expedition: null,
  })
  const selectedMode = ref<PuzzleType | null>(null)
  
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
  const status = ref<string>(UI_COPY.runtime.loadingGame)
  const lastTier = ref<OutcomeTier | null>(null)
  const lastMedal = ref<Medal | null>(null)
  const lastSolved = ref(false)
  const attemptNumber = ref(1)
  const expeditionJustUnlocked = ref(false)
  const nextResetCountdown = ref('00:00:00')

  let countdownTimer: ReturnType<typeof setInterval> | null = null

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

  const roadHeading = computed(() => game.value ? `Road ${game.value.gameNo}` : 'Road ...')
  const canSwitchToExpedition = computed(() => (
    selectedMode.value === 'classic'
    && lastSolved.value
    && Boolean(availableGames.value.expedition)
  ))

  const isExpeditionUnlocked = computed(() => {
    if (!availableGames.value.classic) return false

    const classicProgress = localProgress.getGameProgress(
      availableGames.value.classic.gameNo,
      'classic',
    )
    if (classicProgress.solved) return true

    const today = new Date().toISOString().split('T')[0]
    const solvedKey = `goldroad-classic-solved-${today}`
    const exactKey = `goldroad-classic-exact-${today}`
    const legacyGoldKey = `goldroad-classic-gold-${today}`
    return typeof window !== 'undefined' && (
      window.localStorage.getItem(solvedKey) === 'true'
      || window.localStorage.getItem(exactKey) === 'true'
      || window.localStorage.getItem(legacyGoldKey) === 'true'
    )
  })

  const classicSolvedToday = computed(() => {
    if (!availableGames.value.classic) return false

    const classicProgress = localProgress.getGameProgress(
      availableGames.value.classic.gameNo,
      'classic',
    )
    if (classicProgress.solved) return true

    const today = new Date().toISOString().split('T')[0]
    const solvedKey = `goldroad-classic-solved-${today}`
    const exactKey = `goldroad-classic-exact-${today}`
    const legacyGoldKey = `goldroad-classic-gold-${today}`
    return typeof window !== 'undefined' && (
      window.localStorage.getItem(solvedKey) === 'true'
      || window.localStorage.getItem(exactKey) === 'true'
      || window.localStorage.getItem(legacyGoldKey) === 'true'
    )
  })

  // UI-ready labels (derived display text and formatted fields)
  const uiLabels = computed(() => ({
    roadHeading: game.value ? `Road ${game.value.gameNo}` : 'Road ...',
    modeLabel: selectedMode.value === 'expedition' 
      ? UI_COPY.modeSelector.expeditionBadge 
      : UI_COPY.modeSelector.classicBadge,
    runStateHeading: ended.value ? UI_COPY.sidebar.routeComplete : UI_COPY.sidebar.routeActive,
    difficultyLabel: game.value?.difficultyBand ?? '—',
    hintDisplayMessage: hintMessage.value ?? UI_COPY.sidebar.defaultHintInline,
    hasHintMessage: Boolean(hintMessage.value),
    progressText: `${completionPercent.value}%`,
    completionHeading: lastTier.value
      ? UI_COPY.completion.tiers[lastTier.value]
      : UI_COPY.completion.headingFallback,
    completionOutcome: lastTier.value ?? '—',
  }))

  // Update body class based on selected mode
  watch(selectedMode, (mode) => {
    if (typeof window === 'undefined') return
    document.body.classList.remove('mode-classic', 'mode-expedition')
    if (mode) {
      document.body.classList.add(`mode-${mode}`)
    }
  })

  function getTodayKey(): string {
    return new Date().toISOString().split('T')[0]!
  }

  function syncStatsHistory() {
    if (!playerUUID.value || !localProgress.state.value) return
    localStats.syncCurrentDay(
      playerUUID.value,
      localProgress.state.value.day,
      localProgress.state.value.games,
    )
  }

  function getNextUtcMidnight(): Date {
    const now = new Date()
    return new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
    ))
  }

  function updateNextResetCountdown() {
    const diff = Math.max(0, getNextUtcMidnight().getTime() - Date.now())
    const hours = Math.floor(diff / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    nextResetCountdown.value = [hours, minutes, seconds]
      .map((part) => String(part).padStart(2, '0'))
      .join(':')
  }

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

  function markClassicSolved(solved: boolean) {
    if (typeof window === 'undefined' || selectedMode.value !== 'classic') return

    const today = new Date().toISOString().split('T')[0]

    if (solved) {
      window.localStorage.setItem(`goldroad-classic-solved-${today}`, 'true')
      window.localStorage.setItem(`goldroad-classic-exact-${today}`, 'true')
    }

    // Clean up old entries (keep last 7 days)
    cleanupOldCompletionFlags()
  }

  function cleanupOldCompletionFlags() {
    if (typeof window === 'undefined') return
    
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const keysToRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && (
        key.startsWith('goldroad-classic-solved-')
        || key.startsWith('goldroad-classic-exact-')
        || key.startsWith('goldroad-classic-gold-')
        || key.startsWith('goldroad-classic-completed-')
      )) {
        const dateStr = key.split('-').slice(-3).join('-')
        const keyDate = new Date(dateStr)
        if (keyDate < sevenDaysAgo) {
          keysToRemove.push(key)
        }
      }
    }
    
    keysToRemove.forEach(key => window.localStorage.removeItem(key))
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
    next: GamePayload,
    options: { attemptNumber?: number; preserveSession?: boolean } = {},
  ) {
    const progress = playerUUID.value
      ? localProgress.getGameProgress(next.gameNo, next.puzzleType)
      : null
    const progressAttemptNumber = progress?.solved
      ? (progress.firstSolvedAttempt ?? Math.max(progress.attempts, 1))
      : progress
        ? progress.attempts + 1
        : 1
    const nextAttemptNumber = options.attemptNumber ?? 1
    const nextSessionId = options.preserveSession && sessionId.value
      ? sessionId.value
      : newSessionId()

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
    expeditionJustUnlocked.value = false
    status.value = progress?.solved
      ? progress.medal
        ? UI_COPY.runtime.alreadySolvedWithMedal(UI_COPY.boardHeader.medals[progress.medal])
        : UI_COPY.runtime.alreadySolved
      : UI_COPY.runtime.preRun(next.maxScore)
    lastTier.value = null
    lastMedal.value = progress?.medal ?? null
    lastSolved.value = progress?.solved ?? false
    attemptNumber.value = options.attemptNumber ?? progressAttemptNumber ?? nextAttemptNumber
    hintUsage.value = progress?.hints ?? { level1: 0, level2: 0, level3: 0 }
    sessionId.value = nextSessionId

    const edgeMap = buildEdgeMap(next.board)
    const active = getActiveNeighbors(next.board.start, next.board.rows, next.board.cols, edgeMap, visited.value)
    activeSet.value = new Set(active)
    updateTileStates()
  }

  async function loadAvailableGames() {
    loading.value = true
    status.value = UI_COPY.runtime.loadingTodaysRoad
    try {
      const response = await gamesApi.getCurrentGames()
      availableGames.value = response

      const preferredMode = (
        selectedMode.value === 'expedition' && response.expedition && isExpeditionUnlocked.value
      )
        ? 'expedition'
        : response.classic
          ? 'classic'
          : response.expedition
            ? 'expedition'
            : null

      if (!preferredMode) {
        selectedMode.value = null
        game.value = null
        return
      }

      selectedMode.value = preferredMode
      setupGame(preferredMode === 'classic' ? response.classic! : response.expedition!)
    } finally {
      loading.value = false
    }
  }

  function selectMode(mode: PuzzleType) {
    const gameToLoad = mode === 'classic' ? availableGames.value.classic : availableGames.value.expedition
    if (mode === 'expedition' && !isExpeditionUnlocked.value) return
    if (!gameToLoad) return
    
    selectedMode.value = mode
    setupGame(gameToLoad)
  }

  function switchToExpedition() {
    if (!availableGames.value.expedition || !isExpeditionUnlocked.value) return
    selectMode('expedition')
  }

  async function loadCurrentGame() {
    await loadAvailableGames()
  }

  async function playAnother() {
    if (!playerUUID.value) return
    loading.value = true
    status.value = UI_COPY.runtime.findingAnotherRoad
    try {
      const payload = await gamesApi.getAnotherGame(playerUUID.value)
      setupGame(payload)
    } finally {
      loading.value = false
    }
  }

  async function finalizeRun(endedAtExit: boolean) {
    if (!game.value || submitting.value || !playerUUID.value || !sessionId.value) return
    submitting.value = true
    const expeditionWasUnlocked = isExpeditionUnlocked.value

    const solved = endedAtExit && isExactSolve(score.value, game.value.maxScore)
    const medal = calcMedalForAttempt(attemptNumber.value, solved)
    const tier: OutcomeTier = medal ?? (endedAtExit ? 'finished' : 'unfinished')

    lastSolved.value = solved
    lastMedal.value = medal
    lastTier.value = tier

    if (selectedMode.value === 'classic') {
      markClassicSolved(solved)
      expeditionJustUnlocked.value = solved && !expeditionWasUnlocked && Boolean(availableGames.value.expedition)
    } else {
      expeditionJustUnlocked.value = false
    }

    localProgress.recordRun(
      playerUUID.value,
      game.value.gameNo,
      game.value.puzzleType,
      attemptNumber.value,
      solved,
      medal,
      score.value,
      hintUsage.value,
    )
    syncStatsHistory()

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

  async function retryCurrentGame() {
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

  async function handlePlayAnother() {
    if (canSwitchToExpedition.value) {
      switchToExpedition()
      return
    }
    
    // Otherwise, load a random past game
    await playAnother()
  }

  async function moveTo(tileIndex: number) {
    if (!game.value || ended.value || currentTileIndex.value === null) return
    if (!activeSet.value.has(tileIndex)) return

    const board = game.value.board
    const edgeMap = buildEdgeMap(board)
    
    // Calculate edge cost (toll/bonus) for the move
    const fromIndex = currentTileIndex.value
    const toIndex = tileIndex
    const edgeType = getEdgeType(fromIndex, toIndex, edgeMap)
    let edgeCost = 0
    if (edgeType === 'toll') {
      edgeCost = -board.tollValue
    } else if (edgeType === 'bonus') {
      edgeCost = board.bonusValue
    }

    visited.value.add(tileIndex)
    pathHistory.value = [...pathHistory.value, tileIndex]
    currentTileIndex.value = tileIndex
    const nextScore = score.value + (game.value.board.tiles[tileIndex] ?? 0) + edgeCost
    score.value = nextScore
    moves.value += 1
    hintedTiles.value.clear()
    hintMessage.value = null

    if (tileIndex === game.value.board.end) {
      ended.value = true
      const delta = game.value.maxScore - nextScore
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

    const delta = game.value.maxScore - nextScore
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

    hintedTiles.value.clear()
    let progress
    if (res.hint.level === 1) {
      progress = localProgress.incrementHintUsage(playerUUID.value, game.value.gameNo, game.value.puzzleType, 1)
      hintUsage.value = progress.hints
      if (typeof res.hint.nextTileIndex === 'number') {
        hintedTiles.value.add(res.hint.nextTileIndex)
        hintMessage.value = UI_COPY.runtime.hint1Highlighted
      } else {
        hintMessage.value = UI_COPY.runtime.hint1Direction(res.hint.direction)
      }
    } else if (res.hint.level === 2) {
      progress = localProgress.incrementHintUsage(playerUUID.value, game.value.gameNo, game.value.puzzleType, 2)
      hintUsage.value = progress.hints
      for (const idx of res.hint.tileIndexes) hintedTiles.value.add(idx)
      hintMessage.value = UI_COPY.runtime.hint2Suggested()
    } else {
      progress = localProgress.incrementHintUsage(playerUUID.value, game.value.gameNo, game.value.puzzleType, 3)
      hintUsage.value = progress.hints
      hintedTiles.value.add(res.hint.nextTileIndex)
      hintMessage.value = UI_COPY.runtime.hint3Next()
    }

    if (progress) {
      syncStatsHistory()
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
    localProgress.load(playerUUID.value)
    localStats.load(playerUUID.value)
    syncStatsHistory()
    updateNextResetCountdown()
    countdownTimer = setInterval(updateNextResetCountdown, 1000)
    window.addEventListener('keydown', handleKeydown)
    await loadCurrentGame()
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  })

  return {
    game,
    tiles,
    currentTileIndex,
    visited,
    activeSet,
    pathHistory,
    score,
    moves,
    hintMessage,
    hintedTiles,
    ended,
    loading,
    submitting,
    status,
    lastTier,
    lastMedal,
    hintUsage,
    maxScore,
    totalCoins,
    completionPercent,
    uiLabels,
    availableGames,
    selectedMode,
    isExpeditionUnlocked,
    classicSolvedToday,
    lastSolved,
    attemptNumber,
    expeditionJustUnlocked,
    nextResetCountdown,
    roadHeading,
    canSwitchToExpedition,
    loadCurrentGame,
    selectMode,
    switchToExpedition,
    playAnother: handlePlayAnother,
    retryCurrentGame,
    moveTo,
    requestHint,
  }
}