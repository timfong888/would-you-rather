// Decide how the upload workflow should end once the polling loop stops.
// A build can sit in PROCESSING on Apple's side for 15+ minutes after a perfectly good upload,
// so running out of patience while PROCESSING is not a failure: end green with a clear notice.
// Real failures (Apple says FAILED, or we never got a state at all) stay red.
export function uploadOutcome(lastState) {
  if (lastState === 'COMPLETE') return { exitCode: 0, kind: 'complete', message: 'Upload processed by Apple (COMPLETE).' };
  if (lastState === 'FAILED') return { exitCode: 1, kind: 'failed', message: 'Apple reported the upload as FAILED. See the errors above.' };
  if (lastState === 'PROCESSING') {
    return {
      exitCode: 0,
      kind: 'still-processing',
      message: `Uploaded, still processing on Apple's side (last state: ${lastState}). Not an error. Run Apple ops "builds" until the build shows VALID.`,
    };
  }
  // This only runs after every part was PUT and Apple accepted the commit, so a state still stuck at
  // AWAITING_UPLOAD after the whole wait means Apple never registered the file: stuck or lost, not slow.
  if (lastState === 'AWAITING_UPLOAD') {
    return { exitCode: 1, kind: 'stuck', message: 'Upload was committed but Apple still reports AWAITING_UPLOAD after the full wait: it looks stuck or lost, not slow. Check Apple ops "builds"; re-run the upload if the build never appears.' };
  }
  return { exitCode: 1, kind: 'unknown', message: `No usable upload state (last state: ${lastState || 'none'}). Check TestFlight / run Apple ops "builds".` };
}
