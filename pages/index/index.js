const { createRoom, joinRoom } = require('../../utils/holdem');

const db = wx.cloud ? wx.cloud.database() : null;

Page({
  data: {
    roomIdInput: '',
    currentRoomId: ''
  },

  onLoad(options) {
    this.ensureUser();
    if (options && options.roomId) {
      this.setData({ roomIdInput: options.roomId });
    }
  },

  ensureUser() {
    let user = wx.getStorageSync('poker_user');
    if (!user) {
      user = {
        id: `u_${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`,
        name: `玩家${Math.floor(Math.random() * 1000)}`
      };
      wx.setStorageSync('poker_user', user);
    }
    getApp().globalData.user = user;
  },

  async createRoom() {
    if (!db) return wx.showToast({ title: '请开启云开发', icon: 'none' });
    const user = getApp().globalData.user;
    const room = createRoom(user);
    await db.collection('rooms').doc(room.roomId).set({ data: room });
    this.setData({ currentRoomId: room.roomId });
    wx.showToast({ title: '房间创建成功' });
  },

  onRoomInput(e) {
    this.setData({ roomIdInput: e.detail.value.trim() });
  },

  async joinRoom() {
    if (!db) return wx.showToast({ title: '请开启云开发', icon: 'none' });
    const roomId = this.data.roomIdInput;
    if (!roomId) return wx.showToast({ title: '请输入房间ID', icon: 'none' });
    const user = getApp().globalData.user;

    try {
      const snap = await db.collection('rooms').doc(roomId).get();
      const room = joinRoom(snap.data, user);
      await db.collection('rooms').doc(roomId).update({ data: { players: room.players } });
      this.setData({ currentRoomId: roomId });
      wx.showToast({ title: '加入成功' });
    } catch (err) {
      wx.showToast({ title: err.message || '加入失败', icon: 'none' });
    }
  },

  gotoRoom() {
    if (!this.data.currentRoomId) return;
    wx.navigateTo({ url: `/pages/room/room?roomId=${this.data.currentRoomId}` });
  },

  prepareShare() {},

  onShareAppMessage() {
    const roomId = this.data.currentRoomId;
    return {
      title: `加入我的德州扑克房间：${roomId}`,
      path: `/pages/index/index?roomId=${roomId}`
    };
  }
});
