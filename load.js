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

  const params = isMobile
    ? 'autoplay=1&muted=1&loop=1&controls=0&playsinline=1&autopause=0'
    : 'autoplay=1&muted=1&loop=1&controls=0&background=1&playsinline=1';

  const iframe = document.createElement('iframe');
  iframe.src = `https://player.vimeo.com/video/${vimeoId}?${params}`;
  iframe.allow = 'autoplay; fullscreen; picture-in-picture';
  iframe.setAttribute('webkit-playsinline', '');
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
