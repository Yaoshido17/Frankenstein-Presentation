(() => {
  'use strict';
  const videoId = 'zbmP1JP9DNc';
  const toggle = document.getElementById('ambienceToggle');
  const slider = document.getElementById('ambienceVolume');
  const status = document.getElementById('ambienceStatus');
  const dock = document.getElementById('ambienceDock');
  const message = document.getElementById('ambienceMessage');
  let player, apiPromise, loading = false, wanted = false, active = false, ready = false;
  let requestId = 0;
  try {
    const saved = localStorage.getItem('frankenstein-ambience-volume');
    if (saved !== null && Number.isFinite(Number(saved))) slider.value = String(Math.max(0, Math.min(100, Number(saved))));
  } catch {}
  function announce(text) { message.textContent = text; status.textContent = text; }
  function updateToggle() {
    toggle.setAttribute('aria-pressed', String(active));
    toggle.setAttribute('aria-label', (wanted ? 'Pause' : 'Play') + ' YouTube rain ambience');
    toggle.title = wanted ? 'Pause ambient video' : 'Play the selected YouTube ambient video';
    document.getElementById('ambienceIcon').textContent = wanted ? 'Ⅱ' : '▶';
    document.getElementById('ambienceState').textContent = loading ? 'Loading' : active ? 'On' : 'Off';
  }
  function updateVolume() {
    slider.setAttribute('aria-valuetext', slider.value + '%');
    if (ready && player) player.setVolume(Number(slider.value));
    try { localStorage.setItem('frankenstein-ambience-volume', slider.value); } catch {}
  }
  function loadAPI() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      const tag = document.createElement('script');
      let timer;
      function fail() {
        clearTimeout(timer);
        tag.remove();
        apiPromise = null;
        reject(new Error('YouTube could not be loaded'));
      }
      window.onYouTubeIframeAPIReady = () => {
        clearTimeout(timer);
        if (typeof previous === 'function') previous();
        resolve();
      };
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = fail;
      timer = setTimeout(fail, 20000);
      document.head.appendChild(tag);
    });
    return apiPromise;
  }
  function pause(hide) {
    requestId++;
    wanted = false;
    active = false;
    loading = false;
    if (ready && player) player.pauseVideo();
    if (hide) dock.hidden = true;
    announce('Ambient video paused.');
    updateToggle();
  }
  function createPlayer() {
    player = new window.YT.Player('ambiencePlayer', {
      width: 320,
      height: 200,
      videoId,
      host: 'https://www.youtube.com',
      playerVars: {
        playsinline: 1, controls: 1, autoplay: 0, loop: 1,
        playlist: videoId, rel: 0, origin: location.origin
      },
      events: {
        onReady(event) {
          ready = true;
          loading = false;
          const iframe = event.target.getIframe();
          iframe.title = 'Rain and thunder ambience — YouTube';
          iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
          event.target.setVolume(Number(slider.value));
          if (wanted && !dock.hidden) {
            event.target.unMute();
            event.target.playVideo();
            announce('Press Play in the video if it does not start.');
          } else event.target.pauseVideo();
          updateToggle();
        },
        onStateChange(event) {
          if (event.data === 1) {
            if (dock.hidden) { event.target.pauseVideo(); return; }
            active = true; wanted = true; loading = false;
            announce('Selected YouTube ambience playing.');
          } else if (event.data === 2 || event.data === 0) {
            active = false; wanted = false; loading = false;
            announce('Ambient video paused.');
          } else if (event.data === 3) {
            active = false;
            announce('Buffering ambient video…');
          }
          updateToggle();
        },
        onAutoplayBlocked() {
          active = false; wanted = false; loading = false;
          announce('Tap Play in the YouTube player to start the sound.');
          updateToggle();
        },
        onError(event) {
          active = false; wanted = false; loading = false;
          const text = [101,150].includes(event.data)
            ? 'This video cannot play here. Open it on YouTube using the link below.'
            : event.data === 100
            ? 'This video is unavailable. Open it on YouTube using the link below.'
            : 'YouTube could not play the video here. Try Play again, or open it on YouTube.';
          announce(text);
          updateToggle();
        }
      }
    });
  }
  toggle.addEventListener('click', async () => {
    if (wanted || active || loading) { pause(true); return; }
    dock.hidden = false;
    wanted = true;
    const currentRequest = ++requestId;
    if (ready && player) {
      player.setVolume(Number(slider.value));
      player.unMute();
      player.playVideo();
      announce('Press Play in the video if it does not start.');
      updateToggle();
      return;
    }
    loading = true;
    announce('Loading your YouTube ambient video…');
    updateToggle();
    try {
      await loadAPI();
      if (currentRequest !== requestId || !wanted) return;
      if (!player) createPlayer();
    } catch {
      if (currentRequest !== requestId) return;
      wanted = false; loading = false; active = false;
      announce('YouTube could not load. Check your connection or open the video below.');
      updateToggle();
    }
  });
  document.getElementById('ambienceClose').addEventListener('click', () => {
    pause(true);
    toggle.focus();
  });
  slider.addEventListener('input', updateVolume);
  window.addEventListener('pagehide', () => pause(true));
  updateVolume();
  updateToggle();
})();
