import { addVote, getGameState } from '../utils/gameState';

export default function handler(req, res) {
    if (req.method === 'POST') {
        const { direction } = req.body;
        if (addVote(direction)) {
            res.status(200).json({ success: true, votes: getGameState().votes });
        } else {
            res.status(400).json({ success: false, message: 'Invalid vote' });
        }
    } else {
        res.status(405).end(); // Method Not Allowed
    }
}