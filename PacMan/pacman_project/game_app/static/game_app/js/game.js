// game_app/static/game_app/js/game.js

// =================================================================
// Django/API Helper Functions
// =================================================================

// Helper function to get Django's CSRF token from cookies
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Function to handle saving the score to the Django backend
async function saveScoreToBackend(score, level) {
    // Prompt the user for a name
    const playerName = prompt("Game Over! Enter your name for the High Score board:", "PacFan");
    if (!playerName) return;

    const data = {
        player_name: playerName,
        score: score,
        level: level
    };

    try {
        const response = await fetch('/api/scores/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Attach the CSRF token - essential for Django POST security
                'X-CSRFToken': getCookie('csrftoken') 
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            console.log("Score saved successfully!");
        } else {
            console.error("Failed to save score:", response.status, await response.json());
        }
    } catch (error) {
        console.error("Error connecting to backend:", error);
    }
}


// =================================================================
// Global Settings
// =================================================================
const CELL_SIZE = 32;
const MAX_MAZE_COLUMNS = 30;
const MAX_MAZE_ROWS = 22;

const SCREEN_WIDTH = MAX_MAZE_COLUMNS * CELL_SIZE;
const SCREEN_HEIGHT = MAX_MAZE_ROWS * CELL_SIZE;

const GRID_WIDTH = MAX_MAZE_COLUMNS;
const GRID_HEIGHT = MAX_MAZE_ROWS;

const MAX_LEVEL = 4;

// Colors
const BLACK = '#000000';
const WHITE = '#ffffff';
const YELLOW = '#ffff00';
const RED = '#ff0000';
const BLUE = '#0000ff';
const PINK = '#ffc0cb';
const CYAN = '#00ffff';

// Game constants
const LEVEL_CLEARED_DURATION = 60 * 2; // 2 seconds at 60 FPS

// =================================================================
// Helper Functions (Pathfinding)
// =================================================================

/**
 * Returns valid neighbors for a given node, considering maze wraparound.
 */
function getNeighborsWithWraparound(grid, node) {
    const [x, y] = node;
    const neighbors = [];
    const rows = grid.length;
    const cols = grid[0].length;

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let newX = x + dx;
        let newY = y + dy;

        // Apply wraparound logic
        newX = (newX + cols) % cols;
        newY = (newY + rows) % rows;

        // Check if the new position is a path (0)
        if (grid[newY][newX] === 0) {
            neighbors.push([newX, newY]);
        }
    }
    return neighbors;
}

/**
 * Breadth-First Search (BFS) pathfinding.
 */
function bfs(grid, start, goal) {
    const startKey = `${start[0]},${start[1]}`;
    const goalKey = `${goal[0]},${goal[1]}`;
    
    if (startKey === goalKey) return [];

    const queue = [[start[0], start[1]]]; 
    const parent = new Map();
    parent.set(startKey, null);

    while (queue.length > 0) {
        const current = queue.shift();
        const currentKey = `${current[0]},${current[1]}`;

        if (currentKey === goalKey) {
            const path = [];
            let temp = current;
            while (parent.get(`${temp[0]},${temp[1]}`) !== null) {
                path.push(temp);
                const parentKey = parent.get(`${temp[0]},${temp[1]}`);
                const [px, py] = parentKey.split(',').map(Number);
                temp = [px, py];
            }
            path.reverse();
            return path;
        }

        for (const neighbor of getNeighborsWithWraparound(grid, current)) {
            const neighborKey = `${neighbor[0]},${neighbor[1]}`;
            if (!parent.has(neighborKey)) {
                parent.set(neighborKey, currentKey);
                queue.push(neighbor);
            }
        }
    }
    return [];
}

/**
 * Calculates Manhattan distance heuristic, considering wraparound.
 */
function manhattanDistance(pos1, pos2) {
    let dx = Math.abs(pos1[0] - pos2[0]);
    let dy = Math.abs(pos1[1] - pos2[1]);

    // Wraparound check
    dx = Math.min(dx, GRID_WIDTH - dx);
    dy = Math.min(dy, GRID_HEIGHT - dy);

    return dx + dy;
}
 
/**
 * Optimized Min-Heap Pop: Finds the element with the lowest f_score and removes it.
 */
const heappop = (heap) => {
    let bestIndex = 0;
    for (let i = 1; i < heap.length; i++) {
        if (heap[i][0] < heap[bestIndex][0]) {
            bestIndex = i;
        }
    }
    return heap.splice(bestIndex, 1)[0];
};
 
const heappush = (heap, element) => heap.push(element);

/**
 * A* Search pathfinding (FIXED for ghost movement).
 */
function astar(grid, start, goal) {
    const startKey = `${start[0]},${start[1]}`;
    const goalKey = `${goal[0]},${goal[1]}`;
    
    if (startKey === goalKey) return [];

    const pq = [[manhattanDistance(start, goal), startKey]];
    const gScore = new Map();
    const cameFrom = new Map();
    
    for (let r = 0; r < GRID_HEIGHT; r++) {
        for (let c = 0; c < GRID_WIDTH; c++) {
            const key = `${c},${r}`;
            if (grid[r][c] === 0) {
                gScore.set(key, Infinity);
            }
        }
    }
    gScore.set(startKey, 0);

    while (pq.length > 0) {
        const [fCost, currentKey] = heappop(pq);
        const [currentX, currentY] = currentKey.split(',').map(Number);
        const current = [currentX, currentY];

        if (fCost > gScore.get(currentKey) + manhattanDistance(current, goal)) {
            continue;
        }

        if (currentKey === goalKey) {
            const path = [];
            let tempKey = currentKey;
            
            while (cameFrom.has(tempKey) && cameFrom.get(tempKey) !== startKey) {
                const [tx, ty] = tempKey.split(',').map(Number);
                path.push([tx, ty]);
                tempKey = cameFrom.get(tempKey);
            }
            
            if (cameFrom.get(tempKey) === startKey) {
                 const [tx, ty] = tempKey.split(',').map(Number);
                 path.push([tx, ty]);
            }
            
            path.reverse();
            return path;
        }

        for (const neighbor of getNeighborsWithWraparound(grid, current)) {
            const neighborKey = `${neighbor[0]},${neighbor[1]}`;
            
            const tentativeGScore = gScore.get(currentKey) + 1;
            const neighborGScore = gScore.has(neighborKey) ? gScore.get(neighborKey) : Infinity;

            if (tentativeGScore < neighborGScore) {
                cameFrom.set(neighborKey, currentKey);
                gScore.set(neighborKey, tentativeGScore);
                
                const hCost = manhattanDistance(neighbor, goal);
                const newFCost = tentativeGScore + hCost;
                
                heappush(pq, [newFCost, neighborKey]);
            }
        }
    }
    return [];
}


// =================================================================
// Game Entities and Logic
// =================================================================

class Maze {
    constructor() {
        this.grid = [];
    }

    /** Generates a new maze based on the level difficulty. */
    generate(level) {
        this.grid = Array(GRID_HEIGHT).fill(0).map(() => Array(GRID_WIDTH).fill(0));

        const wallsSet = new Set();
        
        const addWall = (x, y) => {
            if (0 <= x && x < GRID_WIDTH && 0 <= y && y < GRID_HEIGHT) {
                const key = `${x},${y}`;
                if (!wallsSet.has(key)) {
                    wallsSet.add(key);
                    this.grid[y][x] = 1;
                }
            }
        };

        // 2. Add Boundary Walls
        for (let x = 0; x < GRID_WIDTH; x++) {
            addWall(x, 0); 
            addWall(x, GRID_HEIGHT - 1);
        }
        for (let y = 0; y < GRID_HEIGHT; y++) {
            addWall(0, y); 
            addWall(GRID_WIDTH - 1, y);
        }

        // 3. Generate Internal Walls based on level difficulty
        const numWalls = level * 20; 
        
        for (let i = 0; i < numWalls / 2; i++) {
            let startX = Math.floor(Math.random() * (GRID_WIDTH - 6)) + 2;
            let startY = Math.floor(Math.random() * (GRID_HEIGHT - 6)) + 2;
            
            const blockWidth = Math.floor(Math.random() * 3) + 1;
            const blockHeight = Math.floor(Math.random() * 2) + 1;
            
            for (let bx = startX; bx < startX + blockWidth; bx++) {
                for (let by = startY; by < startY + blockHeight; by++) {
                    if (1 <= bx && bx < GRID_WIDTH - 1 && 1 <= by && by < GRID_HEIGHT - 1) {
                        addWall(bx, by);
                    }
                }
            }
        }

        // 4. Create Tunnels (simple left/right)
        const tunnelRow = Math.floor(GRID_HEIGHT / 2);
        this.grid[tunnelRow][0] = 0;
        this.grid[tunnelRow][GRID_WIDTH - 1] = 0;
    }

    isWall(x, y) {
        if (0 <= y && y < GRID_HEIGHT && 0 <= x && x < GRID_WIDTH) {
            return this.grid[y][x] === 1;
        }
        return true;
    }

    draw(ctx) {
        ctx.strokeStyle = BLUE;
        ctx.lineWidth = 3;

        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                if (this.grid[y][x] === 1) {
                    const wallX = x * CELL_SIZE;
                    const wallY = y * CELL_SIZE;
                    
                    if (y === 0 || this.grid[y - 1][x] === 0) {
                        ctx.beginPath();
                        ctx.moveTo(wallX, wallY);
                        ctx.lineTo(wallX + CELL_SIZE, wallY);
                        ctx.stroke();
                    }
                    if (y === GRID_HEIGHT - 1 || this.grid[y + 1][x] === 0) {
                        ctx.beginPath();
                        ctx.moveTo(wallX, wallY + CELL_SIZE);
                        ctx.lineTo(wallX + CELL_SIZE, wallY + CELL_SIZE);
                        ctx.stroke();
                    }
                    if (x === 0 || this.grid[y][x - 1] === 0) {
                        ctx.beginPath();
                        ctx.moveTo(wallX, wallY);
                        ctx.lineTo(wallX, wallY + CELL_SIZE);
                        ctx.stroke();
                    }
                    if (x === GRID_WIDTH - 1 || this.grid[y][x + 1] === 0) {
                        ctx.beginPath();
                        ctx.moveTo(wallX + CELL_SIZE, wallY);
                        ctx.lineTo(wallX + CELL_SIZE, wallY + CELL_SIZE);
                        ctx.stroke();
                    }
                }
            }
        }
    }
}

class Player {
    constructor(x, y, maze) {
        this.x = x;
        this.y = y;
        this.maze = maze;
        this.radius = CELL_SIZE / 2 - 4;
        
        this.velocity = 0;
        this.lastMoveTime = performance.now();

        this.nextMove = null;
        this.currentDirection = [1, 0];
    }

    handleInput(dx, dy) {
        this.nextMove = [dx, dy];
    }

    move() {
        const currentTime = performance.now();
        const timeElapsed = currentTime - this.lastMoveTime;
        
        const moveIntervalMs = (1 / this.velocity) * 1000;

        if (timeElapsed >= moveIntervalMs) {
            let moveAttemptDir = this.nextMove || this.currentDirection; 
            
            const [dx, dy] = moveAttemptDir;
            
            let newX = this.x + dx;
            let newY = this.y + dy;
            
            let newXWrapped = (newX + GRID_WIDTH) % GRID_WIDTH;
            let newYWrapped = (newY + GRID_HEIGHT) % GRID_HEIGHT;
            
            if (!this.maze.isWall(newXWrapped, newYWrapped)) {
                this.x = newXWrapped;
                this.y = newYWrapped;
                this.currentDirection = [dx, dy];
            }
            
            this.nextMove = null;
            this.lastMoveTime = currentTime;
        }
    }

    update() {
        this.move();
    }

    draw(ctx) {
        const drawX = this.x * CELL_SIZE + CELL_SIZE / 2;
        const drawY = this.y * CELL_SIZE + CELL_SIZE / 2;
        
        let startAngle = 0.25 * Math.PI;
        let endAngle = 1.75 * Math.PI;

        const [dx, dy] = this.currentDirection;

        if (dx === -1) {
            startAngle = 1.25 * Math.PI;
            endAngle = 0.75 * Math.PI;
        } else if (dx === 1) {
            startAngle = 0.25 * Math.PI;
            endAngle = 1.75 * Math.PI;
        } else if (dy === -1) {
            startAngle = 1.75 * Math.PI;
            endAngle = 1.25 * Math.PI;
        } else if (dy === 1) {
            startAngle = 0.75 * Math.PI;
            endAngle = 0.25 * Math.PI;
        }

        const mouthOpenFactor = Math.abs(Math.sin(performance.now() / 150));
        const mouthAngle = 0.15 * Math.PI * mouthOpenFactor;
        
        ctx.fillStyle = YELLOW;
        ctx.beginPath();
        ctx.arc(drawX, drawY, this.radius, startAngle + mouthAngle, endAngle - mouthAngle, false);
        ctx.lineTo(drawX, drawY);
        ctx.closePath();
        ctx.fill();
    }
}

class Ghost {
    constructor(x, y, maze, color, algorithm) {
        this.x = x;
        this.y = y;
        this.maze = maze;
        this.color = color; 
        this.radius = CELL_SIZE / 2 - 2;
        this.path = [];
        this.algorithm = algorithm;
        
        this.velocity = 0;
        this.lastMoveTime = performance.now();
    }

    update(playerPos, algorithmFunc) {
        const currentTime = performance.now();
        const timeElapsed = currentTime - this.lastMoveTime;
        
        const moveIntervalMs = (1 / this.velocity) * 1000;
        
        if (timeElapsed >= moveIntervalMs) {
            this.lastMoveTime = currentTime;

            const startPos = [this.x, this.y];
            
            // 1. Calculate new path
            this.path = algorithmFunc(this.maze.grid, startPos, playerPos);

            // 2. Move to the next tile in the path
            if (this.path.length > 0) {
                const nextPos = this.path[0];
                let newX = nextPos[0];
                let newY = nextPos[1];
                
                newX = (newX + GRID_WIDTH) % GRID_WIDTH;
                newY = (newY + GRID_HEIGHT) % GRID_HEIGHT;
                
                if (!this.maze.isWall(newX, newY)) {
                    this.x = newX;
                    this.y = newY;
                } else {
                    this.path = [];
                }
            }
        }
    }

    draw(ctx) {
        const drawX = this.x * CELL_SIZE;
        const drawY = this.y * CELL_SIZE;
        
        // 1. Draw the path (Visualization)
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = this.color;
        for (const [px, py] of this.path) {
            ctx.fillRect(px * CELL_SIZE, py * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
        ctx.globalAlpha = 1.0;

        // 2. Draw the ghost (simple circle with "legs")
        const centerX = drawX + CELL_SIZE / 2;
        const centerY = drawY + CELL_SIZE / 2;
        const radius = this.radius;

        ctx.fillStyle = this.color;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, Math.PI, 0, false);
        ctx.lineTo(centerX + radius, centerY + radius);
        ctx.lineTo(centerX + radius / 2, centerY + radius * 0.8);
        ctx.lineTo(centerX, centerY + radius);
        ctx.lineTo(centerX - radius / 2, centerY + radius * 0.8);
        ctx.lineTo(centerX - radius, centerY + radius);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = WHITE;
        const eyeRadius = radius / 4;
        const eyeY = centerY - radius / 4;

        ctx.beginPath();
        ctx.arc(centerX - radius / 3, eyeY, eyeRadius, 0, 2 * Math.PI);
        ctx.arc(centerX + radius / 3, eyeY, eyeRadius, 0, 2 * Math.PI);
        ctx.fill();
    }
}
 
class Fruit {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        
        if (type === 'cherry') {
            this.points = 10;
            this.color = RED;
        } else if (type === 'strawberry') {
            this.points = 20;
            this.color = '#ff8080';
        } else if (type === 'orange') {
            this.points = 30;
            this.color = '#ffa500';
        } else {
            this.points = 0;
            this.color = WHITE;
        }
    }
    
    draw(ctx) {
        const drawX = this.x * CELL_SIZE + CELL_SIZE / 2;
        const drawY = this.y * CELL_SIZE + CELL_SIZE / 2;

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(drawX, drawY, CELL_SIZE / 3, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.strokeStyle = '#006400';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(drawX, drawY - CELL_SIZE / 3);
        ctx.lineTo(drawX + CELL_SIZE / 8, drawY - CELL_SIZE / 2);
        ctx.stroke();
    }
}


class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = SCREEN_WIDTH;
        this.canvas.height = SCREEN_HEIGHT;
        
        this.maze = new Maze();
        this.player = new Player(1, 1, this.maze); 
        this.ghost = new Ghost(GRID_WIDTH - 2, 1, this.maze, RED, "astar"); 

        this.score = 0;
        this.level = parseInt(document.getElementById('levelSelect').value, 10);
        this.MAX_LEVEL = MAX_LEVEL;
        this.levelUpScoreThreshold = 100; 

        this.food = [];
        this.fruits = [];
        
        this.gameLoopRef = null;
        this.lastTime = 0;
        
        this.gameStatus = 'Playing';
        this.levelCleared = false;
        this.levelClearedTimer = 0;
        this.levelClearedDuration = LEVEL_CLEARED_DURATION;

        this.setupControls();
        this.initializeLevelContent();
        this.updateGhostAI();
        this.updateUI();
        this.start();
    }
    
    applySpeedScaling() {
        this.player.velocity = 6 + this.level;
        this.ghost.velocity = 2 + this.level;
    }

    setupControls() {
        document.getElementById('resetButton').addEventListener('click', () => this.resetGame());
        document.getElementById('algorithmSelect').addEventListener('change', (e) => {
            this.ghost.algorithm = e.target.value;
            this.updateUI();
        });
        document.getElementById('levelSelect').addEventListener('change', (e) => {
            this.level = parseInt(e.target.value, 10);
            this.resetGame(false);
        });
        
        // Keyboard Input (FIXED: Added e.preventDefault())
        document.addEventListener('keydown', (e) => {
            if (this.gameStatus !== 'Playing' || this.levelCleared) return;
            
            let handled = false;

            if (e.key === 'ArrowUp' || e.key === 'w') {
                this.player.handleInput(0, -1);
                handled = true;
            } else if (e.key === 'ArrowDown' || e.key === 's') {
                this.player.handleInput(0, 1);
                handled = true;
            } else if (e.key === 'ArrowLeft' || e.key === 'a') {
                this.player.handleInput(-1, 0);
                handled = true;
            } else if (e.key === 'ArrowRight' || e.key === 'd') {
                this.player.handleInput(1, 0);
                handled = true;
            }
            
            // Prevent browser default actions (like scrolling or changing select box value)
            if (handled) {
                e.preventDefault(); 
            }
        });
        
        // Touch/Swipe Input
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), false);     
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), false);
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), false);
        
        this.xDown = null;                                             
        this.yDown = null;
    }
    
    // --- Touch/Swipe Handlers ---
    handleTouchStart(evt) {                                          
        const firstTouch = evt.touches[0];                           
        this.xDown = firstTouch.clientX;                             
        this.yDown = firstTouch.clientY;                             
    };                                                           

    handleTouchMove(evt) {
        if ( ! this.xDown || ! this.yDown ) {
            return;
        }

        const xUp = evt.touches[0].clientX;                          
        const yUp = evt.touches[0].clientY;

        const xDiff = this.xDown - xUp;
        const yDiff = this.yDown - yUp;

        if ( Math.abs( xDiff ) > Math.abs( yDiff ) ) {
            if ( xDiff > 5 ) {
                this.player.handleInput(-1, 0);
            } else if ( xDiff < -5 ) {
                this.player.handleInput(1, 0);
            }                                
        } else {
            if ( yDiff > 5 ) {
                this.player.handleInput(0, -1);
            } else if ( yDiff < -5 ) {
                this.player.handleInput(0, 1);
            }                                                                 
        }
        
        this.xDown = null;
        this.yDown = null;                                         
    };
    
    handleTouchEnd(evt) {}
    // --------------------------

    resetGame(hardReset = true) {
        if (hardReset) {
            this.score = 0;
            this.level = 1;
            document.getElementById('levelSelect').value = '1';
            this.levelUpScoreThreshold = 100;
        }
        this.gameStatus = 'Playing';
        this.initializeLevelContent();
        this.updateGhostAI();
        this.updateUI();
        this.hideMessageBox();
    }

    initializeLevelContent() {
        this.maze.generate(this.level);
        
        this.player.x = 1; 
        this.player.y = 1;
        this.ghost.x = GRID_WIDTH - 2; 
        this.ghost.y = 1;
        this.player.nextMove = null;
        this.ghost.path = [];
        this.player.currentDirection = [1, 0];
        
        this.applySpeedScaling(); 
        
        const allPathTiles = [];
        for (let r = 0; r < GRID_HEIGHT; r++) {
            for (let c = 0; c < GRID_WIDTH; c++) {
                if (this.maze.grid[r][c] === 0 && 
                    !((c === this.player.x && r === this.player.y) || 
                      (c === this.ghost.x && r === this.ghost.y))) {
                    allPathTiles.push([c, r]);
                }
            }
        }
        
        const numFruits = Math.floor(this.level * 1.5) + 3;
        const numFruitsToPlace = Math.min(numFruits, allPathTiles.length * 0.1); 
        
        const sample = (arr, count) => {
            const shuffled = arr.slice();
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled.slice(0, count);
        };
        
        const fruitPositions = sample(allPathTiles, numFruitsToPlace);
        
        this.food = allPathTiles.filter(tile => 
            !fruitPositions.some(fruitPos => fruitPos[0] === tile[0] && fruitPos[1] === tile[1])
        );
        
        this.fruits = [];
        const fruitTypesList = ['cherry', 'strawberry', 'orange'];
        
        for (const pos of fruitPositions) {
            const fruitType = fruitTypesList[Math.floor(Math.random() * fruitTypesList.length)];
            this.fruits.push(new Fruit(pos[0], pos[1], fruitType));
        }

        this.levelCleared = false;
        this.levelClearedTimer = 0;
    }

    updateGhostAI() {
        let color;
        let algorithm;

        if (this.level <= 2) {
            algorithm = "bfs";
            color = PINK; 
        } else {
            algorithm = "astar";
            color = RED;
        }
        this.ghost.algorithm = algorithm;
        this.ghost.color = color;
    }

    getAlgorithmFunc() {
        return this.ghost.algorithm === "bfs" ? bfs : astar;
    }

    checkProgression() {
        if (!this.food.length && !this.fruits.length && !this.levelCleared) {
            this.levelCleared = true;
            this.levelClearedTimer = this.levelClearedDuration;
            this.showMessageBox(`Level ${this.level} Cleared!`, YELLOW);
        }

        if (this.levelCleared) {
            this.levelClearedTimer--;
            if (this.levelClearedTimer <= 0) {
                this.hideMessageBox();
                
                if (this.level < this.MAX_LEVEL && this.score >= this.levelUpScoreThreshold) {
                    this.level++;
                    document.getElementById('levelSelect').value = this.level.toString();
                    this.levelUpScoreThreshold += 100 * this.level;
                    this.updateGhostAI();
                    this.initializeLevelContent();
                } else if (this.level === this.MAX_LEVEL && this.score >= this.levelUpScoreThreshold) {
                    this.gameStatus = 'Win';
                    this.showMessageBox("ULTIMATE VICTORY! Game Complete!", YELLOW);
                } else {
                    this.initializeLevelContent(); 
                }
                this.levelCleared = false;
                this.updateUI();
            }
        }
    }
    
    updateUI() {
        document.getElementById('scoreDisplay').textContent = this.score;
        document.getElementById('levelDisplay').textContent = `${this.level} / ${this.MAX_LEVEL}`;
        document.getElementById('statusDisplay').textContent = this.gameStatus === 'Playing' ? 
            `${this.ghost.algorithm.toUpperCase()} | Next @${this.levelUpScoreThreshold}` : 
            this.gameStatus;
        document.getElementById('statusDisplay').style.color = 
            this.gameStatus === 'GameOver' ? RED : (this.gameStatus === 'Win' ? YELLOW : CYAN);
    }
    
    showMessageBox(message, color) {
        const box = document.getElementById('messageBox');
        box.textContent = message;
        box.style.color = color;
        box.style.border = `4px solid ${color}`;
        box.style.display = 'block';
    }
    
    hideMessageBox() {
        document.getElementById('messageBox').style.display = 'none';
    }


    update(time) {
        const deltaTime = time - this.lastTime;
        this.lastTime = time;

        if (this.gameStatus !== 'Playing') return;
        
        if (this.levelCleared) {
            this.checkProgression();
            return;
        }

        this.player.update();
        const playerPos = [this.player.x, this.player.y];
        
        const algorithmFunc = this.getAlgorithmFunc();
        this.ghost.update(playerPos, algorithmFunc);

        // Eating Food
        const foodIndex = this.food.findIndex(p => p[0] === playerPos[0] && p[1] === playerPos[1]);
        if (foodIndex !== -1) {
            this.food.splice(foodIndex, 1);
            this.score += 1; 
        }

        // Eating Fruits
        const fruitIndex = this.fruits.findIndex(fruit => 
            fruit.x === playerPos[0] && fruit.y === playerPos[1]
        );
        if (fruitIndex !== -1) {
            this.score += this.fruits[fruitIndex].points;
            this.fruits.splice(fruitIndex, 1);
        }

        this.checkProgression();

        // Check Ghost collision
        if (this.player.x === this.ghost.x && this.player.y === this.ghost.y) {
            this.gameStatus = 'GameOver';
            this.showMessageBox("GAME OVER! Reset to play again.", RED);
            // API Call: Save score to Django backend
            saveScoreToBackend(this.score, this.level);
        }
        
        this.updateUI();
    }

    draw() {
        this.ctx.fillStyle = BLACK;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.maze.draw(this.ctx);

        this.ctx.fillStyle = WHITE;
        for (const [fx, fy] of this.food) {
            const px = fx * CELL_SIZE + CELL_SIZE / 2;
            const py = fy * CELL_SIZE + CELL_SIZE / 2;
            this.ctx.beginPath();
            this.ctx.arc(px, py, 3, 0, 2 * Math.PI); 
            this.ctx.fill();
        }

        for (const fruit of this.fruits) {
            fruit.draw(this.ctx);
        }

        const blink = this.levelCleared && (this.levelClearedTimer % 20 < 10);

        if (!blink) {
            this.player.draw(this.ctx);
            this.ghost.draw(this.ctx);
        }
    }

    gameLoop(time) {
        this.update(time);
        this.draw();
        this.gameLoopRef = requestAnimationFrame(this.gameLoop.bind(this));
    }

    start() {
        if (this.gameLoopRef) cancelAnimationFrame(this.gameLoopRef);
        this.gameLoopRef = requestAnimationFrame(this.gameLoop.bind(this));
    }
}

// Initialization when the window loads
window.onload = () => {
    const canvas = document.getElementById('gameCanvas');
    if (canvas) {
        // These constants define the fixed *drawing* resolution.
        canvas.width = SCREEN_WIDTH; 
        canvas.height = SCREEN_HEIGHT;
        
        window.game = new Game();
    } else {
         console.error("Canvas element 'gameCanvas' not found.");
    }
};