const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// WebSocket을 우선 사용하도록 transport 설정 추가
const io = new Server(server, {
    cors: { 
        origin: "*",
    },
    transports: ['websocket', 'polling'] // WebSocket을 우선으로 사용
});

app.use(express.static(path.join(__dirname, 'public')));

// GameServer 클래스 (변경 없음)
class GameServer {
    constructor() {
        this.mazeSize = 15;
        this.votes = { up: 0, down: 0, left: 0, right: 0 };
        this.timeLeft = 60;
        this.atExit = false;
        this.playerPos = { x: 1, y: 1 };
        this.exitPos = { x: 13, y: 13 };
        this.connectedPlayers = 0;
        this.maze = this.generateMaze();
        this.timerInterval = null;
        this.startTimer();
    }

    generateMaze() {
        const maze = Array(this.mazeSize).fill(null).map(() => Array(this.mazeSize).fill(1));
        const stack = [];
        const visited = Array(this.mazeSize).fill(null).map(() => Array(this.mazeSize).fill(false));
        let current = { x: 1, y: 1 };
        maze[current.y][current.x] = 0;
        visited[current.y][current.x] = true;
        stack.push(current);
        const directions = [{ x: 0, y: -2 }, { x: 0, y: 2 }, { x: -2, y: 0 }, { x: 2, y: 0 }];
        while (stack.length > 0) {
            current = stack[stack.length - 1];
            const neighbors = [];
            for (const dir of directions) {
                const next = { x: current.x + dir.x, y: current.y + dir.y };
                if (next.x > 0 && next.x < this.mazeSize - 1 && next.y > 0 && next.y < this.mazeSize - 1 && !visited[next.y][next.x]) {
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
            } else {
                stack.pop();
            }
        }
        maze[this.exitPos.y][this.exitPos.x] = 0;
        return maze;
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (this.atExit) {
                if (this.timeLeft > 0) this.timeLeft--;
                else this.resetGame();
            } else {
                if (this.timeLeft > 0) this.timeLeft--;
                else this.executeMove();
            }
            io.emit('game-state', this.getGameState());
        }, 1000);
    }

    executeMove() {
        const maxVotes = Math.max(...Object.values(this.votes));
        if (maxVotes > 0) {
            const winningDirections = Object.keys(this.votes).filter(dir => this.votes[dir] === maxVotes);
            const winningDirection = winningDirections[Math.floor(Math.random() * winningDirections.length)];
            this.movePlayer(winningDirection);
        }
        this.resetVotes();
        this.timeLeft = 60;
    }

    movePlayer(direction) {
        const newPos = { ...this.playerPos };
        if (direction === 'up') newPos.y--;
        else if (direction === 'down') newPos.y++;
        else if (direction === 'left') newPos.x--;
        else if (direction === 'right') newPos.x++;
        if (this.maze[newPos.y] && this.maze[newPos.y][newPos.x] === 0) {
            this.playerPos = newPos;
            if (this.playerPos.x === this.exitPos.x && this.playerPos.y === this.exitPos.y) {
                this.reachExit();
            }
        }
    }

    reachExit() {
        this.atExit = true;
        this.timeLeft = 10;
    }

    resetGame() {
        this.playerPos = { x: 1, y: 1 };
        this.atExit = false;
        this.maze = this.generateMaze();
        this.resetVotes();
        this.timeLeft = 60;
    }

    addVote(direction) {
        if (!this.atExit && this.votes.hasOwnProperty(direction)) {
            this.votes[direction]++;
            return true;
        }
        return false;
    }

    resetVotes() {
        this.votes = { up: 0, down: 0, left: 0, right: 0 };
    }

    getGameState() {
        return {
            maze: this.maze,
            playerPos: this.playerPos,
            exitPos: this.exitPos,
            votes: this.votes,
            timeLeft: this.timeLeft,
            atExit: this.atExit,
            connectedPlayers: this.connectedPlayers
        };
    }
}

const game = new GameServer();

io.on('connection', (socket) => {
    game.connectedPlayers++;
    io.emit('players-update', game.connectedPlayers);
    socket.emit('game-state', game.getGameState());

    socket.on('vote', (direction) => {
        if (game.addVote(direction)) {
            io.emit('game-state', game.getGameState());
        }
    });

    socket.on('disconnect', () => {
        game.connectedPlayers--;
        io.emit('players-update', game.connectedPlayers);
    });
});

module.exports = server;