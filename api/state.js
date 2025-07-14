import { getGameState, resetGame } from '../utils/gameState';

export default function handler(req, res) {
    if (req.method === 'POST') {
        resetGame();
    }
    res.status(200).json(getGameState());
}
