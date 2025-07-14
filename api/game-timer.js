// 게임 타이머 및 이동 처리
let gameState = {
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

function generateMaze() {
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

function movePlayer(direction, maze) {
    const newPos = { ...gameState.playerPos };
    
    switch (direction) {
        case 'up': newPos.y--; break;
        case 'down': newPos.y++; break;
        case 'left': newPos.x--; break;
        case 'right': newPos.x++; break;
    }
    
    if (newPos.x >= 0 && newPos.x < 15 && 
        newPos.y >= 0 && newPos.y < 15 && 
        maze[newPos.y][newPos.x] === 0) {
        
        gameState.playerPos = newPos;
        
        if (gameState.playerPos.x === gameState.exitPos.x && 
            gameState.playerPos.y === gameState.exitPos.y) {
            gameState.atExit = true;
        }
        
        return true;
    }
    
    return false;
}

if (!gameState.maze) {
    gameState.maze = generateMaze();
}

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'GET') {
        // 타이머 체크 및 이동 처리
        const now = Date.now();
        const timeSinceLastMove = now - gameState.lastMoveTime;
        
        // 60초마다 이동
        if (timeSinceLastMove >= 60000 && !gameState.atExit) {
            const maxVotes = Math.max(...Object.values(gameState.votes));
            
            if (maxVotes > 0) {
                const winningDirections = Object.keys(gameState.votes)
                    .filter(dir => gameState.votes[dir] === maxVotes);
                const winningDirection = winningDirections[
                    Math.floor(Math.random() * winningDirections.length)
                ];
                
                movePlayer(winningDirection, gameState.maze);
            }
            
            // 투표 리셋
            gameState.votes = { up: 0, down: 0, left: 0, right: 0 };
            gameState.lastMoveTime = now;
        }
        
        // 남은 시간 계산
        gameState.timeLeft = Math.max(0, 60 - Math.floor(timeSinceLastMove / 1000));
        gameState.lastUpdate = now;
        
        res.status(200).json(gameState);
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}