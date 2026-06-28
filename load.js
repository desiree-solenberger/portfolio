const videos = document.querySelectorAll('[data-vimeo-id]');

videos.forEach(video => {
  const thumb = video.dataset.thumb;
  if (thumb) {
    video.style.backgroundImage = `url("${thumb}")`;
  }
});

const isMobile = window.matchMedia('(max-width: 650px)').matches;

function loadVimeo(video) {
  if (video.dataset.loaded === 'true') return;

  const vimeoId = video.dataset.vimeoId;

  if (isMobile) {
    // iOS blocks iframe autoplay — show thumbnail, tap to play with native controls
    video.style.cursor = 'pointer';
    video.addEventListener('click', () => {
      if (video.dataset.loaded === 'true') return;
      const iframe = document.createElement('iframe');
      iframe.src = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&muted=0&controls=1&playsinline=1`;
      iframe.allow = 'autoplay; fullscreen; picture-in-picture';
      iframe.setAttribute('webkit-playsinline', '');
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allowfullscreen', '');
      iframe.style.position = 'absolute';
      iframe.style.inset = '0';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      video.appendChild(iframe);
      video.dataset.loaded = 'true';
    }, { once: true });
    video.dataset.loaded = 'true';
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.src = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&muted=1&loop=1&controls=0&background=1&playsinline=1`;
  iframe.allow = 'autoplay; fullscreen; picture-in-picture';
  iframe.setAttribute('webkit-playsinline', '');
  iframe.loading = 'lazy';
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('allowfullscreen', '');

  video.appendChild(iframe);
  video.dataset.loaded = 'true';
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      loadVimeo(entry.target);
      observer.unobserve(entry.target);
    }
  });
}, {
  rootMargin: '400px',
  threshold: 0
});

videos.forEach(video => observer.observe(video));
