import express from 'express';
import { login, callback, topTracks, current, pause, play, status, logoutHandler } from '../controllers/spotifyController';

const router = express.Router();

router.get('/login', login);
router.get('/callback', callback);
router.get('/status', status);
router.get('/top', topTracks);
router.get('/current', current);
router.put('/pause', pause);
router.put('/play', play);

module.exports = router;
