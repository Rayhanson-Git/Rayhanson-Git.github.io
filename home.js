// Page behaviour for the homepage and the case-study pages: the reveal, the current nav link, lit cards, copy email, GymLog's screen dialog, and the sound story driving the scene.
(function () {
  'use strict';

  const reveal = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    reveal.unobserve(e.target);
  }), { rootMargin: '0px 0px -10% 0px' });
  document.querySelectorAll('[data-reveal]').forEach((el) => reveal.observe(el));

  // Mark the nav link whose section holds the middle of the screen.
  // Only links to this page's own sections; on a case-study page the bar links back to the homepage.
  const links = [...document.querySelectorAll('.dock a[href^="#"]')].filter((a) => document.querySelector(a.getAttribute('href')));
  const targets = links.map((a) => document.querySelector(a.getAttribute('href')));
  const current = new IntersectionObserver((entries) => entries.forEach((e) => {
    const link = links[targets.indexOf(e.target)];
    if (e.isIntersecting) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }), { rootMargin: '-50% 0px -50% 0px' });
  targets.forEach((el) => current.observe(el));

  // Cards lean toward the pointer and light up under it.
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const TILT_DEGREES = 5;
  document.querySelectorAll('.card').forEach((card) => {
    const tilts = card.hasAttribute('data-tilt');
    card.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const box = card.getBoundingClientRect(), x = (e.clientX - box.left) / box.width, y = (e.clientY - box.top) / box.height;
      card.classList.add('is-lit');
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
      if (!tilts || calm.matches) return;
      // Large cards lean less, so their far edge does not swing.
      const lean = TILT_DEGREES * Math.min(1, 420 / box.width);
      card.style.setProperty('--rx', `${(0.5 - y) * lean}deg`);
      card.style.setProperty('--ry', `${(x - 0.5) * lean}deg`);
    });
    card.addEventListener('pointerleave', () => {
      card.classList.remove('is-lit');
      ['--rx', '--ry'].forEach((name) => card.style.removeProperty(name));
    });
  });

  const copy = document.querySelector('.copy-email'), status = document.querySelector('.copy-status');
  if (copy && status) copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('Harvey@Rayhanson.tech');
      status.textContent = 'Email copied.';
    } catch {
      status.textContent = 'Select the email above to copy it, or choose Say hello.';
    }
  });

  // Every command block gets a copy button. It is added here, so without script there is no dead button.
  const COPIED_FOR_MS = 2000;
  document.querySelectorAll('pre').forEach((pre) => {
    const frame = document.createElement('div'), button = document.createElement('button');
    frame.className = 'code';
    pre.tabIndex = 0; // a long command scrolls sideways; this lets the keyboard reach it
    pre.setAttribute('aria-label', 'Command');
    button.type = 'button';
    button.className = 'copy-code';
    button.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-copy"/></svg><span>Copy</span>';
    const label = button.querySelector('span');
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pre.textContent);
        label.textContent = 'Copied';
      } catch {
        label.textContent = 'Select the text to copy';
      }
      setTimeout(() => { label.textContent = 'Copy'; }, COPIED_FOR_MS);
    });
    pre.replaceWith(frame);
    frame.append(pre, button);
  });

  // GymLog's screens open larger in a dialog.
  const dialog = document.querySelector('#screen-dialog');
  if (dialog) {
    const image = dialog.querySelector('#dialog-image'), caption = dialog.querySelector('#dialog-caption');
    document.querySelectorAll('[data-screen]').forEach((button) => button.addEventListener('click', () => {
      image.src = button.dataset.screen;
      image.alt = button.querySelector('img').alt;
      caption.textContent = button.dataset.caption;
      dialog.showModal();
    }));
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    // A click on the backdrop lands on the dialog element but outside its box; a click on its padding is inside.
    dialog.addEventListener('click', (e) => {
      const box = dialog.getBoundingClientRect();
      if (e.target === dialog && (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom)) dialog.close();
    });
  }

  // While the sound story plays, its loudness swells the waveform in the scene.
  const audio = document.querySelector('.sound__player');
  if (audio && (window.AudioContext || window.webkitAudioContext)) {
    let analyser, bins, raf;
    const listen = () => {
      const scene = window.RayScene;
      if (!scene) return;
      analyser.getByteFrequencyData(bins);
      scene.level = bins.reduce((sum, v) => sum + v, 0) / bins.length / 255;
      raf = requestAnimationFrame(listen);
    };
    const stop = () => { cancelAnimationFrame(raf); if (window.RayScene) window.RayScene.level = 0; };
    audio.addEventListener('play', () => {
      if (!analyser) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        bins = new Uint8Array(analyser.frequencyBinCount);
        ctx.createMediaElementSource(audio).connect(analyser);
        analyser.connect(ctx.destination);
        // Safari can hand back a suspended context, which would play the story silently.
        if (ctx.state === 'suspended') ctx.resume();
      }
      listen();
    });
    ['pause', 'ended', 'emptied', 'error'].forEach((type) => audio.addEventListener(type, stop));
  }
})();
