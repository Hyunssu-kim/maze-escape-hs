// Vercel KV를 사용한 게임 상태 관리 (시뮬레이션)
let gameState = {
    votes: { up: 0, down: 0, left: 0, right: 0 },
    timeLeft: 60,
    gameActive: true,
    atExit: false,
    playerPos: { x: 1, y: 1 },
    exitPos: { x: 13, y: 13 },
    connectedPlayers: 0,
    maze: null,
    lastUpdate: Date.now()
};

// 미로 생성 함수
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
    
    // 출구 설정
    maze[13][13] = 0;
    maze[12][13] = 0;
    maze[13][12] = 0;
    
    return maze;
}

// 초기 미로 생성
if (!gameState.maze) {
    gameState.maze = generateMaze();
}

export default function handler(req, res) {
    // CORS 설정
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'GET') {
        // 게임 상태 반환
        res.status(200).json(gameState);
    } else if (req.method === 'POST') {
        const { action, direction } = req.body;
        
        if (action === 'vote' && direction) {
            if (gameState.votes.hasOwnProperty(direction)) {
                gameState.votes[direction]++;
                gameState.lastUpdate = Date.now();
                res.status(200).json({ success: true, votes: gameState.votes });
            } else {
                res.status(400).json({ error: 'Invalid direction' });
            }
        } else if (action === 'connect') {
            gameState.connectedPlayers++;
            res.status(200).json({ success: true, players: gameState.connectedPlayers });
        } else if (action === 'disconnect') {
            gameState.connectedPlayers = Math.max(0, gameState.connectedPlayers - 1);
            res.status(200).json({ success: true, players: gameState.connectedPlayers });
        } else {
            res.status(400).json({ error: 'Invalid action' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}