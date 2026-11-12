// Run with: node --test tests/grip.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { edgePoint, nearestEdge, landing, layout, pieces } = createRequire(import.meta.url)('../grip.js');

// A 200 x 100 box at (10, 20): its edge is 600 long, so each side is a known share of the loop.
const box = { left: 10, top: 20, width: 200, height: 100 };
// Positions come from dividing and multiplying, so they are compared to six decimal places, not bit for bit.
const tidy = (point) => Object.fromEntries(Object.entries(point).map(([key, value]) => [key, Math.round(value * 1e6) / 1e6 + 0]));
const at = (s) => tidy(edgePoint(box, s));
// A repeatable stand-in for the hold's own random numbers.
const chance = (i) => { const v = Math.sin(i * 12.9898 + 4.2) * 43758.5453; return v - Math.floor(v); };

test('the edge is one loop, clockwise from the top-left corner, with a normal pointing into the box', () => {
  assert.deepEqual(at(0), { x: 10, y: 20, nx: 0, ny: 1, fromCorner: 0 });
  assert.deepEqual(at(100 / 600), { x: 110, y: 20, nx: 0, ny: 1, fromCorner: 100 });
  assert.deepEqual(at(250 / 600), { x: 210, y: 70, nx: -1, ny: 0, fromCorner: 50 });
  assert.deepEqual(at(400 / 600), { x: 110, y: 120, nx: 0, ny: -1, fromCorner: 100 });
  assert.deepEqual(at(550 / 600), { x: 10, y: 70, nx: 1, ny: 0, fromCorner: 50 });
});

test('a place past the end of the loop wraps round to its start', () => {
  assert.deepEqual(at(1 + 100 / 600), at(100 / 600));
  assert.deepEqual(at(-50 / 600), at(550 / 600));
});

test('the hold starts on the side of the box that faces the web', () => {
  // Arrange: one point far to the right of the box, one far below it, one inside near the left edge
  const right = { x: 900, y: 70 }, below = { x: 110, y: 900 }, inside = { x: 15, y: 70 };

  // Act and assert: each lands on the facing edge
  assert.deepEqual(at(nearestEdge(box, right)), { x: 210, y: 70, nx: -1, ny: 0, fromCorner: 50 });
  assert.deepEqual(at(nearestEdge(box, below)), { x: 110, y: 120, nx: 0, ny: -1, fromCorner: 100 });
  assert.deepEqual(at(nearestEdge(box, inside)), { x: 10, y: 70, nx: 1, ny: 0, fromCorner: 50 });
});

// A tile, a wide project button and a pill, each held by a knot of the web far to its right and a little below.
const shapes = [
  { name: 'tile', box: { left: 64, top: 200, width: 640, height: 400 }, radius: 18 },
  { name: 'button', box: { left: 64, top: 640, width: 180, height: 44 }, radius: 999 },
  { name: 'label', box: { left: 900, top: 300, width: 120, height: 30 }, radius: 999 },
];
const knotFor = (b) => ({ x: 5000, y: b.top + b.height * 0.6 });

test('a button is taken at the nearest point of its edge', () => {
  const { box: b, radius } = shapes[1], land = landing(b, knotFor(b), radius);
  assert.equal(land.tile, false);
  assert.deepEqual([land.x, land.nx, land.ny], [b.left + b.width, -1, 0]);
});

test('a tile is taken by the corner nearest the knot, and the hand opens toward its middle', () => {
  // Arrange: the knot is to the right and slightly below the middle, so the nearest corner is the bottom-right one
  const { box: b, radius } = shapes[0];

  // Act
  const land = landing(b, knotFor(b), radius);

  // Assert: it lands just inside that corner (a rounded corner sits inside the sharp one) and points up and left
  assert.equal(land.tile, true);
  assert.ok(land.x < b.left + b.width && land.x > b.left + b.width - 20, `x ${land.x}`);
  assert.ok(land.y < b.top + b.height && land.y > b.top + b.height - 20, `y ${land.y}`);
  assert.ok(land.nx < 0 && land.ny < 0);
});

test('a hold stays on the same corner while the tile moves or tilts', () => {
  // The knot's place is remembered against the box, so a box that has moved and grown gives the same corner.
  const { box: b, radius } = shapes[0], knot = knotFor(b);
  const rel = { x: (knot.x - b.left) / b.width, y: (knot.y - b.top) / b.height };
  const moved = { left: b.left + 37, top: b.top - 12, width: b.width + 9, height: b.height + 6 };
  const before = landing(b, knot, radius), after = landing(moved, { x: moved.left + rel.x * moved.width, y: moved.top + rel.y * moved.height }, radius);
  assert.equal(Math.round(before.s * 1000), Math.round(after.s * 1000));
  assert.ok(Math.abs(after.x - (moved.left + moved.width)) < 20 && Math.abs(after.y - (moved.top + moved.height)) < 20);
});

for (const shape of shapes) {
  const land = landing(shape.box, knotFor(shape.box), shape.radius);
  const tendrils = layout(shape.box, land, shape.radius, chance);

  test(`a ${shape.name} is held by many tendrils, and every tip rests on its face`, () => {
    assert.ok(tendrils.length >= 6 && tendrils.length <= 18, `${tendrils.length} tendrils`);
    for (const t of tendrils) {
      assert.ok(t.tip.x > shape.box.left && t.tip.x < shape.box.left + shape.box.width, `tip x ${t.tip.x}`);
      assert.ok(t.tip.y > shape.box.top && t.tip.y < shape.box.top + shape.box.height, `tip y ${t.tip.y}`);
    }
  });

  test(`the tendrils on a ${shape.name} are of clearly different sizes`, () => {
    const widths = tendrils.map((t) => t.width);
    assert.ok(Math.max(...widths) / Math.min(...widths) >= 4, `thickest ${Math.max(...widths)}, thinnest ${Math.min(...widths)}`);
  });

  test(`no tendril on a ${shape.name} lies along its outline`, () => {
    // A tendril that followed the edge would have both ends within a few pixels of the same side.
    const b = shape.box, nearSide = (p) => [p.y - b.top, b.left + b.width - p.x, b.top + b.height - p.y, p.x - b.left].map((gap) => Math.abs(gap) < 2);
    for (const t of tendrils) {
      const root = nearSide(t.root), tip = nearSide(t.tip);
      assert.ok(!root.some((on, side) => on && tip[side]), 'a tendril runs along one side');
    }
  });
}

test('on a tile no tendril reaches far over the words', () => {
  // The hand in the corner and the tendrils over the edges all stay short: none is longer than 70px.
  const { box: b, radius } = shapes[0];
  for (const t of layout(b, landing(b, knotFor(b), radius), radius, chance)) {
    assert.ok(Math.hypot(t.tip.x - t.root.x, t.tip.y - t.root.y) <= 70, 'a tendril is too long');
  }
});

test('a hold keeps its shape: the same random numbers give the same tendrils', () => {
  const { box: b, radius } = shapes[0], land = landing(b, knotFor(b), radius);
  assert.deepEqual(layout(b, land, radius, chance), layout(b, land, radius, chance));
});

test('the fan grows out of the end of the web\'s own tendril', () => {
  // Arrange: the web's tendril ends just inside the tile's bottom-right corner
  const { box: b, radius } = shapes[0], palm = { x: 690, y: 590 };

  // Act
  const tendrils = layout(b, landing(b, knotFor(b), radius), radius, chance, palm);

  // Assert: several tendrils share that point as their root
  assert.ok(tendrils.filter((t) => t.root.x === palm.x && t.root.y === palm.y).length >= 3);
});

test('a tendril is two strands that meet, thick at the root and almost nothing at the tip', () => {
  // Arrange: a straight 100px tendril, 8px thick, running to the right
  const tendril = { root: { x: 0, y: 0 }, tip: { x: 100, y: 0 }, bow: 0, width: 8 };

  // Act
  const [first, second] = pieces(tendril, 1, 0);

  // Assert: root to middle to tip, half-widths falling from 4px to well under 1px, and no pulse
  assert.deepEqual(first.slice(0, 4), [0, 0, 50, 0]);
  assert.deepEqual(second.slice(0, 4), [50, 0, 100, 0]);
  assert.equal(first[4], 4);
  assert.equal(first[5], second[4]);
  assert.ok(second[5] < 1 && second[5] > 0);
  assert.equal(first[6], -9);
});

test('a tendril that has only half arrived stops half-way along', () => {
  const tendril = { root: { x: 0, y: 0 }, tip: { x: 100, y: 0 }, bow: 0, width: 8 };
  const [, second] = pieces(tendril, 0.5, 0);
  assert.deepEqual(second.slice(2, 4), [50, 0]);
});

test('a bowed tendril curves aside and still ends on its tip', () => {
  const tendril = { root: { x: 0, y: 0 }, tip: { x: 100, y: 0 }, bow: 0.4, width: 8 };
  const [first, second] = pieces(tendril, 1, 0);
  assert.ok(Math.abs(first[3]) > 10, `the middle sits ${first[3]}px off the straight line`);
  assert.deepEqual(second.slice(2, 4), [100, 0]);
});

test('a corner with a control on it is left alone: the hold takes the next nearest corner', () => {
  // Arrange: the knot is nearest the tile's top-right corner, which holds the close button
  const { box: b, radius } = shapes[0], knot = { x: b.left + b.width + 300, y: b.top - 50 };

  // Act
  const usual = landing(b, knot, radius), kept = landing(b, knot, radius, 1);

  // Assert: normally the top-right corner; with it kept clear, the bottom-right one
  assert.ok(usual.y < b.top + 30 && usual.x > b.left + b.width - 30);
  assert.ok(kept.y > b.top + b.height - 30 && kept.x > b.left + b.width - 30);
});
