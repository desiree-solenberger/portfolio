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
// phone layout (matches the MOBILE block in css/main.css)
const mobileMQ = window.matchMedia('(max-width: 650px)');

function moveSlide(slideshowId, direction) {
    const slideshow = document.getElementById(slideshowId);
    const slides = slideshow.querySelectorAll('.slide');
    let current = Array.from(slides).findIndex(s => s.classList.contains('active'));
    const next = (current + direction + slides.length) % slides.length;
    if (mobileMQ.matches) {
      moveSlideMobile(slideshow, slides, next, current);
      return;
    }
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
    return (isSafari || mobileMQ.matches) ? decodeSlideImg(img) : Promise.resolve();
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
    return Promise.all(Array.from(slideshow.querySelectorAll('.slide')).map(slide => {
      primeVimeoThumbs(slide);
      return preloadSlideImages(slide);
    }));
  }

  function preloadNearbySlides(slideshow, current, distance = 2) {
    const slides = Array.from(slideshow.querySelectorAll('.slide'));
    for (let offset = -1; offset <= distance; offset++) {
      const index = (current + offset + slides.length) % slides.length;
      primeVimeoThumbs(slides[index]);
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
    if (current === -1 || current === next) return;
    safariSlideLocks.add(slideshow);
    try {
      const previousSlide = slides[current];
      const nextSlide = slides[next];
      await preloadSlideImages(nextSlide);
      primeVimeoThumbs(nextSlide);
      nextSlide.classList.add('active', 'safari-slide-entering');
      nextSlide.querySelectorAll('img[data-src]:not([src])').forEach(loadSlideImg);
      const facade = nextSlide.querySelector('.vimeo-facade');
      if (facade && typeof loadVimeo === 'function') loadVimeo(facade);
      updateCounter(slideshow, next, slides.length);
      preloadNearbySlides(slideshow, next);
      await waitForNextPaint(2);
      previousSlide.classList.remove('active');
      nextSlide.classList.remove('safari-slide-entering');
    } finally {
      safariSlideLocks.delete(slideshow);
    }
  }

  // Mobile: slides sit side by side in a scroll-snap strip (see CSS), so a
  // swipe is native scrolling. A tap scrolls to the next slide; the scroll
  // listener below keeps .active and the counter in sync either way.
  function moveSlideMobile(slideshow, slides, next, current) {
    const width = slideshow.clientWidth;
    const wrapping = Math.abs(next - current) > 1; // last -> first: jump, don't scroll past every slide
    preloadNearbySlides(slideshow, next);
    slideshow.scrollTo({ left: next * width, behavior: wrapping ? 'auto' : 'smooth' });
  }

  function syncMobileSlide(slideshow) {
    const slides = slideshow.querySelectorAll('.slide');
    const width = slideshow.clientWidth;
    if (!width) return;
    const index = Math.min(slides.length - 1, Math.max(0, Math.round(slideshow.scrollLeft / width)));
    const current = Array.from(slides).findIndex(s => s.classList.contains('active'));
    if (index === current) return;
    if (current !== -1) slides[current].classList.remove('active');
    slides[index].classList.add('active');
    updateCounter(slideshow, index, slides.length);
    preloadNearbySlides(slideshow, index);
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
      if (mobileMQ.matches) {
        moveSlide(slideshow.id, 1); // tap anywhere = next; swipe right to go back
        return;
      }
      const isLeft = (e.clientX - slideshow.getBoundingClientRect().left) < slideshow.offsetWidth / 2;
      moveSlide(slideshow.id, isLeft ? -1 : 1);
    });
    let syncFrame = 0;
    slideshow.addEventListener('scroll', () => {
      if (!mobileMQ.matches) return;
      cancelAnimationFrame(syncFrame);
      syncFrame = requestAnimationFrame(() => syncMobileSlide(slideshow));
    }, { passive: true });
    if (isSafari || mobileMQ.matches) {
      const current = Array.from(slides).findIndex(s => s.classList.contains('active'));
      if (current !== -1) preloadNearbySlides(slideshow, current);
      // whole slideshow: Safari up front; mobile when it nears the viewport (observer above)
      if (isSafari) preloadSlideshowImages(slideshow);
    }
  });
