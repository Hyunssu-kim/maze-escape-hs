import { getGameStateManager } from './shared-state.js';

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

    const gameManager = getGameStateManager();

    if (req.method === 'GET') {
        // 게임 상태 반환
        res.status(200).json(gameManager.getState());
    } else if (req.method === 'POST') {
        const { action, direction } = req.body;
        
        if (action === 'vote' && direction) {
            const success = gameManager.addVote(direction);
            if (success) {
                res.status(200).json({ success: true, votes: gameManager.getState().votes });
            } else {
                res.status(400).json({ error: 'Invalid direction' });
            }
        } else if (action === 'connect') {
            gameManager.connect();
            res.status(200).json({ success: true, players: gameManager.getState().connectedPlayers });
        } else if (action === 'disconnect') {
            gameManager.disconnect();
            res.status(200).json({ success: true, players: gameManager.getState().connectedPlayers });
        } else {
            res.status(400).json({ error: 'Invalid action' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}