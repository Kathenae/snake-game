import './style.css';

class SnakeGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.scoreElement = document.getElementById('scoreElement');
    this.startButton = document.getElementById('startButton');
    
    this.gridSize = 20;
    this.tileCount = 20;
    this.snake = [];
    this.food = { x: 10, y: 10 };
    this.score = 0;
    this.dx = 0;
    this.dy = 0;
    this.gameInterval = null;
    
    this.startButton.addEventListener('click', () => this.startGame());
    document.addEventListener('keydown', (e) => this.handleKeyPress(e));
  }

  startGame() {
    this.snake = [{ x: 10, y: 10 }];
    this.score = 0;
    this.dx = 1;
    this.dy = 0;
    this.scoreElement.textContent = this.score;
    this.generateFood();
    
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
    }
    
    this.gameInterval = setInterval(() => this.gameLoop(), 100);
    this.startButton.textContent = 'Restart Game';
  }

  generateFood() {
    this.food = {
      x: Math.floor(Math.random() * this.tileCount),
      y: Math.floor(Math.random() * this.tileCount)
    };
    
    // Make sure food doesn't spawn on snake
    for (let segment of this.snake) {
      if (segment.x === this.food.x && segment.y === this.food.y) {
        this.generateFood();
        break;
      }
    }
  }

  handleKeyPress(e) {
    switch(e.key) {
      case 'ArrowUp':
        if (this.dy !== 1) {
          this.dx = 0;
          this.dy = -1;
        }
        break;
      case 'ArrowDown':
        if (this.dy !== -1) {
          this.dx = 0;
          this.dy = 1;
        }
        break;
      case 'ArrowLeft':
        if (this.dx !== 1) {
          this.dx = -1;
          this.dy = 0;
        }
        break;
      case 'ArrowRight':
        if (this.dx !== -1) {
          this.dx = 1;
          this.dy = 0;
        }
        break;
    }
  }

  gameLoop() {
    // Move snake
    const head = { x: this.snake[0].x + this.dx, y: this.snake[0].y + this.dy };
    
    // Check wall collision
    if (head.x < 0 || head.x >= this.tileCount || head.y < 0 || head.y >= this.tileCount) {
      this.gameOver();
      return;
    }
    
    // Check self collision
    for (let segment of this.snake) {
      if (head.x === segment.x && head.y === segment.y) {
        this.gameOver();
        return;
      }
    }
    
    this.snake.unshift(head);
    
    // Check food collision
    if (head.x === this.food.x && head.y === this.food.y) {
      this.score += 10;
      this.scoreElement.textContent = this.score;
      this.generateFood();
    } else {
      this.snake.pop();
    }
    
    this.draw();
  }

  draw() {
    // Clear canvas
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw snake
    this.ctx.fillStyle = '#4CAF50';
    for (let segment of this.snake) {
      this.ctx.fillRect(
        segment.x * this.gridSize,
        segment.y * this.gridSize,
        this.gridSize - 2,
        this.gridSize - 2
      );
    }
    
    // Draw food
    this.ctx.fillStyle = '#FF4136';
    this.ctx.fillRect(
      this.food.x * this.gridSize,
      this.food.y * this.gridSize,
      this.gridSize - 2,
      this.gridSize - 2
    );
  }

  gameOver() {
    clearInterval(this.gameInterval);
    alert(`Game Over! Score: ${this.score}`);
    this.startButton.textContent = 'Start Game';
  }
}

// Initialize the game
const game = new SnakeGame();