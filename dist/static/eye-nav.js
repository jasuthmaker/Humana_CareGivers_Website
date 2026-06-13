/**
 * EyeNav — hands-free, eyes-only website navigation.
 *
 * Runs entirely in the browser (no server calls, no API keys, $0 cost).
 * Gaze detection uses MediaPipe Face Landmarker, a free Apache-2.0 model
 * executed on the local GPU (WebGL — hardware-accelerated on NVIDIA GPUs).
 * The only permission ever requested is camera access.
 *
 * Controls:
 *   Look DOWN .... scroll down (speed follows how far you look)
 *   Look UP ...... scroll up
 *   Hold gaze LEFT ... go to previous page
 *   Hold gaze RIGHT .. go to next page
 *   Long blink (~0.7s) pause / resume eye control
 */
(function () {
  'use strict';

  var PAGES = ['/', '/activities', '/physical-health', '/mental-health', '/social-connection'];
  var PAGE_NAMES = ['Home', 'Activities', 'Physical Health', 'Mental Health', 'Social Connection'];

  var CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
  var MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

  var CFG = {
    scrollThreshold: 0.32,   // blendshape score where scrolling starts
    maxScrollSpeed: 26,      // px per frame at full gaze deflection
    navThreshold: 0.42,      // horizontal gaze score to arm page navigation
    navHoldMs: 1200,         // hold gaze left/right this long to navigate
    blinkThreshold: 0.55,    // eye-closed blendshape score counted as closed
    longBlinkMs: 700,        // closed-eyes duration that toggles pause
    smoothing: 0.35          // EMA factor for gaze scores (higher = snappier)
  };

  var state = {
    running: false,
    paused: false,
    stream: null,
    landmarker: null,
    video: null,
    raf: null,
    gaze: { up: 0, down: 0, left: 0, right: 0, blink: 0 },
    navHoldStart: 0,
    navHoldDir: null,
    blinkStart: 0,
    lastVideoTime: -1
  };

  var ui = {};

  /* ---------------------------------------------------------------- UI -- */

  function buildUI() {
    var launch = el('button', 'eyenav-launch', '<span class="eyenav-eye">&#128065;</span> Eye Navigation');
    launch.title = 'Navigate this site using only your eyes';
    launch.addEventListener('click', showIntro);
    document.body.appendChild(launch);
    ui.launch = launch;

    var overlay = el('div', 'eyenav-overlay eyenav-hidden');
    overlay.innerHTML =
      '<div class="eyenav-card">' +
      '  <h2><span class="eyenav-eye">&#128065;</span> Eye Navigation</h2>' +
      '  <p>Browse this entire site using only your eyes. Everything runs privately on your device &mdash; the camera feed never leaves your browser.</p>' +
      '  <ul>' +
      '    <li><b>Look down</b> &mdash; scroll down (further = faster)</li>' +
      '    <li><b>Look up</b> &mdash; scroll up</li>' +
      '    <li><b>Hold gaze left / right</b> &mdash; previous / next page</li>' +
      '    <li><b>Long blink</b> (close eyes ~1s) &mdash; pause or resume</li>' +
      '  </ul>' +
      '  <p class="eyenav-perm">The only permission requested is <b>camera access</b>.</p>' +
      '  <div class="eyenav-actions">' +
      '    <button class="eyenav-btn eyenav-btn-primary" id="eyenav-start">Enable camera &amp; start</button>' +
      '    <button class="eyenav-btn" id="eyenav-cancel">Not now</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(overlay);
    ui.overlay = overlay;
    overlay.querySelector('#eyenav-start').addEventListener('click', start);
    overlay.querySelector('#eyenav-cancel').addEventListener('click', hideIntro);

    var hud = el('div', 'eyenav-hud eyenav-hidden');
    hud.innerHTML =
      '<div class="eyenav-videowrap">' +
      '  <video class="eyenav-video" autoplay playsinline muted></video>' +
      '  <div class="eyenav-arrow eyenav-arrow-up">&#9650;</div>' +
      '  <div class="eyenav-arrow eyenav-arrow-down">&#9660;</div>' +
      '  <div class="eyenav-arrow eyenav-arrow-left">&#9664;</div>' +
      '  <div class="eyenav-arrow eyenav-arrow-right">&#9654;</div>' +
      '  <svg class="eyenav-ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16"></circle></svg>' +
      '</div>' +
      '<div class="eyenav-status">Starting&hellip;</div>' +
      '<button class="eyenav-stop" title="Stop eye navigation">&times;</button>';
    document.body.appendChild(hud);
    ui.hud = hud;
    ui.video = hud.querySelector('.eyenav-video');
    ui.status = hud.querySelector('.eyenav-status');
    ui.ring = hud.querySelector('.eyenav-ring circle');
    ui.arrows = {
      up: hud.querySelector('.eyenav-arrow-up'),
      down: hud.querySelector('.eyenav-arrow-down'),
      left: hud.querySelector('.eyenav-arrow-left'),
      right: hud.querySelector('.eyenav-arrow-right')
    };
    hud.querySelector('.eyenav-stop').addEventListener('click', stop);

    var banner = el('div', 'eyenav-banner eyenav-hidden');
    document.body.appendChild(banner);
    ui.banner = banner;
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    n.className = cls;
    if (html) n.innerHTML = html;
    return n;
  }

  function showIntro() { ui.overlay.classList.remove('eyenav-hidden'); }
  function hideIntro() { ui.overlay.classList.add('eyenav-hidden'); }

  function setStatus(text, tone) {
    ui.status.textContent = text;
    ui.status.className = 'eyenav-status' + (tone ? ' eyenav-status-' + tone : '');
  }

  function flashBanner(text) {
    ui.banner.textContent = text;
    ui.banner.classList.remove('eyenav-hidden');
    clearTimeout(ui.bannerTimer);
    ui.bannerTimer = setTimeout(function () {
      ui.banner.classList.add('eyenav-hidden');
    }, 1600);
  }

  /* --------------------------------------------------------- lifecycle -- */

  async function start() {
    hideIntro();
    ui.launch.classList.add('eyenav-hidden');
    ui.hud.classList.remove('eyenav-hidden');
    setStatus('Requesting camera…');

    try {
      // The ONLY permission this feature asks for: the camera.
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      });
    } catch (err) {
      setStatus('Camera access denied', 'err');
      console.error('EyeNav: camera denied', err);
      setTimeout(stop, 2500);
      return;
    }

    ui.video.srcObject = state.stream;
    setStatus('Loading gaze model…');

    try {
      var vision = await import(CDN + '/vision_bundle.mjs');
      var fileset = await vision.FilesetResolver.forVisionTasks(CDN + '/wasm');
      state.landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
        numFaces: 1
      });
    } catch (err) {
      setStatus('Model failed to load', 'err');
      console.error('EyeNav: model load failed', err);
      setTimeout(stop, 2500);
      return;
    }

    await ui.video.play().catch(function () {});
    state.running = true;
    state.paused = false;
    sessionStorage.setItem('eyenav-active', '1');
    setStatus('Eye control active', 'ok');
    flashBanner('Eye navigation on — look around to move');
    loop();
  }

  function stop() {
    state.running = false;
    sessionStorage.removeItem('eyenav-active');
    if (state.raf) cancelAnimationFrame(state.raf);
    if (state.stream) {
      state.stream.getTracks().forEach(function (t) { t.stop(); });
      state.stream = null;
    }
    if (state.landmarker) {
      state.landmarker.close();
      state.landmarker = null;
    }
    ui.hud.classList.add('eyenav-hidden');
    ui.launch.classList.remove('eyenav-hidden');
  }

  /* -------------------------------------------------------- gaze logic -- */

  function loop() {
    if (!state.running) return;
    state.raf = requestAnimationFrame(loop);

    var video = ui.video;
    if (video.readyState < 2 || video.currentTime === state.lastVideoTime) return;
    state.lastVideoTime = video.currentTime;

    var result = state.landmarker.detectForVideo(video, performance.now());
    var shapes = result.faceBlendshapes && result.faceBlendshapes[0];
    if (!shapes) {
      setStatus('Face not found — center yourself', 'warn');
      decayGaze();
      render();
      return;
    }

    var s = {};
    shapes.categories.forEach(function (c) { s[c.categoryName] = c.score; });

    // Average both eyes for each direction. Horizontal directions are from
    // the user's point of view: looking left = left eye out + right eye in.
    smooth('up', avg(s.eyeLookUpLeft, s.eyeLookUpRight));
    smooth('down', avg(s.eyeLookDownLeft, s.eyeLookDownRight));
    smooth('left', avg(s.eyeLookOutLeft, s.eyeLookInRight));
    smooth('right', avg(s.eyeLookInLeft, s.eyeLookOutRight));
    smooth('blink', avg(s.eyeBlinkLeft, s.eyeBlinkRight));

    handleBlink();
    if (!state.paused) {
      handleScroll();
      handlePageNav();
    }
    render();
  }

  function avg(a, b) { return ((a || 0) + (b || 0)) / 2; }

  function smooth(key, value) {
    state.gaze[key] += CFG.smoothing * (value - state.gaze[key]);
  }

  function decayGaze() {
    for (var k in state.gaze) state.gaze[k] *= 0.9;
    state.navHoldDir = null;
  }

  function handleBlink() {
    var closed = state.gaze.blink > CFG.blinkThreshold;
    var now = performance.now();
    if (closed && !state.blinkStart) {
      state.blinkStart = now;
    } else if (closed && now - state.blinkStart > CFG.longBlinkMs) {
      state.blinkStart = 0;
      state.paused = !state.paused;
      setStatus(state.paused ? 'Paused — long blink to resume' : 'Eye control active',
        state.paused ? 'warn' : 'ok');
      flashBanner(state.paused ? 'Eye control paused' : 'Eye control resumed');
    } else if (!closed) {
      state.blinkStart = 0;
    }
  }

  function handleScroll() {
    // Ignore vertical gaze while eyes are mostly closed (blinks read as "down").
    if (state.gaze.blink > 0.35) return;

    var down = state.gaze.down - CFG.scrollThreshold;
    var up = state.gaze.up - CFG.scrollThreshold;
    if (down > 0) {
      window.scrollBy(0, speedFor(down));
    } else if (up > 0) {
      window.scrollBy(0, -speedFor(up));
    }
  }

  function speedFor(excess) {
    // Map gaze deflection beyond the threshold onto a gentle speed curve.
    var t = Math.min(excess / (1 - CFG.scrollThreshold), 1);
    return Math.max(2, t * CFG.maxScrollSpeed);
  }

  function handlePageNav() {
    var dir = null;
    if (state.gaze.left > CFG.navThreshold && state.gaze.left > state.gaze.right) dir = 'left';
    else if (state.gaze.right > CFG.navThreshold) dir = 'right';

    var now = performance.now();
    if (!dir) {
      state.navHoldDir = null;
      return;
    }
    if (dir !== state.navHoldDir) {
      state.navHoldDir = dir;
      state.navHoldStart = now;
      return;
    }
    if (now - state.navHoldStart >= CFG.navHoldMs) {
      state.navHoldDir = null;
      navigate(dir === 'left' ? -1 : 1);
    }
  }

  function navigate(step) {
    var idx = PAGES.indexOf(location.pathname.replace(/\/+$/, '') || '/');
    if (idx === -1) idx = 0;
    var next = (idx + step + PAGES.length) % PAGES.length;
    flashBanner('Going to ' + PAGE_NAMES[next] + '…');
    setStatus('Navigating…');
    state.running = false; // freeze control during page change
    setTimeout(function () { location.href = PAGES[next]; }, 400);
  }

  /* ------------------------------------------------------------ render -- */

  function render() {
    var g = state.gaze;
    toggleArrow('up', !state.paused && g.up > CFG.scrollThreshold);
    toggleArrow('down', !state.paused && g.down > CFG.scrollThreshold);
    toggleArrow('left', !state.paused && g.left > CFG.navThreshold);
    toggleArrow('right', !state.paused && g.right > CFG.navThreshold);

    // Progress ring while a left/right page switch is arming.
    var progress = 0;
    if (state.navHoldDir && !state.paused) {
      progress = Math.min((performance.now() - state.navHoldStart) / CFG.navHoldMs, 1);
    }
    var circumference = 2 * Math.PI * 16;
    ui.ring.style.strokeDasharray = circumference;
    ui.ring.style.strokeDashoffset = circumference * (1 - progress);
    ui.ring.style.opacity = progress > 0 ? 1 : 0;
  }

  function toggleArrow(dir, on) {
    ui.arrows[dir].classList.toggle('eyenav-arrow-active', !!on);
  }

  /* -------------------------------------------------------------- init -- */

  function init() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    buildUI();
    // If eye navigation was active and we arrived here via an eye gesture,
    // resume automatically so the whole site stays hands-free.
    if (sessionStorage.getItem('eyenav-active') === '1') start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
