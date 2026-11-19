(() => {
  'use strict';
  const audio = document.getElementById('ambienceAudio');
  const toggle = document.getElementById('ambienceToggle');
  const slider = document.getElementById('ambienceVolume');
  const status = document.getElementById('ambienceStatus');
  const SESSION_DURATION_MS = 15 * 60 * 1000;
  let pending = false, request = 0;
  let playedMs = 0, playStartedAt = 0, stopTimeout = 0, stoppedAtLimit = false;
  try {
    const saved = localStorage.getItem('frankenstein-ambience-volume');
    if (saved !== null && Number.isFinite(Number(saved))) slider.value = String(Math.max(0, Math.min(100, Number(saved))));
  } catch {}
  function updateVolume() {
    audio.volume = Number(slider.value) / 100;
    slider.setAttribute('aria-valuetext', slider.value + '%');
    try { localStorage.setItem('frankenstein-ambience-volume', slider.value); } catch {}
  }
  function updateToggle() {
    const on = !audio.paused;
    toggle.setAttribute('aria-pressed', String(on));
    toggle.setAttribute('aria-label', (on || pending ? 'Pause' : 'Play') + ' ambient audio');
    toggle.title = on || pending ? 'Pause ambient sound (15-minute session)' : 'Play ambient sound (15-minute session)';
    document.getElementById('ambienceIcon').textContent = on || pending ? 'Ⅱ' : '▶';
    document.getElementById('ambienceState').textContent = pending ? 'Loading' : on ? 'On' : 'Off';
  }
  function pausePlaybackClock() {
    if (playStartedAt) {
      playedMs = Math.min(SESSION_DURATION_MS, playedMs + Date.now() - playStartedAt);
      playStartedAt = 0;
    }
    clearTimeout(stopTimeout);
    stopTimeout = 0;
  }
  function startPlaybackClock() {
    if (playStartedAt || audio.paused) return;
    const remainingMs = SESSION_DURATION_MS - playedMs;
    if (remainingMs <= 0) return stopAtLimit();
    playStartedAt = Date.now();
    stopTimeout = setTimeout(stopAtLimit, remainingMs);
  }
  function stopAtLimit() {
    clearTimeout(stopTimeout);
    stopTimeout = 0;
    playedMs = SESSION_DURATION_MS;
    playStartedAt = 0;
    stoppedAtLimit = true;
    audio.pause();
    audio.currentTime = 0;
    playedMs = 0;
    status.textContent = 'Ambient audio stopped after 15 minutes.';
    updateToggle();
  }
  toggle.addEventListener('click', async () => {
    if (!audio.paused || pending) {
      request++;
      pending = false;
      audio.pause();
      status.textContent = 'Ambient audio paused.';
      updateToggle();
      return;
    }
    const currentRequest = ++request;
    pending = true;
    status.textContent = 'Loading ambient audio…';
    updateToggle();
    try {
      await audio.play();
      if (request !== currentRequest) return;
      pending = false;
      status.textContent = 'Ambient audio playing; it will stop after 15 minutes.';
      updateToggle();
    } catch (error) {
      if (request !== currentRequest) return;
      pending = false;
      status.textContent = error.name === 'NotAllowedError'
        ? 'Tap the sound button again to start the audio.'
        : 'Audio could not load. Please check your connection and try again.';
      updateToggle();
    }
  });
  audio.addEventListener('playing', () => {
    startPlaybackClock();
    pending = false;
    status.textContent = 'Ambient audio playing; it will stop after 15 minutes.';
    updateToggle();
  });
  audio.addEventListener('pause', () => {
    pending = false;
    if (stoppedAtLimit) stoppedAtLimit = false;
    else {
      pausePlaybackClock();
      status.textContent = 'Ambient audio paused.';
    }
    updateToggle();
  });
  audio.addEventListener('error', () => {
    pending = false;
    pausePlaybackClock();
    stoppedAtLimit = true;
    audio.pause();
    status.textContent = 'Audio could not load. Please refresh the page and try again.';
    updateToggle();
  });
  slider.addEventListener('input', updateVolume);
  window.addEventListener('pagehide', () => {
    request++;
    pending = false;
    pausePlaybackClock();
    audio.pause();
  });
  updateVolume();
  updateToggle();
})();
