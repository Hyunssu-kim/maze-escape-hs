// 공유 게임 상태 관리
class GameStateManager {
    constructor() {
        this.gameState = {
            votes: { up: 0, down: 0, left: 0, right: 0 },
            timeLeft: 60,
            gameActive: true,
            atExit: false,
            playerPos: { x: 1, y: 1 },
            exitPos: { x: 13, y: 13 },
            connectedPlayers: 0,
            maze: null,
            lastMoveTime: Date.now(),
            lastUpdate: Date.now()
        };
        
        if (!this.gameState.maze) {
            this.gameState.maze = this.generateMaze();
        }
    }

    generateMaze() {
        const mazeSize = 15;
        const maze = Array(mazeSize).fill().map(() => Array(mazeSize).fill(1));
        
        const stack = [];
        const visited = Array(mazeSize).fill().map(() => Array(mazeSize).fill(false));
        
        let current = { x: 1, y: 1 };
        maze[current.y][current.x] = 0;
        visited[current.y][current.x] = true;
        stack.push(current);
        
        const directions = [
            { x: 0, y: -2 }, { x: 0, y: 2 },
            { x: -2, y: 0 }, { x: 2, y: 0 }
        ];
        
        while (stack.length > 0) {
            const neighbors = [];
            
            for (let dir of directions) {
                const next = {
                    x: current.x + dir.x,
                    y: current.y + dir.y
                };
                
                if (next.x > 0 && next.x < mazeSize - 1 && 
                    next.y > 0 && next.y < mazeSize - 1 && 
                    !visited[next.y][next.x]) {
                    neighbors.push(next);
                }
            }
            
            if (neighbors.length > 0) {
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];
                
                const wallX = current.x + (next.x - current.x) / 2;
                const wallY = current.y + (next.y - current.y) / 2;
                
                maze[wallY][wallX] = 0;
                maze[next.y][next.x] = 0;
                visited[next.y][next.x] = true;
                
                stack.push(next);
                current = next;
            } else {
                current = stack.pop();
            }
        }
        
        maze[13][13] = 0;
        maze[12][13] = 0;
        maze[13][12] = 0;
        
        return maze;
    }

    movePlayer(direction) {
        const newPos = { ...this.gameState.playerPos };
        
        switch (direction) {
            case 'up': newPos.y--; break;
            case 'down': newPos.y++; break;
            case 'left': newPos.x--; break;
            case 'right': newPos.x++; break;
        }
        
        if (newPos.x >= 0 && newPos.x < 15 && 
            newPos.y >= 0 && newPos.y < 15 && 
            this.gameState.maze[newPos.y][newPos.x] === 0) {
            
            this.gameState.playerPos = newPos;
            
            if (this.gameState.playerPos.x === this.gameState.exitPos.x && 
                this.gameState.playerPos.y === this.gameState.exitPos.y) {
                this.gameState.atExit = true;
            }
            
            return true;
        }
        
        return false;
    }

    addVote(direction) {
        if (!this.gameState.atExit && this.gameState.votes.hasOwnProperty(direction)) {
            this.gameState.votes[direction]++;
            this.gameState.lastUpdate = Date.now();
            return true;
        }
        return false;
    }

    connect() {
        this.gameState.connectedPlayers++;
        this.gameState.lastUpdate = Date.now();
    }

    disconnect() {
        this.gameState.connectedPlayers = Math.max(0, this.gameState.connectedPlayers - 1);
        this.gameState.lastUpdate = Date.now();
    }

    updateTimer() {
        const now = Date.now();
        const timeSinceLastMove = now - this.gameState.lastMoveTime;
        
        // 60초마다 이동
        if (timeSinceLastMove >= 60000 && !this.gameState.atExit) {
            const maxVotes = Math.max(...Object.values(this.gameState.votes));
            
            if (maxVotes > 0) {
                const winningDirections = Object.keys(this.gameState.votes)
                    .filter(dir => this.gameState.votes[dir] === maxVotes);
                const winningDirection = winningDirections[
                    Math.floor(Math.random() * winningDirections.length)
                ];
                
                this.movePlayer(winningDirection);
            }
            
            // 투표 리셋
            this.gameState.votes = { up: 0, down: 0, left: 0, right: 0 };
            this.gameState.lastMoveTime = now;
        }
        
        // 남은 시간 계산
        this.gameState.timeLeft = Math.max(0, 60 - Math.floor(timeSinceLastMove / 1000));
        this.gameState.lastUpdate = now;
    }

    getState() {
        return { ...this.gameState };
    }
}

// 전역 게임 상태 매니저 (서버리스 환경에서는 각 요청마다 새로 생성)
let globalGameState = null;

export function getGameStateManager() {
    if (!globalGameState) {
        globalGameState = new GameStateManager();
    }
    return globalGameState;
}