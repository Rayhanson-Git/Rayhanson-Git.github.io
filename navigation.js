(() => {
  const rail = document.querySelector('.site-rail');
  const toggle = document.querySelector('.rail-toggle');
  const backdrop = document.querySelector('.rail-backdrop');
  if (!rail || !toggle || !backdrop) return;
  const mobile = matchMedia('(max-width: 760px)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  let pinned = false;
  let hovered = false;
  let focused = false;
  let suppressHover = false;
  let isOpen = false;
  function render() {
    isOpen = mobile.matches ? pinned : pinned || hovered || focused;
    rail.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
    toggle.querySelector('.rail-toggle-label').textContent = isOpen ? 'Close' : 'Menu';
    backdrop.hidden = !mobile.matches || !isOpen;
    rail.inert = mobile.matches && !isOpen;
    document.documentElement.classList.toggle('mobile-nav-open', mobile.matches && isOpen);
    document.querySelectorAll('main,footer').forEach(element => {element.inert = mobile.matches && isOpen;});
  }
  function close(returnFocus = false) {
    pinned = hovered = focused = false;
    suppressHover = true;
    if (returnFocus) toggle.focus();
    render();
  }
  rail.classList.add('rail-enhanced');
  document.documentElement.classList.add('rail-ready');
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    if (isOpen) close();
    else {pinned = true; render();}
  });
  rail.addEventListener('pointerenter', () => {
    if (!mobile.matches && pointer.matches && !suppressHover) {hovered = true;render();}
  });
  rail.addEventListener('pointerleave', () => {hovered = false;suppressHover = false;render();});
  rail.addEventListener('focusin', () => {if (!mobile.matches) {focused = true;render();}});
  rail.addEventListener('focusout', event => {if (!rail.contains(event.relatedTarget)) {focused = false;render();}});
  backdrop.addEventListener('click', () => close(true));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isOpen) {event.preventDefault();close(true);}
    if (event.key === 'Tab' && mobile.matches && isOpen) {
      const items = [toggle, ...rail.querySelectorAll('a[href],button:not([hidden])')];
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {event.preventDefault();last.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first.focus();}
    }
  });
  document.addEventListener('pointerdown', event => {
    if (isOpen && !rail.contains(event.target) && !toggle.contains(event.target) && event.target !== backdrop) close();
  });
  mobile.addEventListener('change', () => {close();suppressHover = false;});
  const links = [...rail.querySelectorAll('[data-section]')];
  const sections = links.map(link => document.getElementById(link.dataset.section)).filter(Boolean);
  function setActive(id) {
    links.forEach(link => {
      if (link.dataset.section === id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  links.forEach(link => link.addEventListener('click', () => {
    const target = document.getElementById(link.dataset.section);
    if (!target) return;
    setActive(link.dataset.section);
    close();
    requestAnimationFrame(() => {target.tabIndex = -1;target.focus({preventScroll:true});});
  }));
  let frame;
  function updateActive() {
    frame = undefined;
    if (!sections.length) return;
    let active = sections[0];
    sections.forEach(section => {if (section.getBoundingClientRect().top <= innerHeight * .35) active = section;});
    setActive(active.id);
  }
  function requestActive() {if (frame === undefined) frame = requestAnimationFrame(updateActive);}
  window.addEventListener('scroll', requestActive, {passive:true});
  window.addEventListener('resize', requestActive, {passive:true});
  window.addEventListener('hashchange', requestActive);
  render();updateActive();
})();
