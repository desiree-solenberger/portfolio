const videos = document.querySelectorAll('[data-vimeo-id]');

// player.js auto-embeds every [data-vimeo-id] it finds on DOMContentLoaded,
// building its own iframe with default settings — controls showing, unmuted,
// no loop — and starting all of them at once. Claiming them as deferred first
// leaves the facades below in charge of when and how each one loads.
videos.forEach(video => video.setAttribute('data-vimeo-defer', ''));

// A background-image is only fetched once its element is painted, and a strip
// frame scrolled out of view never is — so every poster past the first one was
// arriving as the frame slid in, too late to cover the load, and the white page
// showed through the transparent player instead. Every thumb on the site is
// about 5MB all told, so they're pulled up front and each frame is reached with
// its poster already in cache. The references are kept so nothing collects an
// in-flight load.
const posters = [];

videos.forEach(video => {
  const thumb = video.dataset.thumb;
  if (!thumb) return;
  video.style.backgroundImage = `url("${thumb}")`;
  const preload = new Image();
  preload.src = thumb;
  posters.push(preload);
});

// Fetching them wasn't enough: a JPEG is only decoded when it's first painted,
// and that decode is what the white was. The side nav jumps straight to an
// experiment, so there's no approach to hang a proximity trigger on — every
// poster is decoded up front instead. Resized to 1400px the whole site's worth
// is about 5MB and 70 megapixels, a one-off at load. They go one after another
// so the work spreads over a few frames rather than landing in one.
(function decodeNext(i) {
  const poster = posters[i];
  if (!poster) return;
  const then = () => decodeNext(i + 1);
  if (poster.decode) poster.decode().then(then, then);
  else { poster.onload = then; poster.onerror = then; }
})(0);

function loadVimeo(video) {
  if (video.dataset.loaded === 'true') return;

  const vimeoId = video.dataset.vimeoId;

  const iframe = document.createElement('iframe');
  // autopause defaults to 1, and it pauses every other Vimeo player on the
  // page the moment one starts — which on a multiplied stack stops the layer
  // underneath as soon as the one on top runs. Both layers have to play at
  // once for the blend to read, so it's off.
  iframe.src = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&muted=1&loop=1&controls=0&background=1&autopause=0`;
  iframe.allow = 'autoplay; fullscreen; picture-in-picture';
  iframe.loading = 'lazy';
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('allowfullscreen', '');

  video.appendChild(iframe);
  video.dataset.loaded = 'true';
  revealOnPlay(video, iframe);
}

// The poster sits behind the player rather than inside it, so once the video
// runs it shows through wherever the frame doesn't cover — and on a multiplied
// layer it blends down as well, reading as a doubled, offset copy. Drop it as
// soon as there are real frames to look at.
//
// Behind also means the iframe covers it, so the poster can't hold the frame
// on its own: the CSS starts the iframe transparent and the reveal below is
// what turns it on, in the same step that drops the poster.
function revealOnPlay(host, iframe) {
  let revealed = false;

  const player = window.Vimeo ? new window.Vimeo.Player(iframe) : null;

  function reveal() {
    if (revealed) return;
    revealed = true;
    iframe.classList.add('is-live');

    // The poster is behind the player, so it has to stay put while the iframe
    // fades up over it. Dropping it as the fade starts leaves a moment of
    // half-transparent player with nothing behind it — the same flash from the
    // other side. Clear it once the iframe is actually opaque.
    function dropPoster() { host.style.backgroundImage = ''; }
    iframe.addEventListener('transitionend', dropPoster, { once: true });
    // a display:none layer runs no transition, so transitionend may never
    // come — whichever of the two lands first drops it
    setTimeout(dropPoster, 400);
  }

  // no poster to hold the frame, so there's nothing to wait for
  if (!host.dataset.thumb) {
    reveal();
    return;
  }

  if (!player) {
    // no API to ask, so the document loading is the only signal there is
    iframe.addEventListener('load', reveal);
    return;
  }

  // Only real frames uncover the player. `play` fires when playback starts,
  // which can be before anything has been painted, so the clock actually
  // moving is the honest signal.
  function onTime(data) {
    if (!data || !(data.seconds > 0)) return;
    reveal();
    player.off('timeupdate', onTime);
  }
  player.on('timeupdate', onTime);

  // A rejected play() is not proof that autoplay was refused: with this many
  // players a rejection is usually just a not-ready or interrupted call, and
  // revealing on it uncovers a player with nothing in it — white. So nothing
  // is revealed without frames. If a video genuinely never plays its poster
  // simply stays up, which is what a poster is for.
  player.play().catch(() => {});
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;

    if (entry.target.dataset.vimeoId) {
      loadVimeo(entry.target);
      return;
    }

    // A stack warms every layer at once. The layers that aren't showing are
    // display:none and would never intersect on their own, so flipping to one
    // would otherwise sit waiting on a cold iframe.
    entry.target.querySelectorAll('[data-vimeo-id]').forEach(loadVimeo);
  });
}, {
  threshold: 0.25
});

document.querySelectorAll('.layer-stack').forEach(stack => {
  if (stack.querySelector('[data-vimeo-id]')) observer.observe(stack);
});

videos.forEach(video => {
  if (!video.closest('.layer-stack')) observer.observe(video);
});


// header filters — clicking one shows only the experiments carrying that tag
const filterBar = document.querySelector('.header .filters');
const columns = Array.from(document.querySelectorAll('.col-1, .col-2'));

if (filterBar && columns.length) {
  const rootStyle = getComputedStyle(document.documentElement);
  const block = rootStyle.getPropertyValue('--expt-block').trim();
  // read the count rather than counting tokens — the block holds a calc(),
  // which would otherwise be miscounted as several rows
  const rowsPerExpt = parseInt(rootStyle.getPropertyValue('--expt-rows'), 10) || 4;

  // An experiment is the pair of .expt blocks sitting at the same position in
  // each column, so hiding one side hides its counterpart on the other.
  const perColumn = columns.map(col => Array.from(col.querySelectorAll('.expt')));
  const total = Math.max(...perColumn.map(list => list.length));

  const experiments = Array.from({ length: total }, (_, index) => {
    const els = perColumn.map(list => list[index]).filter(Boolean);
    // the on-page tags under each experiment are the filter data
    const tags = els.flatMap(el =>
      Array.from(el.querySelectorAll('.expt-filters h3')).map(h => h.textContent.trim())
    );
    const count = els[0] && els[0].querySelector('.expt-count');
    const slot = count ? count.textContent.trim() : String(index + 1);
    return { els, tags, slot };
  });

  const overlays = Array.from(document.querySelectorAll('.col-1-overlay, .col-2-overlay'));
  // h3 rather than every child: the bar also carries the rule between lines
  const tagEls = Array.from(filterBar.querySelectorAll('h3'));
  // the side nav keys off the printed experiment number, which the filter
  // leaves alone — only --i is rewritten when experiments are reordered
  const navButtons = Array.from(document.querySelectorAll('.side-nav button[data-slot]'));
  const active = new Set();

  function render() {
    // multi-select narrows: an experiment must carry every selected tag.
    // swap `every` for `some` to widen it to "any of these" instead.
    const visible = experiments.filter(expt =>
      active.size === 0 || Array.from(active).every(name => expt.tags.includes(name))
    );
    const template = visible.length
      ? Array(visible.length).fill(block).join(' ')
      : 'none';

    columns.forEach(col => { col.style.gridTemplateRows = template; });

    overlays.forEach(overlay => {
      // the overlay subgrids onto its column, so it must not carry a template
      // of its own — the column's rows are the source of truth, and the last
      // row of each block is now content-sized rather than a fixed height
      Array.from(overlay.children).forEach((div, i) => {
        div.style.display = i < visible.length * rowsPerExpt ? '' : 'none';
      });
    });

    experiments.forEach(expt => {
      const slot = visible.indexOf(expt);
      expt.els.forEach(el => {
        if (slot === -1) {
          el.style.display = 'none';
        } else {
          el.style.display = '';
          // the stylesheet derives the block's four rows from --i
          el.style.setProperty('--i', slot + 1);
        }
      });
    });

    tagEls.forEach(tag => {
      const on = active.has(tag.textContent.trim());
      tag.classList.toggle('is-active', on);
      tag.setAttribute('aria-pressed', String(on));
    });

    // fill in the numbers a selection matched. With nothing selected every
    // experiment is showing, so highlighting them all would say nothing.
    const matched = new Set(active.size ? visible.map(expt => expt.slot) : []);
    navButtons.forEach(button => {
      button.classList.toggle('is-match', matched.has(button.dataset.slot));
    });

    syncBlockRows();
  }

  // The columns are separate grids, so each resolves its own auto-sized last
  // row: a caption taller than its tag row makes that block taller on the
  // right, and the offset compounds all the way down. No CSS can match tracks
  // across two grids, so measure the pair per experiment and floor both to the
  // taller one. Clearing first matters — otherwise last pass's floor is what
  // gets measured and the rows only ever grow.
  function syncBlockRows() {
    const pairs = experiments.map(expt =>
      expt.els
        .map(el => el.querySelector('.expt-filters, .expt-text'))
        .filter(Boolean)
    );

    pairs.forEach(pair => pair.forEach(el => { el.style.minHeight = ''; }));

    pairs.forEach(pair => {
      if (pair.length < 2) return;
      const tallest = Math.max(...pair.map(el => el.getBoundingClientRect().height));
      if (!tallest) return;   // whole experiment filtered out — nothing to match
      pair.forEach(el => { el.style.minHeight = `${tallest}px`; });
    });
  }

  // the rows depend on how the text wraps, so re-run whenever that can change
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(syncBlockRows, 150);
  });

  // webfont metrics differ from the fallback's, so the first measure is only
  // right once the faces are in
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(syncBlockRows);
  }

  tagEls.forEach(tag => {
    tag.tabIndex = 0;
    tag.setAttribute('role', 'button');
    tag.setAttribute('aria-pressed', 'false');

    function toggle() {
      const name = tag.textContent.trim();
      if (active.has(name)) active.delete(name);   // clicking a selected tag deselects it
      else active.add(name);
      render();
    }

    tag.addEventListener('click', toggle);
    tag.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    });
  });

  render();
}


// ⤤ cursor while the pointer is over a horizontal slideshow.
// A row holding one frame — or none — has nowhere to scroll, so the arrow would
// be promising a movement that never comes. Those keep the ordinary pointer:
// they're marked .is-static, which is also what tells the stylesheet to leave
// the native cursor alone there.
function slideCount(show) {
  const wrapper = show.querySelector('.wrapper');
  return wrapper ? wrapper.children.length : 0;
}

const slideshows = Array.from(document.querySelectorAll('.img-scroll')).filter(show => {
  const scrollable = slideCount(show) > 1;
  if (!scrollable) show.classList.add('is-static');
  return scrollable;
});

if (slideshows.length) {
  const cursor = document.createElement('div');
  cursor.id = 'slideshow-cursor';
  cursor.textContent = '⤤';
  cursor.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cursor);
  document.body.classList.add('has-slideshow-cursor');

  function moveCursor(event) {
    cursor.style.transform =
      `translate(${event.clientX}px, ${event.clientY}px) translate(-50%, -50%)`;
  }

  slideshows.forEach(show => {
    show.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'mouse') return;
      moveCursor(event);
      cursor.classList.add('is-visible');
    });

    show.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse') return;
      moveCursor(event);
    });

    show.addEventListener('pointerleave', () => cursor.classList.remove('is-visible'));

    // The ⤤ says the strip moves forward, so a click anywhere it's showing steps
    // one frame along — the scroll gesture still works, this is just a second way
    // in. Frame edges are measured against the container's own left edge rather
    // than offsetLeft, since .img-scroll isn't a positioned ancestor.
    show.addEventListener('click', () => {
      const wrapper = show.querySelector('.wrapper');
      if (!wrapper) return;

      // at the far end there's nothing left to advance to, so it returns to the
      // first frame instead of the click going dead. 1px of slack absorbs the
      // sub-pixel rounding in scroll positions.
      if (show.scrollLeft >= show.scrollWidth - show.clientWidth - 1) {
        show.scrollTo({ left: 0, behavior: 'smooth' });
        return;
      }

      const edge = show.getBoundingClientRect().left;
      const next = Array.from(wrapper.children)
        .find(frame => frame.getBoundingClientRect().left - edge > 1);
      if (!next) return;

      show.scrollBy({
        left: next.getBoundingClientRect().left - edge,
        behavior: 'smooth'
      });
    });
  });
}


// Column navigation. Everything below works in experiment numbers rather than
// pixel offsets, so the two columns stay paired even if their content heights
// drift apart or a filter hides different amounts of each.
const navColumns = Array.from(document.querySelectorAll('.col-1, .col-2'));

// where a column parks an experiment: just below the fixed header
function columnAnchorLine(column) {
  const headroom = parseFloat(getComputedStyle(column).paddingTop) || 0;
  return column.getBoundingClientRect().top + headroom;
}

function visibleBlocks(column) {
  return Array.from(column.querySelectorAll('.expt'))
    .filter(expt => expt.style.display !== 'none' && expt.querySelector('.expt-count'));
}

function scrollColumnToSlot(column, slot) {
  const block = visibleBlocks(column)
    .find(expt => expt.querySelector('.expt-count').textContent.trim() === slot);
  if (!block) return;   // hidden by a filter on this side: leave the column alone

  const anchor = block.querySelector('.expt-count');
  const offset = anchor.getBoundingClientRect().top - columnAnchorLine(column);

  column.scrollTo({ top: column.scrollTop + offset, behavior: 'smooth' });
}

// side nav — one circle per experiment, moving BOTH columns to that number
document.querySelectorAll('.side-nav button[data-slot]').forEach(button => {
  button.addEventListener('click', () => {
    navColumns.forEach(column => scrollColumnToSlot(column, button.dataset.slot));
  });
});


// A <video> layer can be scrubbed directly, while a Vimeo embed only answers
// through the player SDK. Wrapping both in the same four calls lets the toggle
// drive a stack without caring which kind of layer it holds — including mixed
// stacks, a local plate under a Vimeo type layer.
function mediaControl(layer) {
  if (layer.tagName === 'VIDEO') {
    return {
      play: () => { const played = layer.play(); if (played) played.catch(() => {}); },
      pause: () => layer.pause(),
      time: () => Promise.resolve(layer.currentTime),
      seek: (seconds) => { layer.currentTime = seconds; }
    };
  }

  if (!layer.dataset.vimeoId) return null;   // a still plate has nothing to drive

  let player = null;

  // built on first use: the iframe only exists once the observer has loaded it
  function get() {
    if (player) return player;
    const iframe = layer.querySelector('iframe');
    if (!iframe || !window.Vimeo) return null;   // no SDK: the embed autoplays unsynced
    player = new window.Vimeo.Player(iframe);
    return player;
  }

  return {
    play: () => { const p = get(); if (p) p.play().catch(() => {}); },
    pause: () => { const p = get(); if (p) p.pause().catch(() => {}); },
    time: () => { const p = get(); return p ? p.getCurrentTime().catch(() => 0) : Promise.resolve(0); },
    seek: (seconds) => { const p = get(); if (p) p.setCurrentTime(seconds).catch(() => {}); }
  };
}

// two embeds buffer independently and slide apart, so the top layer gets
// nudged back when the gap opens past a couple of frames
const DRIFT_LIMIT = 0.2;
const DRIFT_INTERVAL = 3000;

// layer toggle — each button cycles the layers inside the stack it targets
document.querySelectorAll('.layer-toggle').forEach(button => {
  const stack = document.getElementById(button.dataset.target);
  if (!stack) return;

  const layers = Array.from(stack.querySelectorAll('.layer'));
  if (!layers.length) return;

  const controls = layers.map(mediaControl);
  let index = Math.max(0, layers.findIndex(l => l.classList.contains('is-active')));

  async function show(next) {
    index = next;

    layers.forEach((layer, n) => {
      const isTop = n === next;
      // layer 0 stays underneath as the plate the type layer multiplies onto
      const isPlate = n === 0 && next !== 0;

      layer.classList.toggle('is-active', isTop || isPlate);
      layer.classList.toggle('is-multiplied', isTop && next !== 0);
    });

    // the glow belongs to the layered state, not the resting plate
    stack.classList.toggle('is-layered', next !== 0);

    button.textContent = layers[next].dataset.label || layers[next].dataset.layer;

    const onScreen = next === 0 ? [0] : [0, next];

    layers.forEach((_, n) => {
      if (!onScreen.includes(n) && controls[n]) controls[n].pause();
    });

    // line the type layer up with the plate before they run together, so it
    // lands on the frame it was authored against rather than starting cold
    const plate = controls[onScreen[0]];
    const playhead = plate ? await plate.time() : 0;

    onScreen.forEach((n, position) => {
      const control = controls[n];
      if (!control) return;
      if (position > 0) control.seek(playhead);
      control.play();
    });
  }

  button.addEventListener('click', () => {
    show((index + 1) % layers.length);
  });

  // only embeds need watching; two <video> elements hold their own sync
  if (layers.some(layer => layer.dataset.vimeoId)) {
    setInterval(async () => {
      if (index === 0) return;
      const plate = controls[0];
      const top = controls[index];
      if (!plate || !top) return;

      const [plateTime, topTime] = await Promise.all([plate.time(), top.time()]);
      if (Math.abs(plateTime - topTime) > DRIFT_LIMIT) top.seek(plateTime);
    }, DRIFT_INTERVAL);
  }

  show(index);
});


// window.addEventListener("DOMContentLoaded", () => {
//   const title = document.getElementById("mvmt-title");

//   if (!title) return;

//   let underscoreCount = 1;
//   let direction = 1;

//   function animateTitle() {
//     title.textContent = "MVMT" + "_".repeat(underscoreCount) + "INTFC";

//     if (direction === 1 && underscoreCount >= 20) {
//       direction = -1;
//     } else if (direction === -1) {
//       if (underscoreCount <= 1) {
//         direction = 1;
//       } else if (underscoreCount <= 5 && Math.random() < 0.3) {
//         direction = 1;
//       }
//     }

//     let speed;

//     if (underscoreCount === 1 || underscoreCount === 20) {
//       speed = 800 + Math.random() * 700;
//     } else {
//       speed = 40 + Math.random() * 90;
//     }

//     underscoreCount += direction;

//     setTimeout(animateTitle, speed);
//   }

//   animateTitle();
// });