const assert = require('assert');
const { createRoom, joinRoom, startGame, applyAction, INITIAL_CHIPS, SMALL_BLIND, BIG_BLIND } = require('../utils/holdem');

const a = { id: 'a', name: 'A' };
const b = { id: 'b', name: 'B' };

let room = createRoom(a);
assert.strictEqual(room.players[0].chips, INITIAL_CHIPS);
room = joinRoom(room, b);
assert.strictEqual(room.players.length, 2);
room = startGame(room);
assert.strictEqual(room.status, 'playing');
assert.strictEqual(room.game.players.length, 2);
assert.strictEqual(room.game.pot, SMALL_BLIND + BIG_BLIND);

const turn = room.game.players[room.game.turn].id;
room = applyAction(room, turn, 'call');
const turn2 = room.game.players[room.game.turn].id;
room = applyAction(room, turn2, 'check');
assert.ok(room.game.street === 'flop' || room.status === 'waiting');

console.log('holdem test passed');
