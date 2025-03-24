import './style.css';
import { Position } from './types';

interface PlayerState {
  id: string;
  snake: Position[];
  snakeColors: string[];
  score: number;
}

class SnakeGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scoreElement: HTMLElement;
  private startButton: HTMLElement;
  private gameOverScreen: GameOverScreen;
  private playerScoresList: HTMLElement;
  private ws: WebSocket | null = null;
  private playerId: string | null = null;
  private players: Map<string, PlayerState> = new Map();
  private food: Position[] = [];
  private targetFood: string = '#FF4136';
  private pressedKeys: Set<string> = new Set();
  private lastDirection: string | null = null;
  
  private gridSize: number = 20;
  private tileCount: number = 40;
  private gameInterval: number | null = null;
  
  constructor() {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    const scoreElement = document.getElementById('scoreElement');
    const startButton = document.getElementById('startButton');
    const playerScoresList = document.getElementById('playerScoresList');
    
    if (!canvas || !ctx || !scoreElement || !startButton || !playerScoresList) {
      throw new Error('Required DOM elements not found');
    }
    
    this.canvas = canvas;
    this.ctx = ctx;
    this.scoreElement = scoreElement;
    this.startButton = startButton;
    this.playerScoresList = playerScoresList;
    
    this.gameOverScreen = new GameOverScreen(() => this.startGame());
    this.gameOverScreen.updateHighScore(this.getHighscore());
    
    this.startButton.addEventListener('click', () => this.startGame());
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    window.addEventListener('resize', () => this.handleResize());
    this.handleResize();
  }

  private handleResize(): void {
    const padding = 32;
    const maxWidth = window.innerWidth - padding * 2;
    const maxHeight = window.innerHeight - 150;
    
    const size = Math.min(maxWidth, maxHeight);
    this.canvas.width = size;
    this.canvas.height = size;
    
    this.gridSize = size / this.tileCount;
    
    if (this.gameInterval) {
      this.draw();
    }
  }

  private startGame(): void {
    if (this.ws) {
      this.ws.close();
    }
    
    this.ws = new WebSocket('ws://localhost:3000');
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'init':
          this.playerId = data.playerId;
          this.players.set(data.playerId, {
            id: data.playerId,
            snake: data.gameState.snake,
            snakeColors: data.gameState.snakeColors,
            score: data.gameState.score
          });
          this.food = data.gameState.food;
          this.targetFood = data.gameState.targetFood;
          this.updateTargetFood();
          break;
          
        case 'gameState':
          this.players.clear();
          data.players.forEach((player: PlayerState) => {
            this.players.set(player.id, player);
          });
          this.food = data.food;
          this.targetFood = data.targetFood;
          this.updateScore();
          this.updateTargetFood();
          break;
          
        case 'gameOver':
          this.endGame();
          this.gameOver(data.score);
          break;
          
        case 'playerLeft':
          this.players.delete(data.playerId);
          this.updatePlayerScores();
          break;
      }
    };
    
    this.ws.onclose = () => {
      this.endGame()
    };
    
    // Start the game loop for rendering
    if (this.gameInterval) {
      window.clearInterval(this.gameInterval);
    }
    this.gameInterval = window.setInterval(() => this.draw(), 1000 / 60); // 60 FPS
    
    this.startButton.textContent = 'Restart Game';
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.ws) return;
    
    const key = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      e.preventDefault(); // Prevent scrolling
      this.pressedKeys.add(key);
      this.updateMovement();
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (!this.ws) return;
    
    const key = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      this.pressedKeys.delete(key);
      this.updateMovement();
    }
  }

  private updateMovement(): void {
    if (!this.ws) return;
    
    let direction: string | null = null;
    
    // Get the most recently pressed direction
    if (this.pressedKeys.has('arrowup')) direction = 'up';
    else if (this.pressedKeys.has('arrowdown')) direction = 'down';
    else if (this.pressedKeys.has('arrowleft')) direction = 'left';
    else if (this.pressedKeys.has('arrowright')) direction = 'right';
    
    // Only send update if direction changed and there is a direction
    if (direction !== this.lastDirection && direction !== null) {
      this.lastDirection = direction;
      this.ws.send(JSON.stringify({
        type: 'direction',
        direction: direction
      }));
    }
  }

  private updateScore(): void {
    if (this.playerId) {
      const player = this.players.get(this.playerId);
      if (player) {
        this.scoreElement.textContent = player.score.toString();
        const highScore = this.getHighscore();
        this.updateScoreProgress(player.score, highScore);

      }
    }
    this.updatePlayerScores();
  }

  private updatePlayerScores(): void {
    this.playerScoresList.innerHTML = '';
    
    // Convert players map to array and sort by score
    const sortedPlayers = Array.from(this.players.values())
      .sort((a, b) => b.score - a.score);
    
    sortedPlayers.forEach(player => {
      const playerElement = document.createElement('div');
      playerElement.className = `player-score-item ${player.id === this.playerId ? 'current-player' : ''}`;
      
      const nameElement = document.createElement('span');
      nameElement.textContent = player.id === this.playerId ? 'You' : `Player ${player.id.slice(0, 4)}`;
      
      const scoreElement = document.createElement('span');
      scoreElement.textContent = player.score.toString();
      
      playerElement.appendChild(nameElement);
      playerElement.appendChild(scoreElement);
      this.playerScoresList.appendChild(playerElement);
    });
  }

  private updateScoreProgress(score: number, highscore: number) {
    const scoreProgressBar = document.getElementById("score-progress-bar")
    if (scoreProgressBar) {
      const percent =  score / highscore
      scoreProgressBar.style.width = `${percent * 100}%`
    }
  }

  private draw(): void {
    // Clear canvas
    this.ctx.fillStyle = '#2a2a2a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw grid
    this.ctx.strokeStyle = '#333333';
    this.ctx.lineWidth = 0.5;
    
    for (let i = 0; i <= this.tileCount; i++) {
      const pos = i * this.gridSize;
      this.ctx.beginPath();
      this.ctx.moveTo(pos, 0);
      this.ctx.lineTo(pos, this.canvas.height);
      this.ctx.stroke();
      
      this.ctx.beginPath();
      this.ctx.moveTo(0, pos);
      this.ctx.lineTo(this.canvas.width, pos);
      this.ctx.stroke();
    }
    
    // Draw all players
    for (const player of this.players.values()) {
      // Draw snake body
      for (let i = 1; i < player.snake.length; i++) {
        const segment = player.snake[i];
        const color = player.snakeColors[i] || player.snakeColors[0];
        this.ctx.fillStyle = color;
        
        this.ctx.fillRect(
          segment.x * this.gridSize + 1,
          segment.y * this.gridSize + 1,
          this.gridSize - 2,
          this.gridSize - 2
        );

        // Only draw stroke for player's own snake
        if (player.id === this.playerId) {
          this.ctx.strokeStyle = "#fff";
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(
            segment.x * this.gridSize + 1,
            segment.y * this.gridSize + 1,
            this.gridSize - 2,
            this.gridSize - 2
          );
        }
      }
      
      // Draw snake head
      if (player.snake.length > 0) {
        const head = player.snake[0];
        this.ctx.fillStyle = this.targetFood;
        
        this.ctx.fillRect(
          head.x * this.gridSize + 1,
          head.y * this.gridSize + 1,
          this.gridSize - 2,
          this.gridSize - 2
        );
        
        // Only draw stroke for player's own snake head
        if (player.id === this.playerId) {
          this.ctx.strokeStyle = "#fff";
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(
            head.x * this.gridSize + 1,
            head.y * this.gridSize + 1,
            this.gridSize - 2,
            this.gridSize - 2
          );
        }
      }
    }
    
    // Draw food
    for (const food of this.food) {
      this.ctx.fillStyle = food.color ?? '#FF4136';
      this.ctx.beginPath();
      const centerX = food.x * this.gridSize + this.gridSize / 2;
      const centerY = food.y * this.gridSize + this.gridSize / 2;
      this.ctx.arc(centerX, centerY, (this.gridSize - 4) / 2, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private endGame() {
    if (this.gameInterval) {
      window.clearInterval(this.gameInterval);
      this.gameInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private gameOver(score: number): void {
    
    const highScore = this.getHighscore();
    if (score > highScore) {
      localStorage.setItem('snakeHighScore', score.toString());
      this.gameOverScreen.updateHighScore(score);
    }
    
    this.gameOverScreen.updateScore(score);
    this.gameOverScreen.show();
    this.startButton.textContent = 'Start Game';
  }

  private updateTargetFood(): void {
    const nextFoodColorElement = document.getElementById('nextFoodColor') as HTMLElement;
    if (nextFoodColorElement) {
      nextFoodColorElement.style.backgroundColor = this.targetFood;
    }
  }

  getHighscore(): number {
    return parseInt(localStorage.getItem('snakeHighScore') || '0', 10);
  }
}

class GameOverScreen {
  private element: HTMLElement;
  private finalScoreElement: HTMLElement;
  private highScoreElement: HTMLElement;
  private restartButton: HTMLElement;
  private onRestart: () => void;

  constructor(onRestart: () => void) {
    const element = document.getElementById('gameOverScreen');
    const finalScoreElement = document.getElementById('finalScore');
    const highScoreElement = document.getElementById('highScore');
    const restartButton = document.getElementById('restartButton');

    if (!element || !finalScoreElement || !highScoreElement || !restartButton) {
      throw new Error('Required game over screen elements not found');
    }

    this.element = element;
    this.finalScoreElement = finalScoreElement;
    this.highScoreElement = highScoreElement;
    this.restartButton = restartButton;
    this.onRestart = onRestart;

    this.restartButton.addEventListener('click', () => {
      this.hide();
      this.onRestart();
    });
  }

  show(): void {
    this.element.classList.add('visible');
  }

  hide(): void {
    this.element.classList.remove('visible');
  }

  updateScore(score: number): void {
    console.log(score)
    this.finalScoreElement.textContent = score.toString();
  }

  updateHighScore(score: number): void {
    this.highScoreElement.textContent = score.toString();
  }
}

// Initialize the game
new SnakeGame();