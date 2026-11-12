// The tendril that follows the pointer takes hold of what it points at. Where it lands on a button or a tile it carries
// on over the edge and splits into tendrils of every size (thick ones, thin ones and threads), while more come over the
// other edges as if from behind. Nothing follows the outline. A tile is held by a corner, with a small hand, so its
// words stay readable.
// The tendrils are drawn by scene.js's own renderer on a small canvas laid over the held thing, so they are the same
// wet, lit material as the web behind the page and join onto it. Homepage only.
(function (root) {
  'use strict';

  // A box's edge as one loop: s runs from 0 to 1, clockwise from the top-left corner. (nx, ny) points into the box,
  // and `fromCorner` is how far along its side the point sits from the nearer corner.
  function edgePoint(box, s) {
    const w = box.width, h = box.height;
    let d = (((s % 1) + 1) % 1) * 2 * (w + h);
    if (d < w) return { x: box.left + d, y: box.top, nx: 0, ny: 1, fromCorner: Math.min(d, w - d) };
    d -= w;
    if (d < h) return { x: box.left + w, y: box.top + d, nx: -1, ny: 0, fromCorner: Math.min(d, h - d) };
    d -= h;
    if (d < w) return { x: box.left + w - d, y: box.top + h, nx: 0, ny: -1, fromCorner: Math.min(d, w - d) };
    d -= w;
    return { x: box.left, y: box.top + h - d, nx: 1, ny: 0, fromCorner: Math.min(d, h - d) };
  }

  // Where on that loop is the point of the edge closest to p?
  function nearestEdge(box, p) {
    const w = box.width, h = box.height;
    const x = Math.min(Math.max(p.x, box.left), box.left + w), y = Math.min(Math.max(p.y, box.top), box.top + h);
    const gaps = [y - box.top, box.left + w - x, box.top + h - y, x - box.left]; // to the top, right, bottom and left edge
    const side = gaps.indexOf(Math.min(...gaps));
    const along = [x - box.left, w + (y - box.top), w + h + (box.left + w - x), 2 * w + h + (box.top + h - y)][side];
    return along / (2 * (w + h));
  }

  const clamp = (v, low, high) => Math.min(Math.max(v, low), high);
  const turn = (v, angle) => ({ x: v.x * Math.cos(angle) - v.y * Math.sin(angle), y: v.x * Math.sin(angle) + v.y * Math.cos(angle) });
  const INSET = 3;          // px: a tip never rests closer than this to the edge, so nothing lies along the outline
  const NO_PULSE = -9;      // what scene.js's renderer reads as "no pulse on this strand"
  const TILE_AREA = 40000;  // px²: above this the thing held is a tile with words to keep clear, not a button

  // Where a hold lands, given where the web's knot is. A button is taken at the nearest point of its edge. A tile is
  // taken by the corner nearest the knot, where there is least to read, and the hand opens toward the tile's middle.
  // `s` is the landing's place on the edge loop; (nx, ny) is the way in.
  // `clear` names a corner to stay off (0 top-left, then clockwise), for a tile with a control there.
  function landing(box, from, radius, clear) {
    const around = 2 * (box.width + box.height), tile = box.width * box.height > TILE_AREA;
    if (!tile) {
      const s = nearestEdge(box, from), p = edgePoint(box, s);
      return { s, x: p.x, y: p.y, nx: p.nx, ny: p.ny, tile };
    }
    const right = box.left + box.width, bottom = box.top + box.height;
    const corners = [[box.left, box.top, 0], [right, box.top, box.width], [right, bottom, box.width + box.height], [box.left, bottom, 2 * box.width + box.height]];
    const far = (c) => Math.hypot(c[0] - from.x, c[1] - from.y);
    const corner = corners.filter((c, i) => i !== clear).reduce((best, c) => (far(c) < far(best) ? c : best));
    const dx = box.left + box.width / 2 - corner[0], dy = box.top + box.height / 2 - corner[1], d = Math.hypot(dx, dy) || 1;
    const inset = Math.min(radius, box.width / 2, box.height / 2) * 0.45 + 2; // a rounded corner sits inside the sharp one
    return { s: corner[2] / around, x: corner[0] + (dx / d) * inset, y: corner[1] + (dy / d) * inset, nx: dx / d, ny: dy / d, tile };
  }

  // Every tendril of one hold, as plain numbers: where it roots, where its tip rests (always on the face), how far
  // its middle bows aside (as a share of its length), how thick it is at the root, and how late it starts to grow.
  // The fan all roots at `origin`, the end of the web's own tendril, so the hold grows out of it like a hand.
  // `chance(i)` gives a repeatable number from 0 to 1 for each i, so a hold keeps its shape while it lasts.
  function layout(box, land, radius, chance, origin) {
    const small = Math.min(box.width, box.height), tile = land.tile;
    const scale = tile ? 0.72 : clamp(small / 120, 0.45, 1); // finer on a small button, so its words stay readable
    const corner = Math.min(radius, small / 2), palm = origin || { x: land.x, y: land.y };
    const tendrils = [];
    const add = (from, heading, length, width, delay, bow) => {
      const tip = { x: clamp(from.x + heading.x * length, box.left + INSET, box.left + box.width - INSET), y: clamp(from.y + heading.y * length, box.top + INSET, box.top + box.height - INSET) };
      tendrils.push({ root: from, tip, bow, width, delay });
      return tip;
    };

    // The fan: from where the tendril lands, spreading over the face. Thick, medium and thread take turns. On a tile
    // it is a small hand in the corner; on a button it may cross half of it.
    const fan = tile ? 3 + Math.floor(chance(1) * 2) : 5 + Math.floor(chance(1) * 3);
    const depth = Math.abs(land.nx) > Math.abs(land.ny) ? box.width : box.height;
    const reach = tile ? 30 + 24 * chance(3) : clamp(depth * 0.5, 22, 96);
    const open = tile ? 0.7 : 1.15; // radians either side of straight in; a corner only opens a quarter-turn
    const inward = { x: land.nx, y: land.ny };
    for (let k = 0; k < fan; k++) {
      const share = k / (fan - 1) - 0.5;
      const heading = turn(inward, share * 2 * open + (chance(20 + k) - 0.5) * 0.4);
      const length = reach * (0.45 + 0.55 * chance(30 + k));
      const width = [8.5 + 5 * chance(40 + k), 3.5 + 2.5 * chance(40 + k), 1.3 + 1.1 * chance(40 + k)][k % 3] * scale;
      const tip = add(palm, heading, length, width, 0.05 * k, chance(50 + k) - 0.5);
      // A thick tendril throws off a thread part-way along.
      if (k % 3 === 0) add({ x: (palm.x + tip.x) / 2, y: (palm.y + tip.y) / 2 }, turn(heading, chance(60 + k) < 0.5 ? -0.7 : 0.7), length * 0.45, 1.1 * scale + 0.4, 0.25 + 0.05 * k, (chance(70 + k) - 0.5) * 0.9);
    }

    // The wrap: short tendrils coming over the other edges, as if the thing were held from behind. A tile gets more of
    // them, all round and unevenly spaced, since they are what holds it; none reaches far over the words.
    const wrap = tile ? 8 + Math.floor(chance(2) * 4) : 4 + Math.floor(chance(2) * 4);
    const first = tile ? 0.07 : 0.18, span = 1 - 2 * first;
    for (let j = 0; j < wrap; j++) {
      const point = edgePoint(box, land.s + first + (span * (j + chance(80 + j))) / wrap);
      if (point.fromCorner < corner * 0.9) continue; // a rounded corner has no straight edge to come over
      const length = (tile ? clamp(small * 0.09, 12, 36) : clamp(small * 0.34, 9, 80)) * (0.45 + 0.75 * chance(100 + j));
      const width = (j % 2 === 0 ? 4.5 + 5 * chance(110 + j) : 1.3 + 1.6 * chance(110 + j)) * scale;
      add({ x: point.x, y: point.y }, turn({ x: point.nx, y: point.ny }, (chance(90 + j) - 0.5) * 1.3), length, width, 0.3 + 0.06 * j, (chance(120 + j) - 0.5) * 0.9);
    }
    return tendrils;
  }

  // One tendril as the two strands the renderer draws: root to middle, middle to tip, along a bowed spine, thick at
  // the root and thinning to almost nothing. `grown` (0 to 1) is how much of it has arrived; `sway` adds to the bow
  // so it never holds quite still. Each strand is [x0, y0, x1, y1, halfWidth0, halfWidth1, pulse].
  function pieces(tendril, grown, sway) {
    const a = tendril.root, c = tendril.tip, bow = tendril.bow + sway, half = tendril.width / 2;
    const b = { x: (a.x + c.x) / 2 - (c.y - a.y) * bow, y: (a.y + c.y) / 2 + (c.x - a.x) * bow };
    const on = (s) => ({ x: (1 - s) * (1 - s) * a.x + 2 * s * (1 - s) * b.x + s * s * c.x, y: (1 - s) * (1 - s) * a.y + 2 * s * (1 - s) * b.y + s * s * c.y });
    const middle = on(grown / 2), end = on(grown);
    return [[a.x, a.y, middle.x, middle.y, half, half * 0.6, NO_PULSE], [middle.x, middle.y, end.x, end.y, half * 0.6, half * 0.14, NO_PULSE]];
  }

  if (typeof module === 'object' && module.exports) module.exports = { edgePoint, nearestEdge, landing, layout, pieces };
  if (typeof document === 'undefined') return;

  const scene = root.RayScene;
  if (!scene || !scene.painter) return;
  // A grip needs a pointer that hovers, and it is motion: people who turn motion down do not get it.
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  if (!matchMedia('(hover: hover)').matches) return;
  const allowed = () => !calm.matches && !scene.paused && document.documentElement.classList.contains('webgl');

  const TARGETS = '.card, .plate, .web__node, .hero .btn'; // a tile brought forward by lift.js is a .card too
  const GROW_PER_SECOND = 5;   // the hold closes in about half a second and lets go as fast
  const MAX_TENDRILS = 18;     // two strands each, plus the web's own tendril, stays inside the renderer's limit
  const LATE = 0.6;            // how much of a tendril's delay still applies, so all of them finish arriving
  const MARGIN = 96;           // px of canvas round the held thing: room for the arriving tendril and its veins
  const STEP = 64;             // the canvas is sized in steps, so a tile that tilts does not resize it every frame
  const DOME = 0.022;          // the renderer's dome depth, as a share of its detail size (see scene.js draw)
  const PULSE_PER_SECOND = 1.6; // one red pulse runs down the web's tendril as it takes hold

  const canvas = document.createElement('canvas');
  canvas.className = 'grip';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.display = 'none'; // shown only while something is held, so it costs nothing at rest
  document.body.append(canvas);

  // `anchor` is where the web's knot was when the hold began, measured against the box. The landing is worked out
  // from it every frame, so it stays on the same corner or edge point however the knot or the box then moves.
  let brush, broken = false, wide = 0, tall = 0, held = null, box = null, source = -1, anchor = null, radius = 0, grow = 0, age = 0, seed = 0, last = 0, running = false;
  const boxOf = (el) => (el.classList.contains('web__node') ? el.querySelector('.web__label') || el : el);
  const chance = (i) => { const v = Math.sin(i * 12.9898 + seed) * 43758.5453; return v - Math.floor(v); };

  function letGo() {
    canvas.style.display = 'none';
    scene.hold = null;
    scene.pulse = -1;
    held = null; // pointing at the same thing again takes hold afresh
    running = false;
  }

  function frame(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05); // the first frame's clock can read earlier than the pointer event's
    last = now;
    if (held && (!held.isConnected || !allowed())) held = null; // gone, or motion was paused or turned down: let go
    if (held) {
      const rect = boxOf(held).getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) held = null; // a hidden label has nothing to hold
      else box = rect;
    }
    grow = Math.max(0, grow + ((held ? 1 : 0) - grow) * Math.min(1, dt * GROW_PER_SECOND));
    age += dt;
    if (!box || (!held && grow < 0.01)) { letGo(); return; }
    requestAnimationFrame(frame);

    // The hold comes from one knot of the web, chosen when it starts. scene.js sends its tendril from that knot to
    // the landing.
    if (!anchor) {
      source = scene.from(box);
      const knot = scene.where(source);
      anchor = { x: (knot.x - box.left) / box.width, y: (knot.y - box.top) / box.height };
    }
    const land = landing(box, { x: box.left + anchor.x * box.width, y: box.top + anchor.y * box.height }, radius, held && held.dataset.gripClear ? Number(held.dataset.gripClear) : -1);
    const pulse = age * PULSE_PER_SECOND;
    scene.hold = held ? { x: land.x, y: land.y, from: source } : null;
    scene.pulse = held && pulse < 1.1 ? pulse : -1;

    // The canvas sits over the held thing with room to spare; everything below is in its own pixels. It grows at
    // once but only shrinks when a whole step too big, so a tile tilting across a step does not resize it each frame.
    const left = Math.floor(box.left - MARGIN), top = Math.floor(box.top - MARGIN);
    const fit = (size, current) => { const need = Math.ceil((size + 2 * MARGIN) / STEP) * STEP; return need > current || need < current - STEP ? need : current; };
    wide = fit(box.width, wide); tall = fit(box.height, tall);
    const w = Math.round(wide * scene.sharp), h = Math.round(tall * scene.sharp);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      canvas.style.width = `${wide}px`; canvas.style.height = `${tall}px`;
    }
    canvas.style.transform = `translate(${left}px, ${top}px)`;
    const here = (g, beat) => [g[0] - left, g[1] - top, g[2] - left, g[3] - top, g[4], g[5], beat];

    // First the web's own tendril, exactly as scene.js drew it behind the page, so it carries on over the edge.
    const reach = scene.reach, palm = reach ? reach.tip : land;
    const strands = reach ? reach.pieces.map((g, half) => here(g, scene.pulse < 0 ? NO_PULSE : scene.pulse * 2 - half)) : [];
    const tendrils = layout(box, land, radius, chance, { x: palm.x, y: palm.y }).slice(0, MAX_TENDRILS);
    tendrils.forEach((tendril, i) => {
      const grown = clamp((grow - tendril.delay * LATE) / (1 - tendril.delay * LATE), 0, 1);
      if (grown < 0.03) return;
      pieces(tendril, 1 - (1 - grown) * (1 - grown), Math.sin(now / 620 + i * 1.7) * 0.04).forEach((g) => strands.push(here(g, NO_PULSE)));
    });
    const widest = Math.max(...tendrils.map((tendril) => tendril.width)) / 2;
    scene.draw(brush, canvas, [], strands, scene.time, widest / (DOME * scene.height), scene.height);
  }

  // Building the renderer compiles a large shader, so it is done once, in idle time after load, not on the first grab.
  function prepare() {
    if (brush || broken) return;
    try { brush = scene.painter(canvas); } catch (err) { console.warn('grip: could not set up its canvas, so tendrils will not take hold.', err); }
    if (!brush) broken = true;
  }
  (root.requestIdleCallback || ((run) => setTimeout(run, 1500)))(prepare);
  // If the browser takes the drawing context away, stop for good rather than leave the web reaching for nothing.
  canvas.addEventListener('webglcontextlost', () => { broken = true; letGo(); });

  // `again` asks a hold already under way to choose its knot and corner afresh: lift.js uses it once a tile it has
  // brought forward has arrived, since the tile is then somewhere else and a different size.
  function take(el, again) {
    if (el && (broken || !allowed())) el = null;
    if (el === held) { if (el && again) anchor = null; return; }
    held = el;
    if (!el) return;
    prepare();
    if (broken) { held = null; return; }
    canvas.style.display = '';
    anchor = null;
    grow = 0;
    age = 0;
    seed = Math.random() * 100;
    radius = parseFloat(getComputedStyle(boxOf(el)).borderTopLeftRadius) || 0;
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  }
  scene.take = take; // lift.js hands over a tile it is bringing forward, so the tendril carries it

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    take(e.target instanceof Element ? e.target.closest(TARGETS) : null);
  });
  document.documentElement.addEventListener('pointerleave', () => take(null));
})(typeof window === 'undefined' ? globalThis : window);
