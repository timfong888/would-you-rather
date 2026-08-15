/**
 * Thin analytics wrapper — SAT-808 will swap this body for posthog-react-native.
 * All UI code must import from here; never import the SDK directly.
 */
const analytics = {
  track(event: string, props?: Record<string, unknown>) {
    if (__DEV__) {
      console.log('[analytics]', event, props);
    }
  },
};

export default analytics;
