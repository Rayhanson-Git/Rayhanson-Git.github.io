(() => {
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.querySelector('.motion-toggle');
  let paused = media.matches;
  const motionListeners = [];
  try { paused = media.matches || localStorage.getItem('portfolio-motion') === 'off'; } catch {}
  function syncMotion() {
    root.classList.toggle('motion-off', paused);
    toggle?.setAttribute('aria-pressed', String(paused));
    toggle?.setAttribute('aria-label', paused ? 'Enable decorative motion' : 'Pause decorative motion');
    motionListeners.forEach(listener => listener());
    if (toggle) { toggle.querySelector('.motion-icon').textContent = paused ? '▷' : 'Ⅱ'; toggle.querySelector('.motion-label').textContent = paused ? 'Motion off' : 'Motion on'; }
  }
  syncMotion();
  toggle?.addEventListener('click', () => { paused = !paused; syncMotion(); try { localStorage.setItem('portfolio-motion', paused ? 'off' : 'on'); } catch {} });
  media.addEventListener('change', event => { paused = event.matches; syncMotion(); });
  document.querySelectorAll('.glow-card').forEach(card => {
    card.addEventListener('pointermove', event => { if (paused || media.matches || event.pointerType === 'touch') return; const rect = card.getBoundingClientRect(); card.style.setProperty('--mx', `${event.clientX - rect.left}px`); card.style.setProperty('--my', `${event.clientY - rect.top}px`); });
    card.addEventListener('pointerleave', () => { card.style.removeProperty('--mx'); card.style.removeProperty('--my'); });
  });
  // Native scroll keeps touch, trackpad, and no-JavaScript browsing available.
  const showcase = document.querySelector('.hero-showcase');
  if (showcase) {
    const track = showcase.querySelector('.showcase-track');
    const slides = [...track.querySelectorAll('.showcase-slide')];
    const dots = [...showcase.querySelectorAll('[data-slide]')];
    const rotation = showcase.querySelector('.carousel-rotation');
    let current = 0;
    let stopped = false;
    let hovering = false;
    let visible = false;
    let timer;
    let scrollFrame;
    const canRotate = () => !paused && !media.matches && !stopped && !hovering && visible && !document.hidden;
    function schedule() {
      clearTimeout(timer);
      const automatic = !paused && !media.matches && !stopped;
      rotation.setAttribute('aria-pressed', String(!automatic));
      rotation.setAttribute('aria-label', automatic ? 'Pause automatic project scrolling' : 'Start automatic project scrolling');
      rotation.textContent = automatic ? 'Ⅱ' : '▷';
      if (canRotate()) timer = setTimeout(() => go(current + 1), 6500);
    }
    function go(index) {
      const target = (index + slides.length) % slides.length;
      track.scrollTo({left: slides[target].offsetLeft - slides[0].offsetLeft, behavior: paused || media.matches ? 'instant' : 'smooth'});
      current = target;
      schedule();
    }
    function stop() { stopped = true; schedule(); }
    function reflect() {
      const origin = slides[0].offsetLeft;
      current = slides.reduce((best, slide, index) => Math.abs(slide.offsetLeft - origin - track.scrollLeft) < Math.abs(slides[best].offsetLeft - origin - track.scrollLeft) ? index : best, 0);
      dots.forEach((dot,index) => dot.setAttribute('aria-pressed',String(index === current)));
      showcase.querySelector('.showcase-count').textContent = `${String(current + 1).padStart(2,'0')} / ${String(slides.length).padStart(2,'0')}`;
    }
    track.addEventListener('scroll', () => { cancelAnimationFrame(scrollFrame); scrollFrame = requestAnimationFrame(reflect); }, {passive:true});
    showcase.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => {stop();go(current + Number(button.dataset.step));}));
    dots.forEach(button => button.addEventListener('click', () => {stop();go(Number(button.dataset.slide));}));
    track.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault(); stop();
      go(event.key === 'Home' ? 0 : event.key === 'End' ? slides.length - 1 : current + (event.key === 'ArrowRight' ? 1 : -1));
    });
    track.addEventListener('pointerdown', stop, {passive:true});
    track.addEventListener('wheel', stop, {passive:true});
    showcase.addEventListener('focusin', event => {if (event.target !== rotation) stop();});
    showcase.addEventListener('mouseenter', () => {hovering = true;schedule();});
    showcase.addEventListener('mouseleave', () => {hovering = false;schedule();});
    rotation.addEventListener('click', () => {stopped = !stopped; schedule();});
    document.addEventListener('visibilitychange', schedule);
    motionListeners.push(schedule);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {visible = entries[0].isIntersecting;schedule();}, {threshold:.3}).observe(showcase);
    showcase.querySelector('.showcase-controls').hidden = false;
    reflect(); schedule();
  }
  // Reveal once, without hiding content when motion is disabled.
  if ('IntersectionObserver' in window && !paused && !media.matches) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {entry.target.classList.add('is-visible');observer.unobserve(entry.target);}
    }), {threshold:.08});
    document.querySelectorAll('.project-card,.about>div,.contact-card,.case-section,.decision,.session-section').forEach(element => {
      element.classList.add('reveal-ready');observer.observe(element);
    });
  }
  document.querySelector('.copy-email')?.addEventListener('click', async () => {
    const status = document.querySelector('.copy-status');
    try {await navigator.clipboard.writeText('Harvey@Rayhanson.tech'); status.textContent = 'Email copied.';}
    catch {status.textContent = 'Select the email above to copy it, or choose Say hello.';}
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

