class MazeEscapeGame {
    constructor() {
        this.mazeSize = 15;
        this.maze = [];
        this.playerPos = { x: 1, y: 1 };
        this.exitPos = { x: 13, y: 13 };
        this.votes = { up: 0, down: 0, left: 0, right: 0 };
        this.timeLeft = 60; // 1분 = 60초
        this.gameActive = true;
        this.atExit = false;
        this.socket = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.connectToServer();
        this.updateDisplay();
        this.updateRanking(); // 초기 순위 표시
    }

    connectToServer() {
        this.socket = io({
            timeout: 5000,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
            maxReconnectionAttempts: 10
        });
        
        // 서버 연결 성공
        this.socket.on('connect', () => {
            console.log('서버에 연결되었습니다!');
            this.hideConnectionError();
        });

        // 연결 에러 처리
        this.socket.on('connect_error', (error) => {
            console.error('연결 실패:', error);
            this.showConnectionError();
        });

        // 연결 해제 처리
        this.socket.on('disconnect', (reason) => {
            console.log('연결이 끊어졌습니다:', reason);
            if (reason === 'io server disconnect') {
                this.socket.connect();
            }
            this.showConnectionError();
        });

        // 재연결 시도
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`재연결 시도 중... (${attemptNumber}번째)`);
            this.showReconnecting(attemptNumber);
        });

        // 재연결 성공
        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`재연결 성공! (${attemptNumber}번 시도 후)`);
            this.hideConnectionError();
        });

        // 재연결 실패
        this.socket.on('reconnect_failed', () => {
            console.error('재연결에 실패했습니다.');
            this.showConnectionError('재연결에 실패했습니다. 페이지를 새로고침해주세요.');
        });

        // 게임 상태 받기
        this.socket.on('game-state', (gameState) => {
            this.maze = gameState.maze;
            this.playerPos = gameState.playerPos;
            this.exitPos = gameState.exitPos;
            this.votes = gameState.votes;
            this.timeLeft = gameState.timeLeft;
            this.atExit = gameState.atExit;
            
            this.renderMaze();
            this.updateDisplay();
            this.updateRanking();
            this.updateTimerDisplay();
            this.updateGameStatus();
        });

        // 타이머 업데이트
        this.socket.on('timer-update', (timeLeft) => {
            this.timeLeft = timeLeft;
            this.updateTimerDisplay();
        });

        // 투표 업데이트
        this.socket.on('vote-update', (votes) => {
            this.votes = votes;
            this.updateRanking();
        });

        // 플레이어 이동
        this.socket.on('player-moved', (data) => {
            this.playerPos = data.position;
            this.renderMaze();
            this.updateDisplay();
        });

        // 출구 도달
        this.socket.on('exit-reached', () => {
            this.atExit = true;
            this.reachExit();
        });

        // 게임 리셋
        this.socket.on('game-reset', (data) => {
            this.maze = data.maze;
            this.playerPos = data.playerPos;
            this.atExit = false;
            this.resetGame();
        });

        // 접속자 수 업데이트
        this.socket.on('players-update', (count) => {
            document.getElementById('playerCount').textContent = count;
        });
    }

    generateMaze() {
        // 미로 초기화 (모든 셀을 벽으로)
        this.maze = Array(this.mazeSize).fill().map(() => Array(this.mazeSize).fill(1));
        
        // 간단한 미로 생성 - 랜덤 경로
        const stack = [];
        const visited = Array(this.mazeSize).fill().map(() => Array(this.mazeSize).fill(false));
        
        // 시작점 설정
        let current = { x: 1, y: 1 };
        this.maze[current.y][current.x] = 0;
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
                
                if (next.x > 0 && next.x < this.mazeSize - 1 && 
                    next.y > 0 && next.y < this.mazeSize - 1 && 
                    !visited[next.y][next.x]) {
                    neighbors.push(next);
                }
            }
            
            if (neighbors.length > 0) {
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];
                
                // 현재 위치와 다음 위치 사이의 벽 제거
                const wallX = current.x + (next.x - current.x) / 2;
                const wallY = current.y + (next.y - current.y) / 2;
                
                this.maze[wallY][wallX] = 0;
                this.maze[next.y][next.x] = 0;
                visited[next.y][next.x] = true;
                
                stack.push(next);
                current = next;
            } else {
                current = stack.pop();
            }
        }
        
        // 출구 설정 (확실히 길 만들기)
        this.maze[this.exitPos.y][this.exitPos.x] = 0;
        this.maze[this.exitPos.y - 1][this.exitPos.x] = 0;
        this.maze[this.exitPos.y][this.exitPos.x - 1] = 0;
    }

    renderMaze() {
        const mazeElement = document.getElementById('maze');
        mazeElement.innerHTML = '';
        
        for (let y = 0; y < this.mazeSize; y++) {
            for (let x = 0; x < this.mazeSize; x++) {
                const cell = document.createElement('div');
                cell.className = 'maze-cell';
                
                if (this.maze[y][x] === 1) {
                    cell.classList.add('wall');
                } else if (x === this.playerPos.x && y === this.playerPos.y) {
                    cell.classList.add('player');
                    const playerChar = document.createElement('div');
                    playerChar.className = 'player-char';
                    playerChar.textContent = '●';
                    cell.appendChild(playerChar);
                } else if (x === this.exitPos.x && y === this.exitPos.y) {
                    cell.classList.add('exit');
                    cell.textContent = '출구';
                } else if (x === 1 && y === 1) {
                    cell.classList.add('start');
                }
                
                mazeElement.appendChild(cell);
            }
        }
    }

    setupEventListeners() {
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleVote(e));
        });
    }

    handleVote(e) {
        if (!this.gameActive || this.atExit) return;
        
        const direction = e.currentTarget.dataset.direction;
        
        // 서버에 투표 전송
        this.socket.emit('vote', direction);
        
        // 버튼 클릭 효과
        e.currentTarget.style.transform = 'scale(0.9)';
        setTimeout(() => {
            e.currentTarget.style.transform = '';
        }, 100);
    }

    updateVoteDisplay() {
        this.updateRanking();
    }

    updateRanking() {
        const rankingList = document.getElementById('rankingList');
        
        // 투표 데이터를 배열로 변환하고 정렬
        const voteData = [
            { direction: 'up', arrow: '↑', votes: this.votes.up, color: 'up' },
            { direction: 'down', arrow: '↓', votes: this.votes.down, color: 'down' },
            { direction: 'left', arrow: '←', votes: this.votes.left, color: 'left' },
            { direction: 'right', arrow: '→', votes: this.votes.right, color: 'right' }
        ];

        // 0건이 아닌 것만 필터링하고 투표수로 정렬
        const filteredData = voteData.filter(item => item.votes > 0);
        filteredData.sort((a, b) => b.votes - a.votes);

        // 순위 표시 업데이트
        if (filteredData.length === 0) {
            rankingList.innerHTML = '<div class="no-votes">No votes yet</div>';
        } else {
            let rankingHTML = '';
            filteredData.forEach((item, index) => {
                const rank = index + 1;
                const rankClass = rank <= 3 ? `rank-${rank}` : '';
                
                rankingHTML += `
                    <div class="ranking-item ${rankClass}">
                        <div class="rank-number">${rank}</div>
                        <div class="rank-arrow ${item.color}">${item.arrow}</div>
                    </div>
                `;
            });
            rankingList.innerHTML = rankingHTML;
        }
    }

    addToLog(direction, color) {
        // 로그 기능 제거됨
    }

    // 타이머는 서버에서 관리하므로 제거
    // startTimer() 메소드 제거됨

    updateTimerDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        document.getElementById('countdown').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // 이동 로직은 서버에서 처리되므로 제거
    // executeMove(), movePlayer() 메소드 제거됨

    reachExit() {
        this.updateGameStatus();
        
        // 투표 버튼 비활성화
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.classList.add('disabled');
        });
    }

    resetGame() {
        this.renderMaze();
        this.updateDisplay();
        this.updateGameStatus();
        
        // 투표 버튼 재활성화
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.classList.remove('disabled');
        });
    }

    updateGameStatus() {
        if (this.atExit) {
            document.getElementById('gameStatus').textContent = 'EXIT REACHED';
            document.getElementById('gameStatus').style.background = 'linear-gradient(135deg, #10ac84 0%, #00d2d3 100%)';
            document.getElementById('gameStatus').style.color = 'white';
        } else {
            document.getElementById('gameStatus').textContent = 'VOTING';
            document.getElementById('gameStatus').style.background = 'rgba(255, 255, 255, 0.2)';
            document.getElementById('gameStatus').style.color = '#fff';
        }
    }

    // 서버에서 관리되므로 제거됨
    // showWinnerAnnouncement(), resetVotes() 메소드 제거됨

    updateDisplay() {
        document.getElementById('playerX').textContent = this.playerPos.x;
        document.getElementById('playerY').textContent = this.playerPos.y;
    }

    showConnectionError(message = '네트워크 연결 상태가 좋지 않습니다.') {
        let errorDiv = document.getElementById('connectionError');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'connectionError';
            errorDiv.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #ff4757;
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 1000;
                font-weight: bold;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            `;
            document.body.appendChild(errorDiv);
        }
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }

    showReconnecting(attemptNumber) {
        this.showConnectionError(`재연결 시도 중... (${attemptNumber}번째)`);
    }

    hideConnectionError() {
        const errorDiv = document.getElementById('connectionError');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }
}

// 게임 시작
document.addEventListener('DOMContentLoaded', () => {
    new MazeEscapeGame();
});