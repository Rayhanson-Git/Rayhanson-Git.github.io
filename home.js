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
  const links = [...document.querySelectorAll('.dock > a[href^="#"]')].filter((a) => document.querySelector(a.getAttribute('href')));
  const targets = links.map((a) => document.querySelector(a.getAttribute('href')));
  const current = new IntersectionObserver((entries) => entries.forEach((e) => {
    const link = links[targets.indexOf(e.target)];
    if (e.isIntersecting) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }), { rootMargin: '-50% 0px -50% 0px' });
  targets.forEach((el) => current.observe(el));

  // In the work section, Work opens into Projects and Creative work, and the half that holds the middle of the screen is marked.
  const dock = document.querySelector('.dock'), subs = dock && dock.querySelector('.dock__subs');
  const work = document.getElementById('work'), creative = document.getElementById('creative-work');
  if (subs && work && creative) {
    const [toProjects, toCreative] = subs.querySelectorAll('a');
    const mark = (link, on) => (on ? link.setAttribute('aria-current', 'true') : link.removeAttribute('aria-current'));
    let queued = false;
    const update = () => {
      queued = false;
      const middle = innerHeight / 2, box = work.getBoundingClientRect();
      const inWork = box.top <= middle && box.bottom >= middle, inCreative = inWork && creative.getBoundingClientRect().top <= middle;
      dock.classList.toggle('is-work', inWork);
      if (!inWork && subs.contains(document.activeElement)) subs.previousElementSibling.focus(); // keep keyboard focus on Work
      subs.inert = !inWork; // folded away, the two pills are out of the tab order
      mark(toProjects, inWork && !inCreative);
      mark(toCreative, inCreative);
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener('resize', update);
    update();
  }

  // Cards lean toward the pointer and light up under it.
  const calm = matchMedia('(prefers-reduced-motion: reduce)');

  // On a case study the Work item turns into this project: its icon bobs, then becomes the project's mark and name.
  // It still leads back to the work section.
  const here = document.querySelector('.dock a[data-project]');
  if (here) {
    const icon = here.querySelector('.icon'), label = here.querySelector('span'), name = here.dataset.project;
    // A project's own image mark is loaded first, so it is there the moment it swaps in.
    const img = here.dataset.projectImg ? Object.assign(new Image(), { src: here.dataset.projectImg, alt: '', className: 'icon' }) : null;
    const ready = img ? img.decode().catch(() => {}) : Promise.resolve();
    const become = () => {
      label.textContent = name;
      here.setAttribute('aria-label', `${name}, back to all work`);
      if (here.dataset.projectIcon) icon.querySelector('use').setAttribute('href', `#${here.dataset.projectIcon}`);
      else if (img) icon.replaceWith(img);
      else icon.hidden = true; // no mark of its own: the name alone
    };
    if (calm.matches) ready.then(become);
    else setTimeout(() => {
      icon.classList.add('is-arriving');
      Promise.all([ready, new Promise((r) => setTimeout(r, 200))])
        .then(() => (document.startViewTransition ? document.startViewTransition(become) : become()));
    }, 500);
  }
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

  // A film's small play button opens it in a window over the page. Closing the window, by its X, Escape or a click
  // on the dimmed page, stops the film. The button stays hidden where the browser has no such window.
  document.querySelectorAll('[data-film]').forEach((button) => {
    const film = document.querySelector(button.dataset.film), video = film && film.querySelector('video');
    if (!video || !film.showModal) return;
    button.hidden = false;
    button.addEventListener('click', () => {
      film.showModal();
      video.play().catch(() => {}); // a browser may refuse to start it; the controls are right there
    });
    film.addEventListener('close', () => video.pause());
    // A click on the dimmed page closes it, but not a drag that began on the film, such as its seek bar.
    let pressedOutside = false;
    film.addEventListener('pointerdown', (e) => { pressedOutside = e.target === film; });
    film.addEventListener('click', (e) => { if ((e.target === film && pressedOutside) || e.target.closest('[data-film-close]')) film.close(); });
  });

  // A looping film plays by itself while it is on screen, like a moving picture, and stops when it scrolls away.
  // With reduced motion it keeps its ordinary controls; if the browser refuses to start it, the controls come back.
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    document.querySelectorAll('video[data-loop]').forEach((video) => {
      const toggle = video.parentElement.querySelector('[data-loop-toggle]');
      let held = false; // the visitor paused it, so scrolling back does not restart it
      const show = (playing) => {
        if (!toggle) return;
        toggle.dataset.state = playing ? 'playing' : 'paused';
        toggle.setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
      };
      const start = () => video.play().then(() => show(true), () => { video.controls = true; if (toggle) toggle.hidden = true; });
      video.controls = false;
      if (toggle) toggle.hidden = false;
      new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) video.pause();
        else if (!held) { video.preload = 'auto'; start(); }
      }, { threshold: 0.25 }).observe(video);
      if (toggle) toggle.addEventListener('click', () => {
        held = !video.paused;
        if (held) { video.pause(); show(false); } else start();
      });
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
