import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer } from 'http';
import { Position, GameState, ClientMessage, Direction } from '../src/types';
import { config } from "./config";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

interface Player {
  id: string;
  ws: WebSocket;
  gameState: GameState;
  lastInputTime: number;
}

const players = new Map<string, Player>();
const colors = ['#4CAF50', '#FF4136', '#0074D9', '#FFDC00', '#B10DC9'];
let globalFood: Position[] = [];
let globalTargetFood: string = '#FF4136';

// Game configuration
const GAME_TICK_RATE = 1000 / config.TICK_RATE_FPS;
const MOVEMENT_INTERVAL = config.MOVEMENT_INTERVAL;
const INPUT_RATE_LIMIT = config.INPUT_RATE_LIMIT;
let lastMovementTime = 0;

// Input validation
function isValidDirection(direction: string): direction is Direction {
  return ['up', 'down', 'left', 'right'].includes(direction);
}

function isValidPosition(pos: Position, tileCount: number): boolean {
  return (
    typeof pos.x === 'number' &&
    typeof pos.y === 'number' &&
    pos.x >= 0 &&
    pos.x < tileCount &&
    pos.y >= 0 &&
    pos.y < tileCount
  );
}

function validateClientMessage(message: unknown): message is ClientMessage {
  if (!message || typeof message !== 'object') return false;
  
  const msg = message as Partial<ClientMessage>;
  if (msg.type !== 'direction') return false;
  
  return msg.direction !== undefined && isValidDirection(msg.direction);
}

function generateFood(count: number, tileCount: number): Position[] {
  const food: Position[] = [];
  const colors = ['#FF4136', '#FFDC00', '#0074D9'];
  
  for (let i = 0; i < count; i++) {
    const newFood: Position = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
      color: colors[Math.floor(Math.random() * colors.length)]
    };
    
    // Check if food is on any snake
    let isOnSnake = false;
    for (const player of players.values()) {
      if (player.gameState.snake.some(segment => 
        segment.x === newFood.x && segment.y === newFood.y
      )) {
        isOnSnake = true;
        break;
      }
    }
    
    if (!isOnSnake) {
      food.push(newFood);
    }
  }
  return food;
}

function createInitialGameState(): GameState {
  return {
    snake: [{ x: 10, y: 10 }],
    snakeColors: ['#4CAF50'],
    targetFood: globalTargetFood,
    food: globalFood,
    score: 0,
    dx: 1,
    dy: 0,
    highScore: 0
  };
}

function broadcastGameState() {
  const gameState = {
    type: 'gameState',
    players: Array.from(players.entries()).map(([id, p]) => ({
      id,
      snake: p.gameState.snake,
      snakeColors: p.gameState.snakeColors,
      score: p.gameState.score
    })),
    food: globalFood,
    targetFood: globalTargetFood
  };
  
  for (const p of players.values()) {
    p.ws.send(JSON.stringify(gameState));
  }
}

function gameLoop() {
  const currentTime = Date.now();
  const tileCount = 40;
  
  // Generate initial food if none exists
  if (globalFood.length === 0) {
    globalFood = generateFood(10, tileCount);
    globalTargetFood = globalFood[Math.floor(Math.random() * globalFood.length)].color!;
  }
  
  // Only update positions if enough time has passed
  if (currentTime - lastMovementTime >= MOVEMENT_INTERVAL) {
    lastMovementTime = currentTime;
    
    for (const [playerId, player] of players) {
      const state = player.gameState;
      
      // Skip movement if player is stopped
      if (state.dx === 0 && state.dy === 0) {
        continue;
      }
      
      // Validate current position
      if (!isValidPosition(state.snake[0], tileCount)) {
        player.ws.send(JSON.stringify({ type: 'gameOver', score: state.score }));
        continue;
      }
      
      const head: Position = {
        x: state.snake[0].x + state.dx,
        y: state.snake[0].y + state.dy
      };
      
      // Validate new position
      if (!isValidPosition(head, tileCount)) {
        player.ws.send(JSON.stringify({ type: 'gameOver', score: state.score }));
        continue;
      }
      
      // Check self collision
      if (state.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        player.ws.send(JSON.stringify({ type: 'gameOver', score: state.score }));
        continue;
      }
      
      // Check collision with other players
      let collisionWithOtherPlayer = false;
      for (const [otherId, otherPlayer] of players) {
        if (otherId !== playerId) {
          if (otherPlayer.gameState.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
            player.ws.send(JSON.stringify({ type: 'gameOver', score: state.score }));
            collisionWithOtherPlayer = true;
            break;
          }
        }
      }
      
      if (collisionWithOtherPlayer) continue;
      
      state.snake.unshift(head);
      
      let pop = true;
      for (let i = 0; i < globalFood.length; i++) {
        const food = globalFood[i];
        if (head.x === food.x && head.y === food.y) {
          globalFood = globalFood.filter(f => !(f.x === food.x && f.y === food.y));
          
          if (food.color === globalTargetFood) {
            state.score += 10;
            if (Math.random() > 0.2) {
              globalFood.push(...generateFood(1 + Math.floor(Math.random() * 2), tileCount));
            }
            state.snakeColors.push(food.color!);
            pop = false;
            globalTargetFood = globalFood[Math.floor(Math.random() * globalFood.length)].color!;
          } else if (state.snake.length > 2) {
            state.snake.pop();
            state.snakeColors.pop();
            state.score -= 10;
          }
        }
      }
      
      if (pop) {
        state.snake.pop();
      }
    }
  }
  
  // Always broadcast game state for smooth rendering
  broadcastGameState();
}

// Start game loop with higher frequency for smooth rendering
setInterval(gameLoop, GAME_TICK_RATE);

wss.on('connection', (ws: WebSocket) => {
  const playerId = Math.random().toString(36).substring(7);
  const player: Player = {
    id: playerId,
    ws,
    gameState: createInitialGameState(),
    lastInputTime: 0
  };
  
  players.set(playerId, player);
  
  // Send initial game state to the new player
  ws.send(JSON.stringify({
    type: 'init',
    playerId,
    gameState: player.gameState
  }));
  
  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message);
      
      // Validate message format and rate limit
      if (!validateClientMessage(data)) {
        console.warn(`Invalid message format from player ${playerId}`);
        return;
      }
      
      const currentTime = Date.now();
      if (currentTime - player.lastInputTime < INPUT_RATE_LIMIT) {
        console.warn(`Input rate limit exceeded for player ${playerId}`);
        return;
      }
      player.lastInputTime = currentTime;
      
      // Process valid direction input
      if (data.type === 'direction') {
        const player = players.get(playerId);
        if (player) {
          const currentDx = player.gameState.dx;
          const currentDy = player.gameState.dy;
          
          switch(data.direction) {
            case 'up':
              if (currentDy !== 1) {
                player.gameState.dx = 0;
                player.gameState.dy = -1;
              }
              break;
            case 'down':
              if (currentDy !== -1) {
                player.gameState.dx = 0;
                player.gameState.dy = 1;
              }
              break;
            case 'left':
              if (currentDx !== 1) {
                player.gameState.dx = -1;
                player.gameState.dy = 0;
              }
              break;
            case 'right':
              if (currentDx !== -1) {
                player.gameState.dx = 1;
                player.gameState.dy = 0;
              }
              break;
          }
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  ws.on('close', () => {
    players.delete(playerId);
    // Notify remaining players about the disconnection
    for (const p of players.values()) {
      p.ws.send(JSON.stringify({
        type: 'playerLeft',
        playerId
      }));
    }
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for player ${playerId}:`, error);
    players.delete(playerId);
  });
});

const PORT = config.PORT;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 