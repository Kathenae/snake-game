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

export interface GameScreen {
  show: () => void;
  hide: () => void;
  updateScore: (score: number) => void;
  updateHighScore: (score: number) => void;
}