const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const runningMotion = new Set();
const elementMotion = new WeakMap();
const motionEase = 'cubic-bezier(.22,1,.36,1)';
function animate(element, frames, options = {}) {
  const previous = elementMotion.get(element);
  if (previous?.playState === 'running') {
    const current = getComputedStyle(element);
    frames = frames.map(frame => ({...frame}));
    for (const property of Object.keys(frames[0])) frames[0][property] = current[property];
  }
  previous?.cancel();
  if (reducedMotion.matches || !element.animate) return;
  // Hold the first frame during stagger delays, then return to the base style.
  const animation = element.animate(frames, {duration: 320, easing: motionEase, fill: 'backwards', ...options});
  elementMotion.set(element, animation);
  runningMotion.add(animation);
  animation.finished.then(() => runningMotion.delete(animation), () => runningMotion.delete(animation));
}
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) for (const animation of runningMotion) animation.cancel();
});

const tidy = document.querySelector('.tidy-button');
const workflow = document.querySelector('#workflow');
const range = document.querySelector('#workflow-range');
const caption = document.querySelector('#workflow-label');
if (tidy && workflow && range && caption) {
  const cards = [...workflow.querySelectorAll('.task')];
  const rotations = [-8, 7, -6, 5];
  let frame;
  let flowValue = 0;
  let destination = 0;
  let targets = [];
  const workbench = workflow.closest('.workbench');
  function measureFlow() {
    const width = workflow.clientWidth, height = workflow.clientHeight;
    targets = cards.map((card, index) => ({
      x: (width - card.offsetWidth) / 2 - card.offsetLeft,
      y: 4 + index * ((height - card.offsetHeight - 8) / 3) - card.offsetTop,
    }));
    showFlow(flowValue);
  }
  function showFlow(value) {
    flowValue = value;
    const progress = value / 100;
    range.value = value;
    workbench.style.setProperty('--flow', progress);
    cards.forEach((card, index) => {
      const {x, y} = targets[index];
      card.style.setProperty('--tx', `${x * progress}px`);
      card.style.setProperty('--ty', `${y * progress}px`);
      card.style.setProperty('--rotation', `${rotations[index] * (1 - progress)}deg`);
    });
    const ordered = value >= 95;
    range.setAttribute('aria-valuetext', ordered ? 'A connected workflow' : value === 0 ? 'Scattered work' : 'Bringing the steps together');
    tidy.setAttribute('aria-pressed', String(ordered));
    tidy.firstChild.textContent = ordered ? 'See the before ' : 'Untangle it ';
    caption.textContent = ordered ? 'A connected workflow. Important decisions stay with your team.' : 'An illustration of scattered work.';
  }
  range.addEventListener('input', () => {
    cancelAnimationFrame(frame);
    const value = Number(range.value);
    destination = value >= 95 ? 100 : 0;
    showFlow(value);
  });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) cancelAnimationFrame(frame); });
  tidy.addEventListener('click', event => {
    cancelAnimationFrame(frame);
    const start = flowValue;
    const end = destination === 100 ? 0 : 100;
    destination = end;
    if (reducedMotion.matches || !event.detail) { showFlow(end); return; }
    const began = performance.now();
    const animate = now => {
      const t = Math.min((now - began) / 700, 1);
      const eased = t * t * (3 - 2 * t);
      showFlow(start + (end - start) * eased);
      if (t < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
  });
  const flowSize = new ResizeObserver(measureFlow);
  flowSize.observe(workflow);
  cards.forEach(card => flowSize.observe(card));
  measureFlow();
}

// Each example keeps its own selection and keyboard focus.
for (const list of document.querySelectorAll('[role="tablist"]')) {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  let indicator;
  if (list.classList.contains('product-tabs')) {
    indicator = document.createElement('span');
    indicator.className = 'tab-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    list.append(indicator);
    list.classList.add('has-indicator');
  }
  function positionIndicator(animateChange = false) {
    if (!indicator) return;
    const tab = tabs.find(item => item.getAttribute('aria-selected') === 'true');
    const previous = getComputedStyle(indicator).transform;
    const next = `translateX(${tab.offsetLeft}px) scaleX(${tab.offsetWidth})`;
    indicator.style.transform = next;
    if (animateChange) animate(indicator, [{transform: previous}, {transform: next}]);
    else elementMotion.get(indicator)?.cancel();
  }
  if (indicator) new ResizeObserver(() => positionIndicator()).observe(list);
  function select(tab, moveFocus = false, useMotion = false) {
    const previousIndex = tabs.findIndex(item => item.getAttribute('aria-selected') === 'true');
    const nextIndex = tabs.indexOf(tab);
    for (const item of tabs) {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
    }
    positionIndicator(useMotion && previousIndex !== nextIndex);
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    if (useMotion && previousIndex !== nextIndex) {
      const direction = nextIndex > previousIndex ? 1 : -1;
      animate(panel, [{opacity: 0, translate: `${direction * 18}px 0`}, {opacity: 1, translate: '0 0'}]);
      panel.querySelectorAll('.ingredient-row').forEach((row, index) => {
        animate(row, [{opacity: .2, translate: '0 12px'}, {opacity: 1, translate: '0 0'}], {delay: 45 * index, duration: 300});
      });
    } else {
      elementMotion.get(panel)?.cancel();
      panel.querySelectorAll('.ingredient-row').forEach(row => elementMotion.get(row)?.cancel());
    }
    if (moveFocus) tab.focus();
  }
  for (const tab of tabs) {
    tab.addEventListener('click', event => select(tab, false, event.detail > 0));
    tab.addEventListener('keydown', event => {
      let index = tabs.indexOf(tab);
      if (event.key === 'ArrowRight' || (list.getAttribute('aria-orientation') === 'vertical' && event.key === 'ArrowDown')) index = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft' || (list.getAttribute('aria-orientation') === 'vertical' && event.key === 'ArrowUp')) index = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = tabs.length - 1;
      else return;
      event.preventDefault();
      select(tabs[index], true);
    });
  }
}
for (const button of document.querySelectorAll('[data-organise]')) {
  button.hidden = false;
  const demo = button.closest('.task-demo');
  const request = demo.querySelector('.raw-request');
  const details = demo.querySelector('.organised-details');
  const values = [...details.querySelectorAll('dd')];
  // Map only exact text matches in these fixed examples; this is not live extraction.
  const sources = values.map(value => {
    const walker = document.createTreeWalker(request, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const index = node.textContent.toLowerCase().indexOf(value.textContent.toLowerCase());
      if (index < 0) continue;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + value.textContent.length);
      const span = document.createElement('span');
      span.className = 'request-detail';
      range.surroundContents(span);
      return span;
    }
  });
  button.addEventListener('click', event => {
    const ready = button.getAttribute('aria-pressed') !== 'true';
    const origins = ready ? sources.map(source => source?.getBoundingClientRect()) : [];
    for (const element of [request, ...values, ...details.querySelectorAll('dt')]) elementMotion.get(element)?.cancel();
    button.setAttribute('aria-pressed', String(ready));
    demo.classList.toggle('is-organised', ready);
    demo.querySelector('.record-placeholder').hidden = ready;
    details.hidden = !ready;
    demo.querySelector('.demo-state').textContent = ready ? 'Ready for your review' : 'Details in a message';
    button.firstChild.textContent = ready ? 'Reset example ' : 'Organise the details ';
    if (!event.detail || reducedMotion.matches) return;
    if (ready) {
      values.forEach((value, index) => {
        const target = value.getBoundingClientRect();
        const origin = origins[index];
        const offset = origin ? `${origin.left - target.left}px ${origin.top - target.top}px` : '0 16px';
        animate(value, [{translate: offset, opacity: .4}, {translate: '0 0', opacity: 1}], {duration: 460, delay: index * 35});
        animate(value.previousElementSibling, [{opacity: 0, translate: '0 5px'}, {opacity: 1, translate: '0 0'}], {delay: 130 + index * 35});
      });
    } else animate(demo.querySelector('.record-placeholder'), [{opacity: 0, translate: '0 10px'}, {opacity: 1, translate: '0 0'}]);
  });
}
const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#main-nav');
if (menu && navigation) {
  menu.hidden = false;
  const closeMenu = () => {
    menu.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
  };
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('is-open', open);
  });
  navigation.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menu.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.header')) closeMenu();
  });
}
const video = document.querySelector('#intro-video');
if (video) {
  const filmStatus = document.querySelector('#film-status');
  const cover = document.querySelector('.film-cover');
  if (cover) {
    cover.hidden = false;
    video.addEventListener('play', () => { cover.hidden = true; });
    cover.addEventListener('click', () => {
      video.play().then(() => video.focus()).catch(() => {
        cover.hidden = true;
        video.focus();
        filmStatus.textContent = 'Press Play to watch the film.';
      });
    });
  }
  let bufferedVideo;
  let objectUrl;
  let chapterRequest = 0;
  // Some static hosts ignore byte ranges. Buffer only on a requested chapter,
  // then use a local media URL so seeking still works without another service.
  async function prepareChapter() {
    if (bufferedVideo) { await bufferedVideo; return; }
    if (video.seekable.length && video.seekable.end(0) > 0) return;
    if (!bufferedVideo) {
      bufferedVideo = (async () => {
        const source = video.querySelector('source').src;
        const response = await fetch(source, {signal: AbortSignal.timeout(20000)});
        if (!response.ok) throw new Error('Video unavailable');
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        await new Promise((resolve, reject) => {
          const done = () => { clean(); resolve(); };
          const fail = () => { clean(); reject(new Error('Video unavailable')); };
          const clean = () => {
            video.removeEventListener('loadedmetadata', done);
            video.removeEventListener('error', fail);
          };
          video.addEventListener('loadedmetadata', done);
          video.addEventListener('error', fail);
          video.src = objectUrl;
          video.load();
        });
      })().catch(error => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = undefined;
        bufferedVideo = undefined;
        video.removeAttribute('src');
        video.load();
        throw error;
      });
    }
    await bufferedVideo;
  }
  for (const chapter of document.querySelectorAll('[data-film-time]')) {
    chapter.addEventListener('click', async () => {
      const request = ++chapterRequest;
      video.scrollIntoView({block: 'center', behavior: 'instant'});
      filmStatus.textContent = 'Loading your chapter…';
      try {
        await prepareChapter();
        if (request !== chapterRequest) return;
        video.currentTime = Number(chapter.dataset.filmTime);
        filmStatus.textContent = '';
        video.play().catch(() => { filmStatus.textContent = 'Your chapter is ready. Press Play to watch.'; });
      } catch {
        if (request === chapterRequest) filmStatus.textContent = 'Couldn’t load this chapter. You can still play the video from the start.';
      }
    });
  }
  document.querySelector('#watch-film')?.addEventListener('click', event => {
    event.preventDefault();
    video.scrollIntoView({block: 'center', behavior: 'instant'});
    history.replaceState(null, '', '#film');
    video.play().catch(() => { filmStatus.textContent = 'Press Play to watch the film.'; });
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) video.pause();
    }, { threshold: 0.05 }).observe(video);
  }
}
// Reveal once on entry. Content stays visible if animation is unavailable.
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      const items = entry.target.matches('.hero')
        ? entry.target.querySelectorAll('h1, .hero-intro, .hero-actions, .task')
        : entry.target.matches('.film-player')
          ? entry.target.querySelectorAll('.film-cover-copy, .slip-back, .slip-front')
          : entry.target.children;
      [...items].forEach((item, index) => {
        animate(item, [{opacity: .45, translate: '0 18px'}, {opacity: 1, translate: '0 0'}], {duration: 620, delay: Math.min(index, 4) * 45});
      });
    }
  }, {threshold: .12});
  document.querySelectorAll('.hero, .manifesto, .workflow-explorer, .product-card, .film-player, .people-grid, .contact-grid').forEach(section => observer.observe(section));
}

const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
for (const [surfaceSelector, artSelector] of [['.hero', '.workflow-center img'], ['.film-cover', '.film-cover-art']]) {
  const surface = document.querySelector(surfaceSelector);
  const art = document.querySelector(artSelector);
  if (!surface || !art) continue;
  let frame;
  const reset = () => {
    cancelAnimationFrame(frame);
    art.style.setProperty('--pointer-x', '0px');
    art.style.setProperty('--pointer-y', '0px');
  };
  surface.addEventListener('pointermove', event => {
    if (!finePointer.matches || reducedMotion.matches || event.pointerType !== 'mouse') return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const rect = surface.getBoundingClientRect();
      art.style.setProperty('--pointer-x', `${(event.clientX - rect.left - rect.width / 2) / rect.width * 18}px`);
      art.style.setProperty('--pointer-y', `${(event.clientY - rect.top - rect.height / 2) / rect.height * 14}px`);
    });
  });
  surface.addEventListener('pointerleave', reset);
  finePointer.addEventListener('change', reset);
  reducedMotion.addEventListener('change', reset);
}

const readingProgress = document.querySelector('.reading-progress');
if (readingProgress) {
  let scrollFrame;
  const updateReading = () => {
    scrollFrame = undefined;
    const available = document.documentElement.scrollHeight - innerHeight;
    readingProgress.style.transform = `scaleX(${available > 0 ? Math.min(1, Math.max(0, scrollY / available)) : 0})`;
    document.querySelector('.header').classList.toggle('is-scrolled', scrollY > 32);
  };
  addEventListener('scroll', () => {
    if (scrollFrame === undefined) scrollFrame = requestAnimationFrame(updateReading);
  }, {passive: true});
  addEventListener('resize', updateReading);
  updateReading();
  const links = [...document.querySelectorAll('#main-nav a')];
  if ('IntersectionObserver' in window) {
    const sections = [...links.map(link => document.querySelector(link.getAttribute('href'))), document.querySelector('#thinking')];
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const link of links) {
          if (link.hash === `#${entry.target.id === 'thinking' ? 'approach' : entry.target.id}`) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        }
      }
    }, {rootMargin: '-20% 0px -55% 0px'});
    sections.forEach(section => observer.observe(section));
  }
}
