import { getGameStateManager } from './shared-state.js';

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
        const gameManager = getGameStateManager();
        
        // 타이머 업데이트 및 이동 처리
        gameManager.updateTimer();
        
        res.status(200).json(gameManager.getState());
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}