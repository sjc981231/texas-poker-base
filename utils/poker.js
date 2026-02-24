const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function shuffle(deck) {
  const arr = deck.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cardLabel(card) {
  const map = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  return `${map[card.rank] || card.rank}${card.suit}`;
}

function combinations(cards, k) {
  const res = [];
  function dfs(start, path) {
    if (path.length === k) {
      res.push(path.slice());
      return;
    }
    for (let i = start; i < cards.length; i += 1) {
      path.push(cards[i]);
      dfs(i + 1, path);
      path.pop();
    }
  }
  dfs(0, []);
  return res;
}

function scoreFive(cards) {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const rankCount = {};
  const suitCount = {};
  for (const card of cards) {
    rankCount[card.rank] = (rankCount[card.rank] || 0) + 1;
    suitCount[card.suit] = (suitCount[card.suit] || 0) + 1;
  }

  const uniqueRanks = [...new Set(ranks)];
  const isFlush = Object.values(suitCount).some((v) => v === 5);
  let straightHigh = 0;
  if (uniqueRanks.length === 5) {
    const max = uniqueRanks[0];
    const min = uniqueRanks[4];
    if (max - min === 4) {
      straightHigh = max;
    }
    if (JSON.stringify(uniqueRanks) === JSON.stringify([14, 5, 4, 3, 2])) {
      straightHigh = 5;
    }
  }

  const groups = Object.entries(rankCount)
    .map(([r, c]) => ({ rank: Number(r), count: c }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  const buildScore = (type, kickers) => [type, ...kickers];

  if (isFlush && straightHigh) return buildScore(8, [straightHigh]);
  if (groups[0].count === 4) return buildScore(7, [groups[0].rank, groups[1].rank]);
  if (groups[0].count === 3 && groups[1].count === 2) return buildScore(6, [groups[0].rank, groups[1].rank]);
  if (isFlush) return buildScore(5, ranks);
  if (straightHigh) return buildScore(4, [straightHigh]);
  if (groups[0].count === 3) {
    return buildScore(3, [groups[0].rank, ...groups.slice(1).map((g) => g.rank)]);
  }
  if (groups[0].count === 2 && groups[1].count === 2) {
    return buildScore(2, [groups[0].rank, groups[1].rank, groups[2].rank]);
  }
  if (groups[0].count === 2) {
    return buildScore(1, [groups[0].rank, ...groups.slice(1).map((g) => g.rank)]);
  }
  return buildScore(0, ranks);
}

function compareScore(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

function bestHand(sevenCards) {
  const all = combinations(sevenCards, 5);
  let best = all[0];
  let bestScore = scoreFive(best);
  for (let i = 1; i < all.length; i += 1) {
    const score = scoreFive(all[i]);
    if (compareScore(score, bestScore) > 0) {
      best = all[i];
      bestScore = score;
    }
  }
  return { cards: best, score: bestScore };
}

module.exports = {
  createDeck,
  shuffle,
  cardLabel,
  bestHand,
  compareScore
};
