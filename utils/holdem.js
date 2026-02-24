const { createDeck, shuffle, bestHand, compareScore } = require('./poker');

const INITIAL_CHIPS = 200;
const SMALL_BLIND = 1;
const BIG_BLIND = 2;
const STREETS = ['preflop', 'flop', 'turn', 'river', 'showdown'];

function nextActive(players, from) {
  let idx = from;
  for (let i = 0; i < players.length; i += 1) {
    idx = (idx + 1) % players.length;
    if (!players[idx].folded && !players[idx].allIn && players[idx].chips > 0) return idx;
  }
  return -1;
}

function createRoom(host) {
  return {
    roomId: `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`,
    hostId: host.id,
    status: 'waiting',
    maxPlayers: 10,
    minPlayers: 2,
    players: [{ ...host, chips: INITIAL_CHIPS, seat: 0, ready: true }],
    game: null,
    createdAt: Date.now()
  };
}

function joinRoom(room, user) {
  if (room.status !== 'waiting') throw new Error('牌局已开始，不能加入');
  if (room.players.length >= room.maxPlayers) throw new Error('房间已满（最多10人）');
  if (room.players.some((p) => p.id === user.id)) return room;
  room.players.push({ ...user, chips: INITIAL_CHIPS, seat: room.players.length, ready: true });
  return room;
}

function startGame(room) {
  if (room.players.length < room.minPlayers) throw new Error('至少2人才能开始');
  const deck = shuffle(createDeck());
  const dealer = room.game ? (room.game.dealer + 1) % room.players.length : 0;
  const sbSeat = (dealer + 1) % room.players.length;
  const bbSeat = (dealer + 2) % room.players.length;
  const players = room.players.map((p) => ({
    ...p,
    hand: [deck.pop(), deck.pop()],
    folded: false,
    allIn: false,
    committed: 0,
    acted: false
  }));

  postBlind(players[sbSeat], SMALL_BLIND);
  postBlind(players[bbSeat], BIG_BLIND);

  room.status = 'playing';
  room.game = {
    deck,
    pot: players[sbSeat].committed + players[bbSeat].committed,
    board: [],
    dealer,
    street: 'preflop',
    currentBet: BIG_BLIND,
    turn: nextActive(players, bbSeat),
    lastAggressor: bbSeat,
    players,
    log: [`小盲 ${players[sbSeat].name} 投注 ${SMALL_BLIND}`, `大盲 ${players[bbSeat].name} 投注 ${BIG_BLIND}`]
  };

  return room;
}

function postBlind(player, amount) {
  const paid = Math.min(player.chips, amount);
  player.chips -= paid;
  player.committed += paid;
  if (player.chips === 0) player.allIn = true;
}

function applyAction(room, playerId, action, raiseTo) {
  const g = room.game;
  if (!g || room.status !== 'playing') throw new Error('牌局未进行中');
  const idx = g.players.findIndex((p) => p.id === playerId);
  if (idx !== g.turn) throw new Error('未轮到该玩家操作');
  const player = g.players[idx];
  const toCall = Math.max(0, g.currentBet - player.committed);

  if (action === 'fold') {
    player.folded = true;
    g.log.push(`${player.name} 弃牌`);
  } else if (action === 'check') {
    if (toCall > 0) throw new Error('当前不能过牌');
    g.log.push(`${player.name} 过牌`);
  } else if (action === 'call') {
    const paid = Math.min(player.chips, toCall);
    player.chips -= paid;
    player.committed += paid;
    g.pot += paid;
    if (player.chips === 0) player.allIn = true;
    g.log.push(`${player.name} 跟注 ${paid}`);
  } else if (action === 'raise') {
    if (!raiseTo || raiseTo <= g.currentBet) throw new Error('加注额无效');
    const need = raiseTo - player.committed;
    if (need > player.chips) throw new Error('筹码不足');
    player.chips -= need;
    player.committed += need;
    g.pot += need;
    g.currentBet = player.committed;
    g.lastAggressor = idx;
    g.players.forEach((p, i) => {
      if (i !== idx && !p.folded && !p.allIn) p.acted = false;
    });
    if (player.chips === 0) player.allIn = true;
    g.log.push(`${player.name} 加注到 ${raiseTo}`);
  } else if (action === 'allin') {
    const total = player.committed + player.chips;
    const need = player.chips;
    player.chips = 0;
    player.committed = total;
    player.allIn = true;
    g.pot += need;
    if (total > g.currentBet) {
      g.currentBet = total;
      g.lastAggressor = idx;
      g.players.forEach((p, i) => {
        if (i !== idx && !p.folded && !p.allIn) p.acted = false;
      });
    }
    g.log.push(`${player.name} 全下 ${total}`);
  }

  player.acted = true;

  const alive = g.players.filter((p) => !p.folded);
  if (alive.length === 1) {
    alive[0].chips += g.pot;
    g.log.push(`${alive[0].name} 获胜底池 ${g.pot}`);
    room.players = g.players.map(stripRoundState);
    room.status = 'waiting';
    room.game = null;
    return room;
  }

  if (isStreetComplete(g)) {
    advanceStreet(room);
    return room;
  }

  g.turn = nextActive(g.players, idx);
  return room;
}

function isStreetComplete(g) {
  const contenders = g.players.filter((p) => !p.folded && !p.allIn);
  if (contenders.length === 0) return true;
  return contenders.every((p) => p.acted && p.committed === g.currentBet);
}

function advanceStreet(room) {
  const g = room.game;
  const streetIndex = STREETS.indexOf(g.street);
  if (streetIndex <= 2) {
    const drawCount = g.street === 'preflop' ? 3 : 1;
    for (let i = 0; i < drawCount; i += 1) g.board.push(g.deck.pop());
  }

  if (g.street === 'river') {
    settleShowdown(room);
    return;
  }

  g.street = STREETS[streetIndex + 1];
  g.currentBet = 0;
  g.players.forEach((p) => {
    p.committed = 0;
    p.acted = false;
  });
  g.turn = nextActive(g.players, g.dealer);
  g.log.push(`进入 ${g.street}`);
}

function settleShowdown(room) {
  const g = room.game;
  const alive = g.players.filter((p) => !p.folded);
  const scored = alive.map((p) => ({
    player: p,
    result: bestHand([...p.hand, ...g.board])
  }));

  scored.sort((a, b) => compareScore(b.result.score, a.result.score));
  const best = scored[0].result.score;
  const winners = scored.filter((s) => compareScore(s.result.score, best) === 0);
  const split = Math.floor(g.pot / winners.length);
  winners.forEach((w) => {
    w.player.chips += split;
  });

  g.log.push(`摊牌：${winners.map((w) => w.player.name).join('、')} 平分底池 ${g.pot}`);
  room.players = g.players.map(stripRoundState);
  room.status = 'waiting';
  room.game = null;
}

function stripRoundState(p) {
  const { hand, folded, allIn, committed, acted, ...rest } = p;
  return rest;
}

module.exports = {
  createRoom,
  joinRoom,
  startGame,
  applyAction,
  INITIAL_CHIPS,
  SMALL_BLIND,
  BIG_BLIND
};
