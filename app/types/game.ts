import type { Direction } from '../../shared/types/game'

export interface TileState {
  id: number
  row: number
  col: number
  value: number
  start: boolean
  end: boolean
  active: boolean
  done: boolean
  tabIndex: number
  focus: boolean
}

export type ConnectionGrid = (Direction | null)[][]

export interface GameState {
  score: number
  moves: number
  status: string
  lastMoveId: number | null
  wrongMove: boolean
  ended: boolean
  tiles: TileState[][]
  connections: ConnectionGrid
  activeNodes: number[]
  maxScore: number
  totalValue: number
  tileSize: number | undefined
  error: string | null
}
