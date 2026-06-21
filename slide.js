document.querySelectorAll('.desc-toggle').forEach(toggle => {
  const targetClass = toggle.id.replace('toggle-', 'p-');
  const target = document.querySelector('.' + targetClass);
  toggle.addEventListener('click', () => {
    const isOpen = target.classList.toggle('open');
    toggle.textContent = isOpen ? 'read less' : 'read more';
  });
});

function moveSlide(slideshowId, direction) {
    const slideshow = document.getElementById(slideshowId);
    const slides = slideshow.querySelectorAll('.slide');
    let current = Array.from(slides).findIndex(s => s.classList.contains('active'));
    slides[current].classList.remove('active');
    current = (current + direction + slides.length) % slides.length;
    slides[current].classList.add('active');
    // fallback: if observer hasn't fired yet, load this slide's image now
    slides[current].querySelectorAll('img[data-src]:not([src])').forEach(img => {
      img.src = img.dataset.src;
    });
    const facade = slides[current].querySelector('.vimeo-facade');
    if (facade && typeof loadVimeo === 'function') loadVimeo(facade);
    const num = slideshowId.replace('slideshow-', '');
    const counter = document.querySelector(`#caption-${num} .cap-count`);
    if (counter) counter.textContent = `${current + 1}/${slides.length}`;
  }

  // when a slideshow nears the viewport, set src on all slide images at once
  // (they start with data-src only so the browser never fetches them early)
  const slideshowObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('.slide img[data-src]:not([src])').forEach(img => {
          img.src = img.dataset.src;
        });
        slideshowObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: '600px' });

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
  });
