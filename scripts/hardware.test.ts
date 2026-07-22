import assert from 'node:assert/strict';
import test from 'node:test';

import { hasFullyKnownHardware } from '../src/data/hardware.ts';
import { profileOf } from './hardware-taxonomy.ts';

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

test('exact hardware identity ignores probe-byte drift but separates chips and tiers', () => {
  const base = profileOf([{
    acceleratorVendor: 'amd',
    acceleratorName: 'AMD GPU',
    ramTotalBytes: 65_957_408_768,
    vramTotalBytes: 68_719_476_736,
    gttTotalBytes: 133_143_986_176,
  }], true);
  const drifted = profileOf([{
    acceleratorVendor: 'amd',
    acceleratorName: 'AMD GPU',
    ramTotalBytes: 65_957_404_672,
  }], true);
  const otherChip = profileOf([{
    acceleratorVendor: 'amd',
    acceleratorName: 'AMD Other GPU',
    ramTotalBytes: 65_957_404_672,
  }], true);

  assert.equal(base.profileId, drifted.profileId);
  assert.notEqual(base.profileId, otherChip.profileId);
  assert.equal(base.label, 'AMD 128GB');
});
