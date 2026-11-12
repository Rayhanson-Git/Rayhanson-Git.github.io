// Run with: node --test tests/lift.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { flight } = createRequire(import.meta.url)('../lift.js');

test('a tile brought forward starts its flight exactly where the small tile was', () => {
  // Arrange: the tile in the page, and the larger copy in the middle of a 1440 x 900 screen
  const tile = { left: 64, top: 200, width: 640, height: 400 }, forward = { left: 240, top: 150, width: 960, height: 600 };

  // Act
  const start = flight(tile, forward);

  // Assert: moved back to the tile's corner and shrunk to two thirds, so it covers the tile exactly
  assert.equal(start, 'translate(-176.0px, 50.0px) scale(0.6667, 0.6667)');
});

test('a tile that is already in place does not move', () => {
  const box = { left: 10, top: 20, width: 300, height: 200 };
  assert.equal(flight(box, box), 'translate(0.0px, 0.0px) scale(1.0000, 1.0000)');
});
