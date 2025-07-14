class MazeEscapeGame {
    constructor() {
        this.mazeSize = 15;
        this.maze = [];
        this.playerPos = { x: 1, y: 1 };
        this.exitPos = { x: 13, y: 13 };
        this.votes = { up: 0, down: 0, left: 0, right: 0 };
        this.timeLeft = 60;
        this.gameActive = true;
        this.atExit = false;
        this.connected = false;
        this.pollInterval = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.connectToServer();
        this.updateDisplay();
        this.updateRanking();
        this.startPolling();
    }

    async connectToServer() {
        try {
            const response = await fetch('/api/game-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'connect' })
            });
            
            if (response.ok) {
                console.log('서버에 연결되었습니다!');
                this.connected = true;
                this.hideConnectionError();
                await this.loadGameState();
            }
        } catch (error) {
            console.error('연결 실패:', error);
            this.showConnectionError();
        }
    }

    async loadGameState() {
        try {
            const response = await fetch('/api/game-state');
            if (response.ok) {
                const gameState = await response.json();
                this.updateFromGameState(gameState);
            }
        } catch (error) {
            console.error('게임 상태 로드 실패:', error);
        }
    }

    updateFromGameState(gameState) {
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
        
        // 접속자 수 업데이트
        document.getElementById('playerCount').textContent = gameState.connectedPlayers || 0;
    }

    startPolling() {
        // 1초마다 게임 상태 폴링
        this.pollInterval = setInterval(async () => {
            if (this.connected) {
                await this.loadGameState();
                
                // 타이머 업데이트를 위한 추가 폴링
                try {
                    const timerResponse = await fetch('/api/game-timer');
                    if (timerResponse.ok) {
                        const timerState = await timerResponse.json();
                        this.updateFromGameState(timerState);
                    }
                } catch (error) {
                    console.error('타이머 업데이트 실패:', error);
                }
            }
        }, 1000);
    }

    generateMaze() {
        // 미로는 서버에서 생성되므로 클라이언트에서는 불필요
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

        // 페이지 언로드 시 연결 해제
        window.addEventListener('beforeunload', () => {
            if (this.connected) {
                navigator.sendBeacon('/api/game-state', JSON.stringify({ action: 'disconnect' }));
            }
        });
    }

    async handleVote(e) {
        if (!this.gameActive || this.atExit || !this.connected) return;
        
        const direction = e.currentTarget.dataset.direction;
        
        try {
            const response = await fetch('/api/game-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'vote', direction })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.votes = result.votes;
                    this.updateRanking();
                }
            }
        } catch (error) {
            console.error('투표 실패:', error);
            this.showConnectionError();
        }
        
        // 버튼 클릭 효과
        e.currentTarget.style.transform = 'scale(0.9)';
        setTimeout(() => {
            e.currentTarget.style.transform = '';
        }, 100);
    }

    updateRanking() {
        const rankingList = document.getElementById('rankingList');
        
        const voteData = [
            { direction: 'up', arrow: '↑', votes: this.votes.up, color: 'up' },
            { direction: 'down', arrow: '↓', votes: this.votes.down, color: 'down' },
            { direction: 'left', arrow: '←', votes: this.votes.left, color: 'left' },
            { direction: 'right', arrow: '→', votes: this.votes.right, color: 'right' }
        ];

        const filteredData = voteData.filter(item => item.votes > 0);
        filteredData.sort((a, b) => b.votes - a.votes);

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

    updateTimerDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        document.getElementById('countdown').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    reachExit() {
        this.updateGameStatus();
        
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.classList.add('disabled');
        });
    }

    resetGame() {
        this.renderMaze();
        this.updateDisplay();
        this.updateGameStatus();
        
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