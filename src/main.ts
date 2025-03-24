import './style.css';
import { Position, GameState, GameScreen } from './types';

class GameOverScreen implements GameScreen {
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
    this.finalScoreElement.textContent = score.toString();
  }

  updateHighScore(score: number): void {
    this.highScoreElement.textContent = score.toString();
  }
}

class SnakeGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scoreElement: HTMLElement;
  private startButton: HTMLElement;
  private gameOverScreen: GameScreen;
  
  private gridSize: number = 20;
  private tileCount: number = 40;
  private gameState: GameState;
  private gameInterval: number | null = null;
  
  constructor() {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    const scoreElement = document.getElementById('scoreElement');
    const startButton = document.getElementById('startButton');
    
    if (!canvas || !ctx || !scoreElement || !startButton) {
      throw new Error('Required DOM elements not found');
    }
    
    this.canvas = canvas as HTMLCanvasElement;
    this.ctx = ctx;
    this.scoreElement = scoreElement;
    this.startButton = startButton;
    
    this.gameState = {
      snake: [],
      snakeColors: [],
      targetFood: '#FF4136',
      food: [],
      score: 0,
      dx: 0,
      dy: 0,
      highScore: parseInt(localStorage.getItem('snakeHighScore') || '0', 10)
    };

    this.gameOverScreen = new GameOverScreen(() => this.startGame());
    this.gameOverScreen.updateHighScore(this.gameState.highScore);
    
    this.startButton.addEventListener('click', () => this.startGame());
    document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    window.addEventListener('resize', () => this.handleResize());
    this.handleResize();
  }

  private handleResize(): void {
    const padding = 32; // Account for container padding
    const maxWidth = window.innerWidth - padding * 2;
    const maxHeight = window.innerHeight - 150; // Account for header and controls
    
    const size = Math.min(maxWidth, maxHeight);
    this.canvas.width = size;
    this.canvas.height = size;
    
    // Adjust grid size based on canvas size
    this.gridSize = size / this.tileCount;
    
    if (this.gameInterval) {
      this.draw(); // Redraw if game is running
    }
  }

  private startGame(): void {
    this.gameState = {
      snake: [{ x: 10, y: 10 }],
      snakeColors: ['#4CAF50'],
      targetFood: '#FF4136',
      food: [],
      score: 0,
      dx: 1,
      dy: 0,
      highScore: this.gameState.highScore
    };
    
    this.scoreElement.textContent = this.gameState.score.toString();
    this.generateFood(10);
    this.updateTargetFood();
    
    if (this.gameInterval) {
      window.clearInterval(this.gameInterval);
    }
    
    this.gameInterval = window.setInterval(() => this.gameLoop(), 100);
    this.startButton.textContent = 'Restart Game';
  }

  private generateFood(count: number): void {
    const colors = ['#FF4136', '#FFDC00', '#0074D9', '#2ECC40', '#B10DC9'];
    
    for (let i = 0; i < count; i++) {
      const newFood: Position = {
        x: Math.floor(Math.random() * this.tileCount),
        y: Math.floor(Math.random() * this.tileCount),
        color: colors[Math.floor(Math.random() * colors.length)] // Random color from the array
      };
      
      const isOnSnake = this.gameState.snake.some(
        segment => segment.x === newFood.x && segment.y === newFood.y
      );
      
      if (isOnSnake) {
        this.generateFood(1);
      } else {
        this.gameState.food.push(newFood);
      }
    }
  }

  private handleKeyPress(e: KeyboardEvent): void {
    switch(e.key) {
      case 'ArrowUp':
        if (this.gameState.dy !== 1) {
          this.gameState.dx = 0;
          this.gameState.dy = -1;
        }
        break;
      case 'ArrowDown':
        if (this.gameState.dy !== -1) {
          this.gameState.dx = 0;
          this.gameState.dy = 1;
        }
        break;
      case 'ArrowLeft':
        if (this.gameState.dx !== 1) {
          this.gameState.dx = -1;
          this.gameState.dy = 0;
        }
        break;
      case 'ArrowRight':
        if (this.gameState.dx !== -1) {
          this.gameState.dx = 1;
          this.gameState.dy = 0;
        }
        break;
    }
  }

  private gameLoop(): void {
    const head: Position = {
      x: this.gameState.snake[0].x + this.gameState.dx,
      y: this.gameState.snake[0].y + this.gameState.dy
    };
    
    // Check wall collision
    if (head.x < 0 || head.x >= this.tileCount || head.y < 0 || head.y >= this.tileCount) {
      this.gameOver();
      return;
    }
    
    // Check self collision
    if (this.gameState.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
      this.gameOver();
      return;
    }
    
    this.gameState.snake.unshift(head);
    
    let pop = true;
    for (let i = 0; i < this.gameState.food.length; i++) {
      const food = this.gameState.food[i];
      // Check food collision
      if (head.x === food.x && head.y === food.y) {
        this.gameState.food = this.gameState.food.filter(f => !(f.x == food.x && f.y == food.y))

        if(food.color == this.gameState.targetFood) {
          this.gameState.score += 10;
          this.scoreElement.textContent = this.gameState.score.toString();
          if(Math.random() > 0.2) {
            this.generateFood(1 + Math.floor(Math.random() * 2));
          }
          this.gameState.snakeColors.push(food.color!)
          pop = false
          this.updateTargetFood()
        } else if (this.gameState.snake.length > 2){
          this.gameState.snake.pop()
          this.gameState.snakeColors.pop()
          this.gameState.score -= 10;
          this.scoreElement.textContent = this.gameState.score.toString();
        }
      }
    }

    if (pop) {
      this.gameState.snake.pop();
    }
    
    this.draw();
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
    
    // Draw snake
    for (let i = 0; i < this.gameState.snake.length; i++) {
      const segment = this.gameState.snake[i];
      const color = this.gameState.snakeColors[i]; // Get color for the segment
      this.ctx.fillStyle = color;
  
      this.ctx.fillRect(
        segment.x * this.gridSize + 1,
        segment.y * this.gridSize + 1,
        this.gridSize - 2,
        this.gridSize - 2
      );
    }
    
    // Draw snake head with different color
    if (this.gameState.snake.length > 0) {
      this.ctx.fillStyle = '#45a049';
      const head = this.gameState.snake[0];
      this.ctx.fillRect(
        head.x * this.gridSize + 1,
        head.y * this.gridSize + 1,
        this.gridSize - 2,
        this.gridSize - 2
      );
    }
    
    // Draw food
    for (let i = 0; i < this.gameState.food.length; i++) {
      const food = this.gameState.food[i];
      this.ctx.fillStyle = food.color ?? '#FF4136';
      this.ctx.beginPath();
      const centerX = food.x * this.gridSize + this.gridSize / 2;
      const centerY = food.y * this.gridSize + this.gridSize / 2;
      this.ctx.arc(centerX, centerY, (this.gridSize - 4) / 2, 0, Math.PI * 2);
      this.ctx.fill(); 
    }
  }

  private gameOver(): void {
    if (this.gameInterval) {
      window.clearInterval(this.gameInterval);
      this.gameInterval = null;
    }

    if (this.gameState.score > this.gameState.highScore) {
      this.gameState.highScore = this.gameState.score;
      localStorage.setItem('snakeHighScore', this.gameState.highScore.toString());
      this.gameOverScreen.updateHighScore(this.gameState.highScore);
    }

    this.gameOverScreen.updateScore(this.gameState.score);
    this.gameOverScreen.show();
    this.startButton.textContent = 'Start Game';
  }

  private updateTargetFood(): void {
    this.gameState.targetFood = this.gameState.food[Math.floor(Math.random() * this.gameState.food.length)].color!
    const nextFoodColorElement = document.getElementById('nextFoodColor') as HTMLElement;
    nextFoodColorElement.style.backgroundColor = this.gameState.targetFood;
  }
}

// Initialize the game
new SnakeGame();