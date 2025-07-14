document.addEventListener('DOMContentLoaded', () => {
    // Vercel 환경에 맞게 Socket.IO 연결 경로를 명시적으로 설정합니다.
    const socket = io({ path: '/socket.io' });

    const mazeElement = document.getElementById('maze');
    const playerXElement = document.getElementById('playerX');
    const playerYElement = document.getElementById('playerY');
    const playerCountElement = document.getElementById('playerCount');
    const countdownElement = document.getElementById('countdown');
    const gameStatusElement = document.getElementById('gameStatus');
    const rankingListElement = document.getElementById('rankingList');
    const voteButtons = document.querySelectorAll('.vote-btn');

    let mazeData = [];
    let playerPos = { x: 1, y: 1 };
    let exitPos = { x: 13, y: 13 };

    function renderMaze() {
        mazeElement.innerHTML = '';
        mazeElement.style.gridTemplateColumns = `repeat(${mazeData.length}, 1fr)`;
        for (let y = 0; y < mazeData.length; y++) {
            for (let x = 0; x < mazeData[y].length; x++) {
                const cell = document.createElement('div');
                cell.className = 'maze-cell';
                if (mazeData[y][x] === 1) cell.classList.add('wall');
                if (x === playerPos.x && y === playerPos.y) cell.classList.add('player');
                if (x === exitPos.x && y === exitPos.y) cell.classList.add('exit');
                if (x === 1 && y === 1) cell.classList.add('start');
                mazeElement.appendChild(cell);
            }
        }
    }

    function updateUI(state) {
        if (JSON.stringify(mazeData) !== JSON.stringify(state.maze) || 
            playerPos.x !== state.playerPos.x || playerPos.y !== state.playerPos.y) {
            mazeData = state.maze;
            playerPos = state.playerPos;
            exitPos = state.exitPos;
            renderMaze();
        }
        
        playerXElement.textContent = state.playerPos.x;
        playerYElement.textContent = state.playerPos.y;
        playerCountElement.textContent = state.connectedPlayers;

        const minutes = Math.floor(state.timeLeft / 60).toString().padStart(2, '0');
        const seconds = (state.timeLeft % 60).toString().padStart(2, '0');
        countdownElement.textContent = `${minutes}:${seconds}`;

        if (state.atExit) {
            gameStatusElement.textContent = `RESET IN ${state.timeLeft}`;
            gameStatusElement.classList.add('exit-reached');
            voteButtons.forEach(btn => btn.disabled = true);
        } else {
            gameStatusElement.textContent = 'VOTING';
            gameStatusElement.classList.remove('exit-reached');
            voteButtons.forEach(btn => btn.disabled = false);
        }

        const voteData = Object.entries(state.votes)
            .map(([direction, votes]) => ({ direction, votes }))
            .filter(item => item.votes > 0)
            .sort((a, b) => b.votes - a.votes);

        if (voteData.length === 0) {
            rankingListElement.innerHTML = '<div class="no-votes">No votes yet</div>';
        } else {
            rankingListElement.innerHTML = voteData.map((item, index) => {
                const rankClass = index < 3 ? `rank-${index + 1}` : '';
                const arrow = { up: '↑', down: '↓', left: '←', right: '→' }[item.direction];
                return `
                    <div class="ranking-item ${rankClass}">
                        <div class="rank-arrow">${arrow}</div>
                        <div class="rank-votes">${item.votes}</div>
                    </div>
                `;
            }).join('');
        }
    }

    voteButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const direction = btn.dataset.direction;
            socket.emit('vote', direction);
        });
    });

    socket.on('game-state', (state) => {
        updateUI(state);
    });

    socket.on('players-update', (count) => {
        playerCountElement.textContent = count;
    });

    socket.on('connect_error', (err) => {
        console.error("Connection failed:", err.message);
        mazeElement.innerHTML = `<div class="loading">Connection Error: ${err.message}. Please refresh.</div>`;
    });

    mazeElement.innerHTML = '<div class="loading">Connecting to server...</div>';
});