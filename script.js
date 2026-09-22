(() => {
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.querySelector('.motion-toggle');
  let paused = media.matches;
  try { paused = media.matches || localStorage.getItem('portfolio-motion') === 'off'; } catch {}
  function syncMotion() {
    root.classList.toggle('motion-off', paused);
    toggle?.setAttribute('aria-pressed', String(paused));
    toggle?.setAttribute('aria-label', paused ? 'Enable decorative motion' : 'Pause decorative motion');
    if (toggle) { toggle.querySelector('.motion-icon').textContent = paused ? '▷' : 'Ⅱ'; toggle.querySelector('.motion-label').textContent = paused ? 'Motion off' : 'Motion on'; }
  }
  syncMotion();
  toggle?.addEventListener('click', () => { paused = !paused; syncMotion(); try { localStorage.setItem('portfolio-motion', paused ? 'off' : 'on'); } catch {} });
  media.addEventListener('change', event => { paused = event.matches; syncMotion(); });
  document.querySelectorAll('.glow-card').forEach(card => {
    card.addEventListener('pointermove', event => { if (paused || media.matches || event.pointerType === 'touch') return; const rect = card.getBoundingClientRect(); card.style.setProperty('--mx', `${event.clientX - rect.left}px`); card.style.setProperty('--my', `${event.clientY - rect.top}px`); });
    card.addEventListener('pointerleave', () => { card.style.removeProperty('--mx'); card.style.removeProperty('--my'); });
  });
  const dialog = document.querySelector('#screen-dialog');
  if (dialog) {
    const image = dialog.querySelector('#dialog-image');
    const caption = dialog.querySelector('#dialog-caption');
    document.querySelectorAll('[data-screen]').forEach(button => button.addEventListener('click', () => {
      image.src = button.dataset.screen; image.alt = button.querySelector('img').alt; caption.textContent = button.dataset.caption; dialog.showModal();
    }));
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
    dialog.addEventListener('close', () => { document.body.style.overflow = ''; });
  }
})();
