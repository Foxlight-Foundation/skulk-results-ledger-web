import assert from 'node:assert/strict';
import test from 'node:test';

import { hasFullyKnownHardware } from '../src/data/hardware.ts';

test('accepts only complete canonical hardware class shapes', () => {
  assert.equal(hasFullyKnownHardware(['apple-24gb']), true);
  assert.equal(hasFullyKnownHardware(['amd-128gb', 'apple-16gb']), true);
  assert.equal(hasFullyKnownHardware(['nvidia-a40-48gb']), true);

  assert.equal(hasFullyKnownHardware([]), false);
  assert.equal(hasFullyKnownHardware(['unknown']), false);
  assert.equal(hasFullyKnownHardware(['unknown-128gb']), false);
  assert.equal(hasFullyKnownHardware(['amd-128gb', 'unknown']), false);
  assert.equal(hasFullyKnownHardware(['apple']), false);
  assert.equal(hasFullyKnownHardware(['amd']), false);
  assert.equal(hasFullyKnownHardware(['nvidia']), false);
  assert.equal(hasFullyKnownHardware(['intel']), false);
});
