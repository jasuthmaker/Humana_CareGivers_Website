/**
 * HandNav — hands-free website navigation via hand gestures.
 *
 * Runs entirely in the browser (no server calls, no API keys, $0 cost).
 * Hand detection uses MediaPipe Hand Landmarker, a free Apache-2.0 model
 * executed on the local GPU (WebGL — hardware-accelerated on NVIDIA GPUs).
 * The only permission ever requested is camera access.
 *
 * Controls:
 *   Move hand UP ........ scroll up
 *   Move hand DOWN ...... scroll down (speed follows hand distance)
 *   Swipe RIGHT ......... next page
 *   Swipe LEFT .......... previous page
 *   PEACE sign (V fingers) .. pause / resume hand control
 */
(function () {
  'use strict';

  var PAGES = ['/', '/activities', '/physical-health', '/mental-health', '/social-connection'];
  var PAGE_NAMES = ['Home', 'Activities', 'Physical Health', 'Mental Health', 'Social Connection'];

  var CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
  var MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

  var CFG = {
    scrollThreshold: 0.25,   // hand Y motion beyond this triggers scroll
    maxScrollSpeed: 26,      // px per frame at full hand motion
    swipeMinDistance: 0.15,  // min hand X motion to count as swipe
    swipeMaxDuration: 500,   // ms to complete a swipe
    peaceDuration: 800,      // ms holding peace sign to toggle pause
    smoothing: 0.4           // EMA factor for hand position (higher = snappier)
  };

  var state = {
    running: false,
    paused: false,
    stream: null,
    landmarker: null,
    video: null,
    raf: null,
    handPos: { x: 0.5, y: 0.5, confidence: 0 },
    swipeStart: null,
    swipeGesture: null,
    peaceStart: null,
    lastVideoTime: -1
  };

  var ui = {};

  /* ---------------------------------------------------------------- UI -- */

  function buildUI() {
    var launch = el('button', 'handnav-launch', '<span class="handnav-hand">&#128073;</span> Hand Navigation');
    launch.title = 'Navigate this site using hand gestures';
    launch.addEventListener('click', showIntro);
    document.body.appendChild(launch);
    ui.launch = launch;

    var overlay = el('div', 'handnav-overlay handnav-hidden');
    overlay.innerHTML =
      '<div class="handnav-card">' +
      '  <h2><span class="handnav-hand">&#128073;</span> Hand Navigation</h2>' +
      '  <p>Browse this entire site using hand gestures. Everything runs privately on your device &mdash; the camera feed never leaves your browser.</p>' +
      '  <ul>' +
      '    <li><b>Move hand up / down</b> &mdash; scroll (further = faster)</li>' +
      '    <li><b>Swipe right</b> &mdash; next page</li>' +
      '    <li><b>Swipe left</b> &mdash; previous page</li>' +
      '    <li><b>Peace sign (V fingers)</b> &mdash; pause or resume</li>' +
      '  </ul>' +
      '  <p class="handnav-perm">The only permission requested is <b>camera access</b>.</p>' +
      '  <div class="handnav-actions">' +
      '    <button class="handnav-btn handnav-btn-primary" id="handnav-start">Enable camera &amp; start</button>' +
      '    <button class="handnav-btn" id="handnav-cancel">Not now</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(overlay);
    ui.overlay = overlay;
    overlay.querySelector('#handnav-start').addEventListener('click', start);
    overlay.querySelector('#handnav-cancel').addEventListener('click', hideIntro);

    var hud = el('div', 'handnav-hud handnav-hidden');
    hud.innerHTML =
      '<div class="handnav-videowrap">' +
      '  <video class="handnav-video" autoplay playsinline muted></video>' +
      '  <div class="handnav-arrow handnav-arrow-up">&#9650;</div>' +
      '  <div class="handnav-arrow handnav-arrow-down">&#9660;</div>' +
      '  <div class="handnav-arrow handnav-arrow-left">&#9664;</div>' +
      '  <div class="handnav-arrow handnav-arrow-right">&#9654;</div>' +
      '  <svg class="handnav-ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16"></circle></svg>' +
      '</div>' +
      '<div class="handnav-status">Starting&hellip;</div>' +
      '<button class="handnav-stop" title="Stop hand navigation">&times;</button>';
    document.body.appendChild(hud);
    ui.hud = hud;
    ui.video = hud.querySelector('.handnav-video');
    ui.status = hud.querySelector('.handnav-status');
    ui.ring = hud.querySelector('.handnav-ring circle');
    ui.arrows = {
      up: hud.querySelector('.handnav-arrow-up'),
      down: hud.querySelector('.handnav-arrow-down'),
      left: hud.querySelector('.handnav-arrow-left'),
      right: hud.querySelector('.handnav-arrow-right')
    };
    hud.querySelector('.handnav-stop').addEventListener('click', stop);

    var banner = el('div', 'handnav-banner handnav-hidden');
    document.body.appendChild(banner);
    ui.banner = banner;
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    n.className = cls;
    if (html) n.innerHTML = html;
    return n;
  }

  function showIntro() { ui.overlay.classList.remove('handnav-hidden'); }
  function hideIntro() { ui.overlay.classList.add('handnav-hidden'); }

  function setStatus(text, tone) {
    ui.status.textContent = text;
    ui.status.className = 'handnav-status' + (tone ? ' handnav-status-' + tone : '');
  }

  function flashBanner(text) {
    ui.banner.textContent = text;
    ui.banner.classList.remove('handnav-hidden');
    clearTimeout(ui.bannerTimer);
    ui.bannerTimer = setTimeout(function () {
      ui.banner.classList.add('handnav-hidden');
    }, 1600);
  }

  /* --------------------------------------------------------- lifecycle -- */

  async function start() {
    hideIntro();
    ui.launch.classList.add('handnav-hidden');
    ui.hud.classList.remove('handnav-hidden');
    setStatus('Requesting camera…');

    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      });
    } catch (err) {
      setStatus('Camera access denied', 'err');
      console.error('HandNav: camera denied', err);
      setTimeout(stop, 2500);
      return;
    }

    ui.video.srcObject = state.stream;
    setStatus('Loading hand model…');

    try {
      var vision = await import(CDN + '/vision_bundle.mjs');
      var fileset = await vision.FilesetResolver.forVisionTasks(CDN + '/wasm');
      state.landmarker = await vision.HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 1
      });
    } catch (err) {
      setStatus('Model failed to load', 'err');
      console.error('HandNav: model load failed', err);
      setTimeout(stop, 2500);
      return;
    }

    await ui.video.play().catch(function () {});
    state.running = true;
    state.paused = false;
    sessionStorage.setItem('handnav-active', '1');
    setStatus('Hand control active', 'ok');
    flashBanner('Hand navigation on — move your hand to navigate');
    loop();
  }

  function stop() {
    state.running = false;
    sessionStorage.removeItem('handnav-active');
    if (state.raf) cancelAnimationFrame(state.raf);
    if (state.stream) {
      state.stream.getTracks().forEach(function (t) { t.stop(); });
      state.stream = null;
    }
    if (state.landmarker) {
      state.landmarker.close();
      state.landmarker = null;
    }
    ui.hud.classList.add('handnav-hidden');
    ui.launch.classList.remove('handnav-hidden');
  }

  /* -------------------------------------------------------- hand logic -- */

  function loop() {
    if (!state.running) return;
    state.raf = requestAnimationFrame(loop);

    var video = ui.video;
    if (video.readyState < 2 || video.currentTime === state.lastVideoTime) return;
    state.lastVideoTime = video.currentTime;

    var result = state.landmarker.detectForVideo(video, performance.now());
    if (!result.landmarks || !result.landmarks[0]) {
      setStatus('Hand not found — show your hand', 'warn');
      decayPos();
      render();
      return;
    }

    var hand = result.landmarks[0];
    // Use palm center (average of landmarks 0, 5, 9, 13, 17)
    var cx = 0, cy = 0;
    [0, 5, 9, 13, 17].forEach(function (i) {
      cx += hand[i].x;
      cy += hand[i].y;
    });
    cx /= 5;
    cy /= 5;

    state.handPos.confidence = result.handedness[0] ? result.handedness[0].score : 0.5;

    // Smooth position
    state.handPos.x += CFG.smoothing * (cx - state.handPos.x);
    state.handPos.y += CFG.smoothing * (cy - state.handPos.y);

    handlePeace(hand);
    if (!state.paused) {
      handleScroll();
      handleSwipe(hand);
    }
    render();
  }

  function decayPos() {
    state.handPos.x += (0.5 - state.handPos.x) * 0.1;
    state.handPos.y += (0.5 - state.handPos.y) * 0.1;
  }

  function handlePeace(hand) {
    // Peace sign: index and middle fingers extended, others closed
    // Simplified: check if index (4) and middle (8) are above ring (12) and pinky (16)
    var isIndex = hand[4].y < hand[3].y - 0.05;
    var isMiddle = hand[8].y < hand[7].y - 0.05;
    var isRing = hand[12].y > hand[11].y;
    var isPinky = hand[16].y > hand[15].y;

    var isPeace = isIndex && isMiddle && isRing && isPinky;

    var now = performance.now();
    if (isPeace && !state.peaceStart) {
      state.peaceStart = now;
    } else if (isPeace && now - state.peaceStart > CFG.peaceDuration) {
      state.peaceStart = 0;
      state.paused = !state.paused;
      setStatus(state.paused ? 'Paused — peace sign again to resume' : 'Hand control active',
        state.paused ? 'warn' : 'ok');
      flashBanner(state.paused ? 'Hand control paused' : 'Hand control resumed');
    } else if (!isPeace) {
      state.peaceStart = 0;
    }
  }

  function handleScroll() {
    var y = state.handPos.y;
    var up = Math.max(0, CFG.scrollThreshold - y) / CFG.scrollThreshold;
    var down = Math.max(0, y - (1 - CFG.scrollThreshold)) / CFG.scrollThreshold;

    if (down > 0.05) {
      window.scrollBy(0, speedFor(down));
    } else if (up > 0.05) {
      window.scrollBy(0, -speedFor(up));
    }
  }

  function speedFor(excess) {
    var t = Math.min(excess, 1);
    return Math.max(2, t * CFG.maxScrollSpeed);
  }

  function handleSwipe(hand) {
    // Swipe: track horizontal motion of palm
    if (!state.swipeStart) {
      state.swipeStart = { x: state.handPos.x, time: performance.now() };
      return;
    }

    var now = performance.now();
    var elapsed = now - state.swipeStart.time;
    var dx = state.handPos.x - state.swipeStart.x;

    if (elapsed > CFG.swipeMaxDuration) {
      // Swipe expired
      state.swipeStart = { x: state.handPos.x, time: now };
      return;
    }

    if (Math.abs(dx) < CFG.swipeMinDistance) return;

    // Swipe detected
    state.swipeStart = null;
    var dir = dx > 0 ? 'right' : 'left';
    navigate(dir === 'right' ? 1 : -1);
  }

  function navigate(step) {
    var idx = PAGES.indexOf(location.pathname.replace(/\/+$/, '') || '/');
    if (idx === -1) idx = 0;
    var next = (idx + step + PAGES.length) % PAGES.length;
    flashBanner('Going to ' + PAGE_NAMES[next] + '…');
    setStatus('Navigating…');
    state.running = false;
    setTimeout(function () { location.href = PAGES[next]; }, 400);
  }

  /* ------------------------------------------------------------ render -- */

  function render() {
    var y = state.handPos.y;
    var x = state.handPos.x;
    toggleArrow('up', !state.paused && y < CFG.scrollThreshold);
    toggleArrow('down', !state.paused && y > 1 - CFG.scrollThreshold);
    toggleArrow('left', !state.paused && x < 0.4);
    toggleArrow('right', !state.paused && x > 0.6);
  }

  function toggleArrow(dir, on) {
    ui.arrows[dir].classList.toggle('handnav-arrow-active', !!on);
  }

  /* -------------------------------------------------------------- init -- */

  function init() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    buildUI();
    if (sessionStorage.getItem('handnav-active') === '1') start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
