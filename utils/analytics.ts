const analytics = {
  track(event: string, props?: Record<string, unknown>) {
    if (__DEV__) {
      console.log('[analytics]', event, props);
    }
  },
};

export default analytics;
