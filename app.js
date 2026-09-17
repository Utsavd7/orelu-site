const tidy = document.querySelector('.tidy-button');
const workflow = document.querySelector('#workflow');
const range = document.querySelector('#workflow-range');
const caption = document.querySelector('#workflow-label');
if (tidy && workflow && range && caption) {
  const cards = [...workflow.querySelectorAll('.task')];
  const rotations = [-8, 7, -6, 5];
  let frame;
  function showFlow(value) {
    const progress = value / 100;
    range.value = value;
    workflow.closest('.workbench').style.setProperty('--flow', progress);
    cards.forEach((card, index) => {
      const x = (workflow.clientWidth - card.offsetWidth) / 2 - card.offsetLeft;
      const y = 4 + index * ((workflow.clientHeight - card.offsetHeight - 8) / 3) - card.offsetTop;
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
  range.addEventListener('input', () => { cancelAnimationFrame(frame); showFlow(Number(range.value)); });
  tidy.addEventListener('click', () => {
    cancelAnimationFrame(frame);
    const start = Number(range.value), end = start >= 95 ? 0 : 100;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { showFlow(end); return; }
    const began = performance.now();
    const animate = now => {
      const t = Math.min((now - began) / 700, 1);
      showFlow(start + (end - start) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
  });
  new ResizeObserver(() => showFlow(Number(range.value))).observe(workflow);
  showFlow(0);
}

const exampleTabs = document.querySelector('.example-tabs');
if (exampleTabs) {
  const compact = matchMedia('(max-width: 800px)');
  const setOrientation = () => exampleTabs.setAttribute('aria-orientation', compact.matches ? 'horizontal' : 'vertical');
  compact.addEventListener('change', setOrientation);
  setOrientation();
}

// Each example keeps its own selection and keyboard focus.
for (const list of document.querySelectorAll('[role="tablist"]')) {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  function select(tab, moveFocus = false) {
    for (const item of tabs) {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
    }
    if (moveFocus) tab.focus();
  }
  for (const tab of tabs) {
    tab.addEventListener('click', () => select(tab));
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
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.08 });
  for (const section of document.querySelectorAll('.manifesto, .workflow-explorer, .product-heading, .product-card, .people-grid')) {
    section.classList.add('reveal', 'ready');
    observer.observe(section);
  }
}
