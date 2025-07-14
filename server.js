const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Vercel 환경에 맞게 Socket.IO 설정
const io = socketIo(server, {
    cors: {
        origin: "*", // 실제 프로덕션에서는 특정 도메인으로 제한하는 것이 좋습니다.
        methods: ["GET", "POST"]
    }
});

// public 폴더의 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// API 라우트를 명시적으로 처리 (Socket.IO 핸드셰이크용)
app.get('/socket.io/', (req, res) => {
    // 이 경로는 Socket.IO 라이브러리가 내부적으로 처리하므로,
    // 특별한 로직 없이 다음 미들웨어로 넘기거나, 아무것도 하지 않아도 됩니다.
    // Vercel의 라우팅이 이 경로를 server.js로 보내는 것이 중요합니다.
});

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
        this.timerInterval = null; // 타이머 ID 저장
        
        this.startTimer();
    }

    // ... (generateMaze, movePlayer, reachExit, resetGame, addVote, resetVotes, getGameState 메소드는 이전과 동일) ...
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
        // Vercel의 서버리스 환경에서는 상태를 메모리에 유지할 수 없으므로,
        // 이 방식은 로컬 테스트 외에는 안정적으로 동작하지 않습니다.
        // 하지만 질문의 요지는 배포 문제 해결이므로, 일단 로직은 유지합니다.
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.timerInterval = setInterval(() => {
            if (this.atExit) {
                if (this.timeLeft > 0) {
                    this.timeLeft--;
                } else {
                    this.resetGame();
                }
            } else {
                if (this.timeLeft > 0) {
                    this.timeLeft--;
                } else {
                    this.executeMove();
                }
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

        if (this.maze[newPos.y] && this.maze[new_pos.y][new_pos.x] === 0) {
            this.playerPos = newPos;
            if (this.playerPos.x === this.exitPos.x && this.playerPos.y === this.exitPos.y) {
                this.reachExit();
            }
        }
    }

    reachExit() {
        this.atExit = true;
        this.timeLeft = 10; // 10초 후 리셋
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

// Vercel에서는 단일 게임 인스턴스를 메모리에 유지하는 것이 불안정할 수 있습니다.
// 이 예제에서는 설명을 위해 단순한 형태로 유지합니다.
const game = new GameServer();

io.on('connection', (socket) => {
    game.connectedPlayers++;
    console.log(`플레이어 연결: ${socket.id} (총 ${game.connectedPlayers}명)`);
    
    socket.emit('game-state', game.getGameState());
    io.emit('players-update', game.connectedPlayers);
    
    socket.on('vote', (direction) => {
        if (game.addVote(direction)) {
            console.log(`투표 받음: ${direction} from ${socket.id}`);
            io.emit('game-state', game.getGameState());
        }
    });
    
    socket.on('disconnect', () => {
        game.connectedPlayers--;
        console.log(`플레이어 연결 해제: ${socket.id} (총 ${game.connectedPlayers}명)`);
        io.emit('players-update', game.connectedPlayers);
    });
});

// Vercel은 이 모듈을 가져와서 서버를 실행합니다.
module.exports = (req, res) => {
    // Socket.IO 서버가 이미 Express 서버에 연결되어 있으므로,
    // 들어오는 모든 요청을 Express 앱이 처리하도록 합니다.
    app(req, res);
};

// 로컬 테스트용: `node server.js`로 직접 실행할 때만 서버를 리슨합니다.
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`🎮 로컬 테스트 서버가 포트 ${PORT}에서 실행중입니다: http://localhost:${PORT}`);
    });
}