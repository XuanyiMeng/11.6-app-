import assert from 'node:assert/strict';
import { initializeMediaPipe, withMediaPipeDiagnostics } from '../lib/mediapipe-diagnostics.ts';
const originalError = console.error, originalInfo = console.info;
const errors = [], info = [];
console.error = (...args) => errors.push(args);
console.info = (...args) => info.push(args);
const spy = console.error;
try {
  const value = withMediaPipeDiagnostics(() => {
    console.error('INFO: Created TensorFlow Lite XNNPACK delegate for CPU.');
    console.error('A real inference error', { code: 7 });
    return 42;
  });
  assert.equal(value, 42);
  assert.equal(info.length, 1);
  assert.equal(errors.length, 1);
  assert.equal(errors[0][0], 'A real inference error');
  assert.equal(console.error, spy);
  assert.throws(() => withMediaPipeDiagnostics(() => { throw new Error('inference failed'); }), /inference failed/);
  assert.equal(console.error, spy);
  let cachedStderr;
  await initializeMediaPipe(async () => { await Promise.resolve(); cachedStderr = console.error.bind(console); });
  assert.equal(console.error, spy);
  cachedStderr('INFO: Created TensorFlow Lite XNNPACK delegate for CPU.');
  cachedStderr('A real cached runtime error');
  assert.equal(info.length, 2);
  assert.equal(errors.length, 2);
  await assert.rejects(initializeMediaPipe(async () => { throw new Error('init failed'); }), /init failed/);
  assert.equal(console.error, spy);
} finally { console.error = originalError; console.info = originalInfo; }
console.log('PASS: startup info rerouted; real errors and thrown failures preserved; logger restored.');
