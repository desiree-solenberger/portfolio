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
  video.dataset.loaded = 'true';

  const vimeoId = video.dataset.vimeoId;
  const iframe = document.createElement('iframe');
  iframe.allow = 'autoplay; fullscreen; picture-in-picture';
  iframe.setAttribute('webkit-playsinline', '');
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('allowfullscreen', '');

  if (isMobile) {
    // inject visible immediately — mobile browsers throttle hidden iframes and won't autoplay
    iframe.src = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&muted=1&loop=1&playsinline=1`;
    video.appendChild(iframe);
  } else {
    // on desktop: hide until playing so thumbnail covers the loading spinner
    iframe.src = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&muted=1&loop=1&controls=0&background=1&playsinline=1`;
    iframe.style.opacity = '0';
    iframe.style.transition = 'opacity 0.4s';
    video.appendChild(iframe);

    const show = () => { iframe.style.opacity = '1'; };
    const onMessage = (e) => {
      if (e.source !== iframe.contentWindow) return;
      try {
        const data = JSON.parse(e.data);
        if (data.event === 'ready') {
          iframe.contentWindow.postMessage(
            JSON.stringify({ method: 'addEventListener', value: 'play' }), '*'
          );
        }
        if (data.event === 'play') {
          show();
          window.removeEventListener('message', onMessage);
        }
      } catch {}
    };
    window.addEventListener('message', onMessage);
    setTimeout(() => { show(); window.removeEventListener('message', onMessage); }, 4000);
  }
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
