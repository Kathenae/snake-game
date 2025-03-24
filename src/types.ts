export interface Position {
  x: number;
  y: number;
  color?: string; // Optional color property
}

export interface GameState {
  snake: Position[];
  snakeColors: string[];
  targetFood: string,
  food: Position[];
  score: number;
  dx: number;
  dy: number;
  highScore: number;
}

export interface PlayerState {
  id: string;
  snake: Position[];
  snakeColors: string[];
  score: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right' | 'stop';

export interface ServerMessage {
  type: 'init' | 'gameState' | 'gameOver' | 'playerLeft';
  playerId?: string;
  gameState?: GameState;
  players?: PlayerState[];
  food?: Position[];
  targetFood?: string;
  score?: number;
}

export interface ClientMessage {
  type: 'direction';
  direction: Direction;
}

export interface GameScreen {
  show: () => void;
  hide: () => void;
  updateScore: (score: number) => void;
  updateHighScore: (score: number) => void;
}