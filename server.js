const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 정적 파일 제공
app.use(express.static(__dirname));

// 기본 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 게임 상태 관리
class GameServer {
    constructor() {
        this.votes = { up: 0, down: 0, left: 0, right: 0 };
        this.timeLeft = 60; // 1분
        this.gameActive = true;
        this.atExit = false;
        this.playerPos = { x: 1, y: 1 };
        this.exitPos = { x: 13, y: 13 };
        this.connectedPlayers = 0;
        this.maze = this.generateMaze();
        
        this.startTimer();
    }

    generateMaze() {
        const mazeSize = 15;
        const maze = Array(mazeSize).fill().map(() => Array(mazeSize).fill(1));
        
        // 간단한 미로 생성
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
        
        // 출구 설정
        maze[this.exitPos.y][this.exitPos.x] = 0;
        maze[this.exitPos.y - 1][this.exitPos.x] = 0;
        maze[this.exitPos.y][this.exitPos.x - 1] = 0;
        
        return maze;
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            if (!this.atExit) {
                this.timeLeft--;
                
                // 타이머 업데이트 브로드캐스트
                io.emit('timer-update', this.timeLeft);
                
                if (this.timeLeft <= 0) {
                    this.executeMove();
                    this.timeLeft = 60; // 1분 리셋
                }
            }
        }, 1000);
    }

    executeMove() {
        if (this.atExit) {
            this.resetGame();
            return;
        }
        
        // 가장 많은 표를 받은 방향 찾기
        const maxVotes = Math.max(...Object.values(this.votes));
        if (maxVotes === 0) {
            // 투표가 없으면 타이머만 리셋
            return;
        }
        
        const winningDirections = Object.keys(this.votes).filter(dir => this.votes[dir] === maxVotes);
        const winningDirection = winningDirections[Math.floor(Math.random() * winningDirections.length)];
        
        this.movePlayer(winningDirection);
        this.resetVotes();
    }

    movePlayer(direction) {
        const newPos = { ...this.playerPos };
        
        switch (direction) {
            case 'up': newPos.y--; break;
            case 'down': newPos.y++; break;
            case 'left': newPos.x--; break;
            case 'right': newPos.x++; break;
        }
        
        // 이동 가능한지 확인
        if (newPos.x >= 0 && newPos.x < 15 && 
            newPos.y >= 0 && newPos.y < 15 && 
            this.maze[newPos.y][newPos.x] === 0) {
            
            this.playerPos = newPos;
            
            // 플레이어 이동 브로드캐스트
            io.emit('player-moved', { 
                position: this.playerPos, 
                direction: direction,
                votes: maxVotes 
            });
            
            // 출구 도달 확인
            if (this.playerPos.x === this.exitPos.x && this.playerPos.y === this.exitPos.y) {
                this.reachExit();
            }
        }
    }

    reachExit() {
        this.atExit = true;
        io.emit('exit-reached');
    }

    resetGame() {
        this.playerPos = { x: 1, y: 1 };
        this.atExit = false;
        this.maze = this.generateMaze();
        
        io.emit('game-reset', { 
            maze: this.maze, 
            playerPos: this.playerPos 
        });
    }

    addVote(direction) {
        if (!this.atExit && this.votes.hasOwnProperty(direction)) {
            this.votes[direction]++;
            
            // 투표 업데이트 브로드캐스트
            io.emit('vote-update', this.votes);
            
            return true;
        }
        return false;
    }

    resetVotes() {
        this.votes = { up: 0, down: 0, left: 0, right: 0 };
        io.emit('vote-update', this.votes);
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

// 게임 인스턴스 생성
const game = new GameServer();

// Socket.IO 연결 처리
io.on('connection', (socket) => {
    console.log(`플레이어 연결: ${socket.id}`);
    game.connectedPlayers++;
    
    // 새 플레이어에게 현재 게임 상태 전송
    socket.emit('game-state', game.getGameState());
    
    // 모든 플레이어에게 접속자 수 업데이트
    io.emit('players-update', game.connectedPlayers);
    
    // 투표 처리
    socket.on('vote', (direction) => {
        const success = game.addVote(direction);
        if (success) {
            console.log(`투표 받음: ${direction} from ${socket.id}`);
        }
    });
    
    // 플레이어 연결 해제
    socket.on('disconnect', () => {
        console.log(`플레이어 연결 해제: ${socket.id}`);
        game.connectedPlayers--;
        io.emit('players-update', game.connectedPlayers);
    });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // 모든 네트워크 인터페이스에서 접속 허용

server.listen(PORT, HOST, () => {
    console.log(`🎮 미로 탈출 게임 서버가 포트 ${PORT}에서 실행중입니다!`);
    console.log(`🌐 로컬: http://localhost:${PORT}`);
    console.log(`🌐 네트워크: http://172.30.1.64:${PORT}`);
    console.log(`🌐 모든 인터페이스에서 접속 가능합니다.`);
});