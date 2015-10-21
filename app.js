"use strict";

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var q = require('q');

var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/score');

app.use(express.static(__dirname + '/public'));

var first = 0;

var players = [];
var games = [];
var gameTypes = [];

var playersCol = db.get('players');
var gameTypesCol = db.get('gameTypes');
var gamesCol = db.get('games');

var game = null;

Array.prototype.find = function (cb) {
    for (var i = 0, maxi = this.length; i < maxi; i++) {
        if (cb(this[i])) {
            return this[i];
        }
    }
};

io.on('connection', function (socket) {

    var admin = socket.handshake.address === '::1';

    function getGame() {
        if (game != null) {
            var innings = game.left + game.right;
            var feeds = game.gameType.feeds;
            var scoreLimit = game.gameType.scoreLimit;
            var pass = (Math.floor(innings / feeds)) % 2;
            return {
                left: game.left, right: game.right,
                playerLeftName: game.playerLeft ? game.playerLeft.name : '',
                playerRightName: game.playerLeft ? game.playerRight.name : '',
                pass: (pass + first) % 2,
                innings, feeds, scoreLimit, gameStarted: true
            };
        } else {
            return {
                admin,
                gameStarted: false
            };
        }
    }

    function checkGame() {
        if (game) {
            var max = Math.max(game.left, game.right);
            var dif = game.left - game.right;
            if (max >= game.gameType.scoreLimit && Math.abs(dif) >= 2) {
                game.winner = dif > 0 ? game.playerLeft : game.playerRight;
                gamesCol.insert(game);
                io.emit('finish', game);
                game = null;
                return false;
            }
            return true;
        }
    }

    if (admin) {
        socket.on('left', function (msg) {
            if (game) {
                game.left += msg.count;
                game.left = game.left >= 0 ? game.left : 0;
                if (checkGame()) {
                    if (msg.count > 0) {
                        game.moves.push({left: game.left, right: game.right});
                    } else if (game.moves.length > 0) {
                        game.moves.pop();
                    }
                }
                io.emit('game', getGame());
            }
        });

        socket.on('right', function (msg) {
            if (game) {
                game.right += msg.count;
                game.right = game.right >= 0 ? game.right : 0;
                if (checkGame()) {
                    if (msg.count > 0) {
                        game.moves.push({left: game.left, right: game.right});
                    } else if (game.moves.length > 0) {
                        game.moves.pop();
                    }
                }
                io.emit('game', getGame());
            }
        });

        socket.on('first', function () {
            if (game) {
                first = first ? 0 : 1;
                io.emit('game', getGame());
            }
        });

        socket.on('abort', function () {
            if (game) {
                game = null;
                io.emit('game', getGame());
            }
        });

        socket.on('get', function () {
            playersCol.find({}, {}, function (e, list) {
                io.emit('game', {players: list});
                players = list;
            });

            gameTypesCol.find({}, {}, function (e, list) {
                io.emit('game', {gameTypes: list});
                gameTypes = list;
            });

            io.emit('game', getGame());
        });

        socket.on('start', function (msg) {
            if (!msg.gameTypeId || !msg.playerLeftId || !msg.playerRightId || msg.playerLeftId == msg.playerRightId) return;

            game = {
                playerLeft: players.find(function (item) { return item._id == msg.playerLeftId }),
                playerRight: players.find(function (item) { return item._id == msg.playerRightId }),
                gameType: gameTypes.find(function (item) { return item._id == msg.gameTypeId }),
                moves: [],
                left: 0,
                right: 0,
                winner: null,
                startTime: +(new Date())
            };

            console.log('game started...');

            io.emit('game', getGame());
        });

    } else {
        socket.on('get', function () {
            playersCol.find({}, {}, function (e, list) {
                io.emit('game', {players: list});
            });

            io.emit('game', getGame());
        });
    }

    io.emit('app-start');

});

http.listen(3000, function () {
    console.log('listening on *:3000');
});