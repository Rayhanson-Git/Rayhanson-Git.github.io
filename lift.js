// Clicking a project tile, anywhere but its picture and its links, brings it forward: a larger copy in the middle of
// the screen with a little more about the project. If the web's tendril is holding the tile, it carries it there.
// The picture still goes to the case study, and "Quick look" in each tile does the same from the keyboard.
(function (root) {
  'use strict';

  // The move that makes a box drawn at `last` look as if it were still at `first`: used as the start of the flight
  // forward and the end of the flight back. Both are { left, top, width, height } in screen pixels.
  function flight(first, last) {
    const scaleX = first.width / last.width, scaleY = first.height / last.height;
    return `translate(${(first.left - last.left).toFixed(1)}px, ${(first.top - last.top).toFixed(1)}px) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`;
  }

  if (typeof module === 'object' && module.exports) module.exports = { flight };
  if (typeof document === 'undefined') return;

  const tiles = [...document.querySelectorAll('[data-lift]')];
  if (!tiles.length) return;

  const FORWARD_MS = 520, BACK_MS = 260;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const veil = document.createElement('div');
  veil.className = 'lift';
  veil.hidden = true;
  veil.setAttribute('role', 'dialog');
  veil.setAttribute('aria-modal', 'true');
  veil.setAttribute('aria-labelledby', 'lift-title');
  // A small X on the tile's own corner. `data-grip-clear` tells grip.js to keep the tendril's hand off that corner.
  veil.innerHTML = '<article class="lift__card card" data-grip-clear="1"><button class="lift__close" type="button" aria-label="Close"><svg class="icon" aria-hidden="true"><use href="#i-x"/></svg></button><div class="lift__media"></div><div class="lift__text"></div></article>';
  document.body.append(veil);
  const card = veil.querySelector('.lift__card'), media = veil.querySelector('.lift__media'), text = veil.querySelector('.lift__text'), close = veil.querySelector('.lift__close');
  let origin = null, opener = null, forward = null, pressedOnVeil = false;

  // Everything else on the page is switched off while a tile is forward, so the keyboard and screen readers stay in it.
  const behind = () => [...document.body.children].filter((el) => el !== veil && !el.matches('canvas, script'));
  const grip = (el, again) => { if (root.RayScene && root.RayScene.take) root.RayScene.take(el, again); };

  function open(tile, trigger) {
    if (origin) return;
    // A tile may name a fuller, hidden copy of itself to show instead (the Enigma facts card does).
    const source = (tile.dataset.lift && document.querySelector(tile.dataset.lift)) || tile;
    const picture = source.querySelector(':scope > a'), words = source.querySelector(':scope > div') || source;
    origin = tile;
    opener = trigger || null; // only the keyboard's "Quick look" gets focus back; a mouse click leaves no button showing
    media.replaceChildren(picture.cloneNode(true));
    text.replaceChildren(...[...words.children].filter((el) => el !== picture).map((el) => el.cloneNode(true)));
    text.querySelectorAll('[hidden]').forEach((el) => { el.hidden = false; });
    text.querySelectorAll('[data-peek]').forEach((el) => el.remove());
    const title = text.querySelector('h2, h3');
    if (title) title.id = 'lift-title';
    const first = tile.getBoundingClientRect();
    behind().forEach((el) => { el.inert = true; });
    veil.hidden = false;
    tile.style.visibility = 'hidden'; // the tile itself seems to have left its place
    close.focus({ preventScroll: true });
    grip(card);
    if (calm.matches) return;
    const flying = forward = card.animate([{ transform: flight(first, card.getBoundingClientRect()) }, { transform: 'none' }], { duration: FORWARD_MS, easing: 'cubic-bezier(0.3, 1.35, 0.5, 1)' });
    // Once it has landed, hold it afresh where it now is: but only this flight, only if still open, and only if
    // the pointer is still on it.
    flying.finished.then(() => { if (forward === flying && origin === tile && !veil.dataset.leaving && card.matches(':hover')) grip(card, true); }, () => {});
  }

  function settle() {
    veil.hidden = true;
    behind().forEach((el) => { el.inert = false; });
    origin.style.visibility = '';
    grip(null);
    if (opener) opener.focus({ preventScroll: true });
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    origin = null;
  }

  function shut() {
    if (!origin || veil.dataset.leaving) return;
    if (calm.matches) { settle(); return; }
    veil.dataset.leaving = 'true';
    const done = () => { delete veil.dataset.leaving; settle(); };
    // If it is still flying forward, start back from where it is now; its resting box is measured with no flight on it.
    const now = getComputedStyle(card).transform;
    if (forward) forward.cancel();
    forward = null;
    card.animate([{ transform: now, opacity: 1 }, { transform: flight(origin.getBoundingClientRect(), card.getBoundingClientRect()), opacity: 0.4 }], { duration: BACK_MS, easing: 'ease-in' }).finished.then(done, done);
  }

  tiles.forEach((tile) => tile.addEventListener('click', (e) => {
    const peek = e.target.closest('[data-peek]');
    if (peek) { open(tile, peek); return; }
    if (e.target.closest('a, button, audio')) return;       // the picture and the links keep doing what they do
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // a modified click means something else to the browser
    if (String(getSelection())) return;                      // someone selecting text is not asking for this
    open(tile);
  }));
  // A "Quick look" button that sits outside its tile names the tile it opens.
  document.querySelectorAll('[data-peek^="#"]').forEach((button) => button.addEventListener('click', () => {
    const tile = document.querySelector(button.dataset.peek);
    if (tile) open(tile, button);
  }));
  close.addEventListener('click', shut);
  // A click on the dimmed page closes it, but not a drag that began on the tile, such as selecting its text.
  veil.addEventListener('pointerdown', (e) => { pressedOnVeil = e.target === veil; });
  veil.addEventListener('click', (e) => { if (e.target === veil && pressedOnVeil) shut(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') shut(); });
  addEventListener('scroll', shut, { passive: true }); // scrolling the page on puts the tile back
})(typeof window === 'undefined' ? globalThis : window);
