declare module 'js-cookie';

// Legacy gestalt-understanding games attach preloaded <audio> elements to the
// global window for cross-component playback, and browser-utils sniffs the
// non-standard window.chrome object. Declare them so strict TS stops flagging
// the dynamic property access.
interface Window {
  clickSound?: HTMLAudioElement
  correctSound?: HTMLAudioElement
  incorrectSound?: HTMLAudioElement
  chrome?: { webstore?: unknown; runtime?: unknown }
}
