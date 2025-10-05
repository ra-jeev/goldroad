// require('dotenv').config();

const { setGlobalOptions } = require('firebase-functions/v2');
setGlobalOptions({ region: 'asia-south1' });

const users = require('./users');
const userGames = require('./userGames');
const games = require('./games');
const triggers = require('./triggers');
const messaging = require('./messaging');
const gameManagement = require('./game-management');

exports.users = users;
exports.userGames = userGames;
exports.games = games;
exports.triggers = triggers;
exports.messaging = messaging;
exports.gameManagement = gameManagement;
