// A living web: one black node for each project, joined by strands that sway, reach for the cursor and fire.
// Drawn as a single distance field in a fragment shader, so nodes and strands melt into one body.
(function (root) {
  'use strict';

  // Which two sections the viewport centre sits between, and how far the camera has travelled.
  // The view holds for the first and last 30% of the way, so it is still while its section is read.
  function blendAt(centers, y) {
    const last = centers.length - 1;
    if (last < 1 || y <= centers[0]) return { i: 0, t: 0 };
    if (y >= centers[last]) return { i: last - 1, t: 1 };
    let i = 0;
    while (y >= centers[i + 1]) i++;
    const f = (y - centers[i]) / (centers[i + 1] - centers[i]);
    const s = Math.min(1, Math.max(0, (f - 0.3) / 0.4));
    return { i, t: s * s * (3 - 2 * s) };
  }

  // The middle of the named nodes; the world origin when none are named.
  function centroid(nodes, ids) {
    const picked = nodes.filter((n) => ids.includes(n.id));
    if (!picked.length) return { x: 0, y: 0 };
    return { x: picked.reduce((s, n) => s + n.x, 0) / picked.length, y: picked.reduce((s, n) => s + n.y, 0) / picked.length };
  }

  // World to screen: the camera's focus lands on its anchor, and one world unit is zoom x half the viewport height.
  function project(p, cam, view) {
    const k = (cam.zoom * view.h) / 2;
    return { x: cam.ax * view.w + (p.x - cam.fx) * k, y: cam.ay * view.h + (p.y - cam.fy) * k };
  }

  function mixCam(a, b, t) {
    const m = (key) => a[key] + (b[key] - a[key]) * t;
    return { fx: m('fx'), fy: m('fy'), zoom: m('zoom'), ax: m('ax'), ay: m('ay') };
  }

  // A strand is two tapered pieces that meet at a midpoint pushed sideways, thick at the nodes and thin between.
  function strand(a, b, sway, wEnd, wMid) {
    const mx = (a.x + b.x) / 2 - (b.y - a.y) * sway, my = (a.y + b.y) / 2 + (b.x - a.x) * sway;
    return [[a.x, a.y, mx, my, wEnd, wMid], [mx, my, b.x, b.y, wMid, wEnd]];
  }

  if (typeof module === 'object' && module.exports) module.exports = { blendAt, centroid, project, mixCam, strand };
  if (typeof document === 'undefined') return;

  const MAX_NODES = 16, MAX_SEGS = 40;
  const NARROW_ZOOM = 0.38;
  const SAMPLE_FRAMES = 12, SLOW_FRAME_MS = 22, SLOW_SHARE = 8; // 8 of 12 frames over 22ms counts as slow
  const SAG = 0.07; // how far a strand's middle hangs, as a share of its length // on a phone the whole web sits small above the headline
  const VERTEX = 'attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }';
  const FRAGMENT = `
#extension GL_OES_standard_derivatives : enable
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform vec4 uNode[${MAX_NODES}];  // x, y, radius, flash; lengths in viewport heights
uniform vec4 uSeg[${MAX_SEGS}];    // ax, ay, bx, by
uniform vec3 uTaper[${MAX_SEGS}];  // width at a, width at b, pulse position along the piece
uniform int uNodes, uSegs;
uniform float uSmooth, uDepth, uLift, uTime, uRim;
uniform vec3 uInk, uBone, uSignal, uSheen;

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

// Distance to the whole body. fire collects the red of flashing nodes and travelling pulses.
// fine adds the veins and threads; the shadow pass leaves them out to save work.
float body(vec2 p, out float fire, float fine) {
  // The outline never holds still: slow noise pushes the whole field about, so every edge crawls.
  vec2 q = p / uLift;
  p += (vec2(noise(q * 7.0 + uTime * 0.13), noise(q * 7.0 + 19.3 - uTime * 0.11)) - 0.5) * 0.024 * uLift;
  p += (vec2(noise(q * 19.0 - uTime * 0.2), noise(q * 19.0 + 7.1 + uTime * 0.17)) - 0.5) * 0.009 * uLift;
  float d = 1000.0;
  fire = 0.0;
  for (int i = 0; i < ${MAX_NODES}; i++) {
    if (i >= uNodes) break;
    vec4 n = uNode[i];
    float seed = float(i) * 1.7;
    vec2 v = p - n.xy;
    float away = length(v), turn = atan(v.y, v.x);
    // A node is a small knot, not a disc: lobes swell and travel round its rim.
    float core = n.z * 0.43;
    float lobes = 0.11 * sin(turn * 3.0 + uTime * 0.6 + seed) + 0.07 * sin(turn * 7.0 - uTime * 0.9 + seed * 2.0) + 0.04 * sin(uTime * 0.8 + seed);
    d = smin(d, away - core * (1.0 + lobes), uSmooth);
    fire += n.w * smoothstep(n.z * 1.0, 0.0, away);
    // Veins, bead and drip reach under four radii from the knot; pixels further off skip them.
    if (fine > 0.5 && away < n.z * 4.0) {
      // Veins creep out of the knot in nine directions, bending as they go and tapering to nothing.
      // A third are thick, a third thin, and a third are hairs that run furthest and wander most.
      for (int k = 0; k < 9; k++) {
        float fk = float(k);
        float aim = seed * 2.4 + fk * 0.698 + 0.3 * sin(uTime * 0.3 + seed + fk);
        float thin = mod(fk, 3.0) * 0.5;
        float run = n.z * (1.1 + 0.9 * thin + 1.2 * fract(sin(seed * 12.9 + fk * 78.2) * 43758.5));
        float bend = turn - aim - (0.3 + 0.25 * thin) * sin(away / n.z * 1.8 + uTime * 0.5 + fk * 2.0) * max(away / n.z - 0.6, 0.0);
        bend = mod(bend + 3.14159, 6.28318) - 3.14159;
        float along = away * cos(bend);
        float taper = clamp(1.0 - (along - core * 0.6) / run, 0.0, 1.0);
        float vein = (abs(bend) < 1.57 ? away * abs(sin(bend)) : away) - n.z * mix(0.042, 0.011, thin) * taper;
        d = smin(d, max(vein, along - (core * 0.6 + run)), uSmooth * 0.4);
      }
      // A bead of goo circles the knot, pulling away until it necks, then sinking back in.
      float orbit = uTime * (0.35 + 0.1 * sin(seed)) + seed * 2.3;
      vec2 bead = n.xy + vec2(cos(orbit), sin(orbit)) * n.z * (1.0 + 0.4 * sin(uTime * 0.6 + seed * 1.3));
      d = smin(d, length(p - bead) - n.z * 0.047, uSmooth * 0.8);
      // Every other knot drips: a thread hangs under it, stretching and drawing back, with a drop at its tip.
      if (mod(float(i), 2.0) < 1.0) {
        vec2 tip = n.xy + vec2(n.z * 0.2 * sin(uTime * 0.7 + seed), n.z * (1.3 + 0.9 * pow(0.5 + 0.5 * sin(uTime * 0.35 + seed * 3.1), 2.0)));
        vec2 ba = tip - n.xy;
        float h = clamp(dot(v, ba) / max(dot(ba, ba), 0.000001), 0.0, 1.0);
        d = smin(d, length(v - ba * h) - n.z * mix(0.072, 0.016, h), uSmooth * 0.6);
        d = smin(d, length(p - tip) - n.z * 0.043, uSmooth * 0.4);
      }
    }
  }
  for (int i = 0; i < ${MAX_SEGS}; i++) {
    if (i >= uSegs) break;
    vec4 s = uSeg[i];
    vec3 t = uTaper[i];
    vec2 pa = p - s.xy, ba = s.zw - s.xy;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.000001), 0.0, 1.0);
    float away = length(pa - ba * h);
    // Thick liquid beads on a thread: small swellings slide along each tendril.
    float beads = pow(0.5 + 0.5 * sin(h * 11.0 - uTime * 1.3 + float(i) * 2.1), 3.0);
    float w = mix(t.x, t.y, h) * (1.0 + 0.4 * beads);
    float pulse = exp(-(h - t.z) * (h - t.z) / 0.0256); // a pulse is a bulge that travels down the tendril
    d = smin(d, away - w * (1.0 + 2.2 * pulse), uSmooth * 0.6);
    fire += pulse * smoothstep(w * 7.0, 0.0, away);
    float wide = max(t.x, t.y), fi = float(i);
    // The side threads, capillaries and drip stay within twelve widths of the tendril; pixels further off skip them.
    if (fine > 0.5 && away < wide * 12.0) {
      // A tendril is a bundle: two finer threads run beside it, bowing apart and closing again like stretched sinew.
      vec2 across = normalize(vec2(-ba.y, ba.x) + 0.00001);
      float arc = sin(h * 3.14159);
      d = smin(d, length(pa - ba * h - across * arc * (1.0 + 0.5 * sin(uTime * 0.5 + fi)) * wide * 2.6) - wide * 0.34, uSmooth * 0.3);
      d = smin(d, length(pa - ba * h + across * arc * (0.8 + 0.5 * sin(uTime * 0.4 + fi * 1.7 + 2.0)) * wide * 3.8) - wide * 0.22, uSmooth * 0.25);
      // Capillaries: three hair-thin veins leave the tendril on alternate sides, curl as they go and taper to nothing.
      vec2 along = vec2(across.y, -across.x);
      for (int k = 0; k < 3; k++) {
        float fk = float(k);
        vec2 root = s.xy + ba * (0.2 + 0.3 * fk + 0.08 * sin(fi * 3.1 + fk * 5.0));
        vec2 dir = normalize(across * (mod(fk + fi, 2.0) < 1.0 ? 1.0 : -1.0) + along * 0.7 * sin(fi * 1.3 + fk * 2.0));
        float len = wide * (6.0 + 4.0 * fract(sin(fi * 12.9 + fk * 78.2) * 43758.5)) * (0.8 + 0.2 * sin(uTime * 0.3 + fi + fk * 1.7));
        vec2 pr = p - root;
        float hh = clamp(dot(pr, dir) / len, 0.0, 1.0);
        float curl = sin(hh * 3.14159) * len * 0.2 * sin(uTime * 0.4 + fi * 2.0 + fk);
        d = smin(d, length(pr - dir * len * hh - vec2(-dir.y, dir.x) * curl) - wide * mix(0.26, 0.04, hh), uSmooth * 0.2);
      }
      // And a short drip hangs from its middle, lengthening and drawing back.
      vec2 hang = p - (s.xy + ba * 0.5);
      float fall = wide * (2.2 + 1.8 * sin(uTime * 0.4 + fi * 1.9));
      float down = clamp(hang.y / fall, 0.0, 1.0);
      d = smin(d, length(hang - vec2(0.0, fall) * down) - wide * mix(0.36, 0.07, down), uSmooth * 0.4);
      d = smin(d, length(hang - vec2(0.0, fall)) - wide * 0.22, uSmooth * 0.3);
    }
  }
  return d;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes.y;
  float fire, unused;
  float d = body(p, fire, 1.0);
  vec2 slope = vec2(dFdx(d), -dFdy(d));
  float px = max(length(slope), 0.00001);
  float inside = smoothstep(px, -px, d);

  // Fake depth: the body domes up from its edge.
  float depth = clamp(-d / uDepth, 0.0, 1.0);
  float dome = sqrt(depth * (2.0 - depth));
  // Wet skin: fine ripples crawl over the surface and break up the highlights.
  vec2 q = p / uLift;
  vec2 flow = q * 15.0 + vec2(noise(q * 5.0 + uTime * 0.05), noise(q * 5.0 + 9.0 - uTime * 0.04)) * 2.4;
  float veins = pow(1.0 - abs(noise(flow) * 2.0 - 1.0), 7.0); // thin ridges that wander and branch like veins
  float hairs = pow(1.0 - abs(noise(flow * 2.6 + 31.0) * 2.0 - 1.0), 9.0); // a finer net between them
  float skin = noise(q * 34.0 + uTime * 0.25) * 0.55 + noise(q * 80.0 - uTime * 0.2) * 0.3 + veins * 1.3 + hairs * 0.7;
  vec2 ripple = vec2(dFdx(skin), -dFdy(skin)) / px * 0.008 * uLift;
  vec3 n = normalize(vec3((slope / px) * (1.0 - dome) - ripple, dome + 0.18));
  vec3 light = normalize(vec3(-0.55, -0.65, 0.55));
  float diff = max(dot(n, light), 0.0);
  float glint = max(reflect(-light, n).z, 0.0);
  float spec = pow(glint, 70.0), sheen = pow(glint, 8.0);
  float under = pow(max(dot(n, normalize(vec3(0.6, 0.55, 0.4))), 0.0), 3.0); // a faint red light from below
  float rim = pow(1.0 - dome, 3.0) * max(dot(slope / px, vec2(0.6, 0.7)), 0.0);
  rim += pow(1.0 - dome, 7.0) * uRim * 1.7; // a faint line round the whole edge keeps the black body off the dark ground
  vec3 col = uInk + uSheen * (0.2 * diff * dome + 0.1 * sheen) + uBone * (0.05 * diff + 0.95 * spec + 0.1 * sheen + 0.16 * rim) + uSignal * 0.09 * under * dome;
  col += (uSheen * 0.42 + uBone * 0.07) * (veins + hairs * 0.6) * dome; // the veins stand a little proud and paler
  col += uSignal * min(fire, 1.4) * (0.45 + 0.55 * dome);

  float shadow = smoothstep(0.03 * uLift, -0.015 * uLift, body(p - vec2(0.008, 0.016) * uLift, unused, 0.0)) * 0.2 * (1.0 - inside);
  float halo = min(fire, 1.0) * 0.4 * (1.0 - inside) * smoothstep(0.05 * uLift, 0.0, d);
  // Premultiplied: the shadow darkens the page, the halo tints it.
  gl_FragColor = vec4(col * inside + uSignal * halo, min(inside + shadow + halo * 0.8, 1.0));
}`;

  // Colours come from the page's tokens, so the scene follows the palette.
  function tokenRGB(name) {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0] / 255, d[1] / 255, d[2] / 255];
  }

  function start(canvas, web) {
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl || !gl.getExtension('OES_standard_derivatives')) return false;

    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const loc = {};
    ['uRes', 'uNode', 'uSeg', 'uTaper', 'uNodes', 'uSegs', 'uSmooth', 'uDepth', 'uLift', 'uTime', 'uRim', 'uInk', 'uBone', 'uSignal', 'uSheen']
      .forEach((n) => { loc[n] = gl.getUniformLocation(prog, n); });
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3fv(loc.uInk, tokenRGB('--color-goo'));
    gl.uniform3fv(loc.uBone, tokenRGB('--color-bone'));
    gl.uniform3fv(loc.uSignal, tokenRGB('--color-signal'));
    gl.uniform3fv(loc.uSheen, tokenRGB('--color-sheen'));
    gl.uniform1f(loc.uRim, parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--goo-rim')) || 0);
    gl.clearColor(0, 0, 0, 0);

    // Nodes and their links are read from the project links in the page, so the web and the markup cannot drift apart.
    const nodes = [...web.querySelectorAll('[data-node]')].slice(0, MAX_NODES - 1).map((el, i) => ({
      el, id: el.dataset.node, x: parseFloat(el.dataset.x), y: parseFloat(el.dataset.y), r: parseFloat(el.dataset.r),
      phase: i * 2.4, wants: 0, hover: 0, flash: 0, focus: 0, sx: 0, sy: 0, sr: 0,
    }));
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const mark = document.querySelector('.mark'), MARK_SHAPE = 410 / 724; // the logo mark's height over its width
    const links = [];
    nodes.forEach((n) => (n.el.dataset.links || '').split(' ').filter((id) => byId[id]).forEach((id) => {
      links.push({ a: n, b: byId[id], pulse: -1, back: false, phase: links.length * 1.7 });
    }));
    const sections = [...document.querySelectorAll('[data-zoom]')].map((el) => {
      const ids = (el.dataset.focus || '').split(' ').filter(Boolean), at = (el.dataset.at || '0.5,0.5').split(',').map(Number);
      const f = centroid(nodes, ids);
      return { el, ids, cam: { fx: f.x, fy: f.y, zoom: parseFloat(el.dataset.zoom), ax: at[0], ay: at[1] } };
    });
    if (nodes.length < 2 || sections.length < 2) return false;

    nodes.forEach((n) => {
      const on = () => { n.wants = 1; }, off = () => { n.wants = 0; };
      n.el.addEventListener('pointerenter', on);
      n.el.addEventListener('focus', on);
      n.el.addEventListener('pointerleave', off);
      n.el.addEventListener('blur', off);
    });

    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const state = root.RayScene = { level: 0, paused: false };
    let centers = [], W = 1, H = 1, sharp = Math.min(devicePixelRatio || 1, 1.1), dirty = true;

    function measure() {
      W = canvas.clientWidth; H = canvas.clientHeight;
      if (!W || !H) return; // still hidden; the observer calls back once the canvas is shown
      const w = Math.round(W * sharp), h = Math.round(H * sharp);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
      centers = sections.map((s) => { const r = s.el.getBoundingClientRect(); return r.top + scrollY + r.height / 2; });
      dirty = true;
    }
    const sized = new ResizeObserver(measure);
    sized.observe(document.body);
    sized.observe(canvas);
    addEventListener('resize', measure);
    measure();

    let mouseX = 0, mouseY = 0, mouseOn = false, tipX = 0, tipY = 0, reach = 0;
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      mouseX = e.clientX; mouseY = e.clientY;
      if (!mouseOn) { tipX = mouseX; tipY = mouseY; }
      mouseOn = true;
    }, { passive: true });
    document.addEventListener('pointerleave', () => { mouseOn = false; });

    const toggle = document.querySelector('[data-motion-toggle]');
    if (toggle) toggle.addEventListener('click', () => {
      state.paused = !state.paused;
      const name = state.paused ? 'Play motion' : 'Pause motion';
      toggle.setAttribute('aria-label', name);
      toggle.dataset.state = state.paused ? 'paused' : 'playing';
      const label = toggle.querySelector('[data-label]');
      if (label) label.textContent = name;
    });

    let alive = true;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); alive = false; document.documentElement.classList.remove('webgl'); });

    const nodeData = new Float32Array(MAX_NODES * 4), segData = new Float32Array(MAX_SEGS * 4), taperData = new Float32Array(MAX_SEGS * 3);
    let time = 0, level = 0, last = performance.now(), eye = scrollY + innerHeight / 2, seen = -1, slowFrames = 0, frames = 0, warmup = 45;

    function frame(now) {
      if (!alive) return;
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      // A shader this heavy can outrun a GPU: when most of a dozen frames run slow, draw fewer pixels.
      // One stutter is not counted as slowness, and neither are the first frames while the page loads.
      if (warmup > 0) warmup--;
      else {
        if (now - last > SLOW_FRAME_MS) slowFrames++;
        if (++frames === SAMPLE_FRAMES) {
          if (slowFrames >= SLOW_SHARE && sharp > 0.55) { sharp *= 0.8; measure(); }
          frames = 0;
          slowFrames = 0;
        }
      }
      last = now;
      const still = reduce.matches || state.paused;
      const aim = scrollY + innerHeight / 2;
      eye = still ? aim : eye + (aim - eye) * Math.min(1, dt * 8);
      if (still && eye === seen && !dirty) return;
      seen = eye;
      dirty = false;
      if (!still) {
        time += dt;
        level += (state.level - level) * Math.min(1, dt * 10);
        tipX += (mouseX - tipX) * Math.min(1, dt * 7);
        tipY += (mouseY - tipY) * Math.min(1, dt * 7);
      }

      const b = blendAt(centers, eye), from = sections[b.i], to = sections[b.i + 1];
      const t = reduce.matches ? Math.round(b.t) : b.t;
      const narrow = W / H <= 0.9;
      const overview = b.i === 0 ? 1 - t : 0;
      let cam = mixCam(from.cam, to.cam, t);
      // A phone has no open half to put the web in, so it lives above the headline and leaves when you scroll on.
      if (narrow) cam = { fx: cam.fx, fy: cam.fy, zoom: cam.zoom * NARROW_ZOOM, ax: 0.42, ay: 0.25 };
      canvas.style.opacity = narrow ? overview : 1;
      if (mark) mark.style.opacity = canvas.style.opacity;
      web.style.setProperty('--overview', overview.toFixed(3));
      web.classList.toggle('is-map', overview > 0.6);
      const view = { w: W, h: H }, k = (cam.zoom * H) / 2;
      const worldX = cam.fx + (tipX - cam.ax * W) / k, worldY = cam.fy + (tipY - cam.ay * H) / k;
      const live = mouseOn && !still;

      let nearest = null, nearestGap = 0.7;
      nodes.forEach((n, i) => {
        n.hover += (n.wants - n.hover) * Math.min(1, dt * 8);
        n.flash *= Math.exp(-dt * 3);
        n.focus = (from.ids.includes(n.id) ? 1 - t : 0) + (to.ids.includes(n.id) ? t : 0);
        const drift = still ? 0 : 0.03;
        let x = n.x + drift * Math.sin(time * 0.5 + n.phase), y = n.y + drift * Math.cos(time * 0.42 + n.phase * 1.3);
        if (live) {
          const dx = worldX - x, dy = worldY - y, gap = Math.hypot(dx, dy) - n.r, pull = 0.14 * Math.max(0, 1 - Math.hypot(dx, dy) / 0.9);
          x += dx * pull; y += dy * pull;
          if (gap < nearestGap) { nearestGap = gap; nearest = n; }
        }
        const s = project({ x, y }, cam, view);
        n.sx = s.x; n.sy = s.y;
        n.sr = n.r * k * (1 + 0.16 * n.hover + 0.06 * n.flash + (n.id === 'sound' ? level * 0.7 : 0));
        nodeData.set([n.sx / H, n.sy / H, n.sr / H, n.flash], i * 4);
        n.el.style.transform = `translate(${(n.sx - n.sr).toFixed(1)}px, ${(n.sy - n.sr).toFixed(1)}px)`;
        n.el.style.width = n.el.style.height = `${(2 * n.sr).toFixed(1)}px`;
      });

      if (mark && byId.hub) {
        const w = byId.hub.sr * 0.78; // the logo fits inside the smaller knot
        mark.style.width = `${w.toFixed(1)}px`;
        mark.style.transform = `translate(${(byId.hub.sx - w / 2).toFixed(1)}px, ${(byId.hub.sy - (w * MARK_SHAPE) / 2).toFixed(1)}px)`;
      }

      let segs = 0;
      const addStrand = (a, b, wEnd, sway, pulse) => {
        if (segs + 2 > MAX_SEGS) return;
        const sag = Math.hypot(b.x - a.x, b.y - a.y) * SAG;
        strand(a, b, sway, wEnd, wEnd * 0.42).forEach((piece, half) => {
          piece[half ? 1 : 3] += sag; // the shared midpoint hangs lower
          segData.set([piece[0] / H, piece[1] / H, piece[2] / H, piece[3] / H], segs * 4);
          taperData.set([piece[4] / H, piece[5] / H, pulse < 0 ? -9 : pulse * 2 - half], segs * 3);
          segs++;
        });
      };
      links.forEach((l) => {
        if (!still) {
          if (l.pulse < 0) {
            const heatA = l.a.focus + 1.5 * l.a.hover, heatB = l.b.focus + 1.5 * l.b.hover;
            if (Math.random() < (0.1 + 0.9 * Math.max(heatA, heatB)) * dt) {
              l.pulse = 0;
              l.back = heatA === heatB ? Math.random() < 0.5 : heatA > heatB; // pulses run toward the node in focus
            }
          } else if ((l.pulse += dt * 1.2) > 1) {
            (l.back ? l.a : l.b).flash = 1;
            l.pulse = -1;
          }
        }
        const along = l.pulse < 0 ? -1 : l.back ? 1 - l.pulse : l.pulse;
        addStrand({ x: l.a.sx, y: l.a.sy }, { x: l.b.sx, y: l.b.sy }, Math.min(l.a.sr, l.b.sr) * 0.11, still ? 0.05 : 0.05 + 0.05 * Math.sin(time * 0.8 + l.phase), along);
      });

      // A tendril reaches from the nearest node to the cursor.
      reach += ((live && nearest ? 1 : 0) - reach) * Math.min(1, dt * 6);
      let count = nodes.length;
      if (reach > 0.02 && nearest) {
        nodeData.set([tipX / H, tipY / H, (0.015 * k * reach) / H, 0], count * 4);
        count++;
        addStrand({ x: nearest.sx, y: nearest.sy }, { x: tipX, y: tipY }, nearest.sr * 0.085 * reach, 0.12 * Math.sin(time * 1.3), -1);
      }

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(loc.uRes, canvas.width, canvas.height);
      gl.uniform4fv(loc.uNode, nodeData);
      gl.uniform4fv(loc.uSeg, segData);
      gl.uniform3fv(loc.uTaper, taperData);
      gl.uniform1i(loc.uNodes, count);
      gl.uniform1i(loc.uSegs, segs);
      gl.uniform1f(loc.uSmooth, 0.03 * cam.zoom);
      gl.uniform1f(loc.uTime, time);
      gl.uniform1f(loc.uDepth, 0.022 * cam.zoom);
      gl.uniform1f(loc.uLift, cam.zoom);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    requestAnimationFrame(frame);
    return true;
  }

  const canvas = document.querySelector('.scene'), web = document.querySelector('.web');
  if (!canvas || !web) return;
  try {
    if (start(canvas, web)) document.documentElement.classList.add('webgl');
  } catch (err) {
    // The page reads the same without the scene: the project links stay as a plain list.
    console.warn('scene: WebGL unavailable, showing the plain project list instead.', err);
  }
})(typeof window === 'undefined' ? globalThis : window);
