const { startGame, applyAction } = require('../../utils/holdem');
const { cardLabel } = require('../../utils/poker');

const db = wx.cloud ? wx.cloud.database() : null;

Page({
  data: {
    roomId: '',
    room: null,
    isHost: false,
    hostName: '',
    turnName: '',
    myHandLabels: [],
    boardLabels: [],
    canAct: false,
    raiseTo: '',
    logs: []
  },

  onLoad(options) {
    const roomId = options.roomId;
    this.setData({ roomId });
    this.listenRoom();
  },

  onUnload() {
    if (this.watcher) this.watcher.close();
  },

  listenRoom() {
    if (!db) return;
    this.watcher = db.collection('rooms').doc(this.data.roomId).watch({
      onChange: (snap) => {
        const room = snap.docs[0];
        if (!room) return;
        this.hydrate(room);
      },
      onError: () => wx.showToast({ title: '房间监听失败', icon: 'none' })
    });
  },

  hydrate(room) {
    const me = getApp().globalData.user;
    const isHost = room.hostId === me.id;
    const host = room.players.find((p) => p.id === room.hostId);
    const g = room.game;
    const meInGame = g && g.players.find((p) => p.id === me.id);

    this.setData({
      room,
      isHost,
      hostName: host ? host.name : '-',
      turnName: g ? g.players[g.turn]?.name || '-' : '-',
      myHandLabels: meInGame ? meInGame.hand.map(cardLabel) : [],
      boardLabels: g ? g.board.map(cardLabel) : [],
      canAct: !!(g && g.players[g.turn] && g.players[g.turn].id === me.id),
      logs: g ? g.log.slice(-12) : []
    });
  },

  async startGame() {
    try {
      const snap = await db.collection('rooms').doc(this.data.roomId).get();
      const room = startGame(snap.data);
      await db.collection('rooms').doc(this.data.roomId).update({ data: { status: room.status, game: room.game, players: room.players } });
    } catch (err) {
      wx.showToast({ title: err.message || '开始失败', icon: 'none' });
    }
  },

  onRaiseInput(e) {
    this.setData({ raiseTo: e.detail.value });
  },

  async handleAction(action) {
    try {
      const me = getApp().globalData.user;
      const snap = await db.collection('rooms').doc(this.data.roomId).get();
      const room = applyAction(snap.data, me.id, action, Number(this.data.raiseTo));
      await db.collection('rooms').doc(this.data.roomId).update({ data: { status: room.status, game: room.game, players: room.players } });
      this.setData({ raiseTo: '' });
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    }
  },

  actCheck() { this.handleAction('check'); },
  actCall() { this.handleAction('call'); },
  actFold() { this.handleAction('fold'); },
  actAllin() { this.handleAction('allin'); },
  actRaise() { this.handleAction('raise'); }
});
