/** MediaPipe caches console.error as its WASM stderr callback at initialization.
 * Route its exact informational CPU startup line to info; all other diagnostics
 * retain their original severity. The adapter must cover model creation too.
 */
function adaptStderr() {
  const original = console.error;
  const forward: typeof console.error = (...args: unknown[]) => {
    if (args.map(String).join(' ').trim() === 'INFO: Created TensorFlow Lite XNNPACK delegate for CPU.') console.info(...args);
    else original.apply(console, args);
  };
  console.error = forward;
  return () => { console.error = original; };
}
export function withMediaPipeDiagnostics<T>(inference: () => T): T {
  const restore = adaptStderr();
  try { return inference(); }
  finally { restore(); }
}
export async function initializeMediaPipe<T>(initialize: () => Promise<T>): Promise<T> {
  const restore = adaptStderr();
  try { return await initialize(); }
  finally { restore(); }
}
