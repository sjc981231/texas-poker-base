App({
  globalData: {
    user: null
  },
  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        traceUser: true
      });
    }
  }
});
