(() => {
  'use strict';
  const audio = document.getElementById('ambienceAudio');
  const toggle = document.getElementById('ambienceToggle');
  const slider = document.getElementById('ambienceVolume');
  const status = document.getElementById('ambienceStatus');
  let pending = false, request = 0;
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
    toggle.title = on || pending ? 'Pause ambient sound' : 'Play ambient sound';
    document.getElementById('ambienceIcon').textContent = on || pending ? 'Ⅱ' : '▶';
    document.getElementById('ambienceState').textContent = pending ? 'Loading' : on ? 'On' : 'Off';
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
      status.textContent = 'Ambient audio playing on a loop.';
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
    pending = false;
    status.textContent = 'Ambient audio playing on a loop.';
    updateToggle();
  });
  audio.addEventListener('pause', () => {
    pending = false;
    status.textContent = 'Ambient audio paused.';
    updateToggle();
  });
  audio.addEventListener('error', () => {
    pending = false;
    audio.pause();
    status.textContent = 'Audio could not load. Please refresh the page and try again.';
    updateToggle();
  });
  slider.addEventListener('input', updateVolume);
  window.addEventListener('pagehide', () => {
    request++;
    pending = false;
    audio.pause();
  });
  updateVolume();
  updateToggle();
})();
