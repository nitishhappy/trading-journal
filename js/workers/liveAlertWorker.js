// ===================== LIVE ALERTS TIMER WORKER ===================== //
// This Web Worker runs a setInterval that is NOT throttled by mobile
// browsers when the main tab is in the background.  It simply posts a
// "tick" message every N milliseconds so the main thread can run the
// live evaluation.

let timerId = null;

self.addEventListener('message', (e) => {
  const { command, interval } = e.data;

  if (command === 'start') {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => self.postMessage({ type: 'tick' }), interval || 60000);
    // Send an immediate first tick
    self.postMessage({ type: 'tick' });
  }

  if (command === 'stop') {
    if (timerId) clearInterval(timerId);
    timerId = null;
  }
});
