document.querySelectorAll('.desc-toggle').forEach(toggle => {
  const targetClass = toggle.id.replace('toggle-', 'p-');
  const target = document.querySelector('.' + targetClass);
  toggle.addEventListener('click', () => {
    const isOpen = target.classList.toggle('open');
    toggle.textContent = isOpen ? 'read less' : 'read more';
  });
});

const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(navigator.userAgent);
if (isSafari) document.documentElement.classList.add('is-safari');
const safariSlideLocks = new WeakSet();
const safariHoldTimers = new WeakMap();
const safariCoverHoldMs = 160;

function moveSlide(slideshowId, direction) {
    const slideshow = document.getElementById(slideshowId);
    const slides = slideshow.querySelectorAll('.slide');
    let current = Array.from(slides).findIndex(s => s.classList.contains('active'));
    const next = (current + direction + slides.length) % slides.length;
    if (isSafari) {
      moveSlideSafari(slideshow, slides, current, next);
      return;
    }
    showSlide(slideshow, slides, current, next);
  }

  function loadSlideImg(img) {
    if (!img) return Promise.resolve();
    const source = img.getAttribute('src') || img.dataset.src;
    if (!source) return Promise.resolve();
    if (isSafari) {
      img.setAttribute('loading', 'eager');
      img.setAttribute('decoding', 'sync');
      img.setAttribute('fetchpriority', 'high');
    }
    if (!img.getAttribute('src')) {
      img.src = source;
    }
    return isSafari ? decodeSlideImg(img) : Promise.resolve();
  }

  function decodeSlideImg(img) {
    const loaded = img.complete && img.naturalWidth
      ? Promise.resolve()
      : new Promise(resolve => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        });
    return loaded.then(() => img.decode ? img.decode().catch(() => {}) : undefined);
  }

  function preloadSlideImages(slide) {
    return Promise.all(Array.from(slide.querySelectorAll('img')).map(loadSlideImg));
  }

  function preloadSlideshowImages(slideshow) {
    return Promise.all(Array.from(slideshow.querySelectorAll('.slide')).map(preloadSlideImages));
  }

  function preloadNearbySlides(slideshow, current, distance = 2) {
    const slides = Array.from(slideshow.querySelectorAll('.slide'));
    for (let offset = -1; offset <= distance; offset++) {
      const index = (current + offset + slides.length) % slides.length;
      preloadSlideImages(slides[index]);
    }
  }

  function primeVimeoThumbs(slide) {
    slide.querySelectorAll('.vimeo-facade[data-thumb]').forEach(facade => {
      if (!facade.style.backgroundImage) {
        facade.style.backgroundImage = `url("${facade.dataset.thumb}")`;
      }
    });
  }

  function updateCounter(slideshow, index, total) {
    const num = slideshow.id.replace('slideshow-', '');
    const counter = document.querySelector(`#caption-${num} .cap-count`);
    if (counter) counter.textContent = `${index + 1}/${total}`;
  }

  function showSlide(slideshow, slides, current, next) {
    slides[current].classList.remove('active');
    slides[next].classList.add('active');
    // fallback: if observer hasn't fired yet, load this slide's image now
    slides[next].querySelectorAll('img[data-src]:not([src])').forEach(loadSlideImg);
    primeVimeoThumbs(slides[next]);
    const facade = slides[next].querySelector('.vimeo-facade');
    if (facade && typeof loadVimeo === 'function') loadVimeo(facade);
    updateCounter(slideshow, next, slides.length);
  }

  async function moveSlideSafari(slideshow, slides, current, next) {
    if (safariSlideLocks.has(slideshow)) return;
    safariSlideLocks.add(slideshow);
    try {
      const previousSlide = slides[current];
      const nextSlide = slides[next];
      holdSafariSlide(previousSlide);
      await preloadSlideImages(nextSlide);
      primeVimeoThumbs(nextSlide);
      showSlide(slideshow, slides, current, next);
      preloadNearbySlides(slideshow, next);
      await waitForNextPaint(3);
      safariHoldTimers.set(
        previousSlide,
        window.setTimeout(() => releaseSafariSlide(previousSlide), safariCoverHoldMs)
      );
    } finally {
      safariSlideLocks.delete(slideshow);
    }
  }

  function holdSafariSlide(slide) {
    if (!slide) return;
    window.clearTimeout(safariHoldTimers.get(slide));
    slide.classList.add('safari-slide-hold');
  }

  function releaseSafariSlide(slide) {
    if (!slide) return;
    window.clearTimeout(safariHoldTimers.get(slide));
    safariHoldTimers.delete(slide);
    slide.classList.remove('safari-slide-hold');
  }

  function waitForNextPaint(frames = 2) {
    return new Promise(resolve => {
      const step = () => {
        frames -= 1;
        if (frames <= 0) {
          resolve();
        } else {
          requestAnimationFrame(step);
        }
      };
      requestAnimationFrame(step);
    });
  }

  const slideshowObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        preloadSlideshowImages(entry.target);
        slideshowObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: isSafari ? '3000px' : '2000px' });

  document.querySelectorAll('.slideshow').forEach(s => slideshowObserver.observe(s));

  document.querySelectorAll('.slideshow').forEach(slideshow => {
    const slides = slideshow.querySelectorAll('.slide');
    if (slides.length <= 1) return;
    slideshow.addEventListener('mousemove', e => {
      const isLeft = (e.clientX - slideshow.getBoundingClientRect().left) < slideshow.offsetWidth / 2;
      slideshow.classList.toggle('cursor-left', isLeft);
      slideshow.classList.toggle('cursor-right', !isLeft);
    });
    slideshow.addEventListener('mouseleave', () => {
      slideshow.classList.remove('cursor-left', 'cursor-right');
    });
    slideshow.addEventListener('click', e => {
      if (e.target.closest('.slide-arrow')) return;
      const isLeft = (e.clientX - slideshow.getBoundingClientRect().left) < slideshow.offsetWidth / 2;
      moveSlide(slideshow.id, isLeft ? -1 : 1);
    });
    if (isSafari) {
      const current = Array.from(slides).findIndex(s => s.classList.contains('active'));
      if (current !== -1) preloadNearbySlides(slideshow, current);
    }
  });
