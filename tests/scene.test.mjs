// Run with: node --test tests/scene.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { blendAt, centroid, project, mixCam, narrowCam, strand } = createRequire(import.meta.url)('../scene.js');

test('the view holds still while its own section is centred', () => {
  const centers = [500, 1500, 2500];

  assert.deepEqual(blendAt(centers, 0), { i: 0, t: 0 });
  assert.deepEqual(blendAt(centers, 700), { i: 0, t: 0 });
  assert.deepEqual(blendAt(centers, 1400), { i: 0, t: 1 });
  assert.deepEqual(blendAt(centers, 1600), { i: 1, t: 0 });
});

test('the camera is halfway when the viewport is halfway between two sections', () => {
  assert.deepEqual(blendAt([500, 1500, 2500], 1000), { i: 0, t: 0.5 });
});

test('scrolling past the last section keeps the last view', () => {
  assert.deepEqual(blendAt([500, 1500, 2500], 9000), { i: 1, t: 1 });
});

test('a page with one section never reads past its end', () => {
  assert.deepEqual(blendAt([500], 9000), { i: 0, t: 0 });
});

test('a section focuses on the middle of the nodes it names', () => {
  const nodes = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 2, y: 4 }, { id: 'c', x: 9, y: 9 }];

  assert.deepEqual(centroid(nodes, ['a', 'b']), { x: 1, y: 2 });
});

test('a section that names no node, or an unknown one, looks at the origin', () => {
  const nodes = [{ id: 'a', x: 3, y: 3 }];

  assert.deepEqual(centroid(nodes, []), { x: 0, y: 0 });
  assert.deepEqual(centroid(nodes, ['missing']), { x: 0, y: 0 });
});

test('the focus point lands on the camera anchor, and zoom scales distance from it', () => {
  // Arrange: an 800 x 600 view, focus (1, 1) pinned three quarters across and halfway down, zoom 2
  const cam = { fx: 1, fy: 1, zoom: 2, ax: 0.75, ay: 0.5 }, view = { w: 800, h: 600 };

  // Act and assert: one world unit is zoom x half the height = 600px
  assert.deepEqual(project({ x: 1, y: 1 }, cam, view), { x: 600, y: 300 });
  assert.deepEqual(project({ x: 1.5, y: 0.5 }, cam, view), { x: 900, y: 0 });
});

test('the camera blends every setting between two sections', () => {
  const a = { fx: 0, fy: 0, zoom: 1, ax: 0.5, ay: 0.5 }, b = { fx: 2, fy: -2, zoom: 3, ax: 0.7, ay: 0.3 };

  assert.deepEqual(mixCam(a, b, 0), a);
  assert.deepEqual(mixCam(a, b, 0.5), { fx: 1, fy: -1, zoom: 2, ax: 0.6, ay: 0.4 });
});

test('a strand is two pieces that share a midpoint and its thin width', () => {
  // Act: a horizontal strand, 10 long, swayed by a fifth of its length
  const [first, second] = strand({ x: 0, y: 0 }, { x: 10, y: 0 }, 0.2, 4, 1);

  // Assert: the midpoint is pushed sideways, both pieces meet there, thick at the ends and thin in the middle
  assert.deepEqual(first, [0, 0, 5, 2, 4, 1]);
  assert.deepEqual(second, [5, 2, 10, 0, 1, 4]);
});

test('on an upright phone the web starts small above the headline, then grows and settles mid-screen', () => {
  // Arrange: a section camera focused on (1, -1) at zoom 2
  const cam = { fx: 1, fy: -1, zoom: 2, ax: 0.74, ay: 0.5 };
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);

  // Act: the first screen (overview 1) and any later section (overview 0)
  const first = narrowCam(cam, 1), later = narrowCam(cam, 0);

  // Assert: the focus is kept; only the zoom and the anchor change, and the web is never dropped from the screen
  assert.deepEqual([first.fx, first.fy, later.fx, later.fy], [1, -1, 1, -1]);
  near(first.zoom, 0.76); near(first.ax, 0.42); near(first.ay, 0.25);
  near(later.zoom, 1); near(later.ax, 0.5); near(later.ay, 0.5);
});
