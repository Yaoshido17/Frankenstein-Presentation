(() => {
  'use strict';
  const toggle = document.getElementById('ambienceToggle');
  const slider = document.getElementById('ambienceVolume');
  const status = document.getElementById('ambienceStatus');
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  let context, master, rainBuffer, thunderBuffer, rainSource;
  let active = false, thunderTimer;
  const thunderVoices = new Set();
  if (!AudioEngine) {
    toggle.disabled = true;
    toggle.title = 'Ambient audio is unavailable in this browser.';
    return;
  }
  try {
    const saved = localStorage.getItem('frankenstein-ambience-volume');
    if (saved !== null && Number.isFinite(Number(saved))) slider.value = String(Math.max(0, Math.min(100, Number(saved))));
  } catch {}
  const volume = () => Number(slider.value) / 100;
  function updateVolume() {
    slider.setAttribute('aria-valuetext', slider.value + '%');
    if (master && active) master.gain.setTargetAtTime(volume(), context.currentTime, 0.15);
    try { localStorage.setItem('frankenstein-ambience-volume', slider.value); } catch {}
  }
  function makeNoise(seconds, brownOnly) {
    const buffer = context.createBuffer(2, Math.ceil(context.sampleRate * seconds), context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let brown = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        brown = (brown + 0.02 * white) / 1.02;
        data[i] = brownOnly ? brown * 3.5 : white * 0.55 + brown * 1.5;
      }
    }
    return buffer;
  }
  function initialize() {
    context = new AudioEngine();
    master = context.createGain();
    master.gain.value = 0;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 12;
    limiter.ratio.value = 6;
    master.connect(limiter);
    limiter.connect(context.destination);
    rainBuffer = makeNoise(12, false);
    thunderBuffer = makeNoise(9, true);
  }
  function startRain() {
    rainSource = context.createBufferSource();
    rainSource.buffer = rainBuffer;
    rainSource.loop = true;
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 180;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 4200;
    lowpass.Q.value = 0.3;
    const rainLevel = context.createGain();
    rainLevel.gain.value = 0.65;
    rainSource.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(rainLevel);
    rainLevel.connect(master);
    rainSource.onended = () => {
      highpass.disconnect();
      lowpass.disconnect();
      rainLevel.disconnect();
    };
    rainSource.start();
  }
  function scheduleThunder(first) {
    clearTimeout(thunderTimer);
    thunderTimer = setTimeout(() => {
      if (!active || context.state !== 'running') {
        if (active) scheduleThunder(false);
        return;
      }
      const source = context.createBufferSource();
      source.buffer = thunderBuffer;
      source.playbackRate.value = 0.8 + Math.random() * 0.2;
      const lowpass = context.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 150 + Math.random() * 100;
      lowpass.Q.value = 0.4;
      const highpass = context.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 28;
      const envelope = context.createGain();
      const now = context.currentTime;
      const strength = 0.65 + Math.random() * 0.25;
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(strength, now + 0.7);
      envelope.gain.exponentialRampToValueAtTime(strength * 0.45, now + 1.5);
      envelope.gain.exponentialRampToValueAtTime(strength * 0.7, now + 2.2);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + 8);
      source.connect(lowpass);
      lowpass.connect(highpass);
      highpass.connect(envelope);
      envelope.connect(master);
      thunderVoices.add(source);
      source.onended = () => {
        thunderVoices.delete(source);
        lowpass.disconnect();
        highpass.disconnect();
        envelope.disconnect();
      };
      source.start();
      source.stop(now + 8.1);
      scheduleThunder(false);
    }, (first ? 8 + Math.random() * 7 : 20 + Math.random() * 20) * 1000);
  }
  function updateToggle() {
    toggle.setAttribute('aria-pressed', String(active));
    toggle.setAttribute('aria-label', (active ? 'Pause' : 'Play') + ' rain and distant thunder');
    toggle.title = active ? 'Pause ambient sound' : 'Play rain and distant thunder';
    document.getElementById('ambienceIcon').textContent = active ? 'Ⅱ' : '▶';
    document.getElementById('ambienceState').textContent = active ? 'On' : 'Off';
  }
  function stop() {
    active = false;
    clearTimeout(thunderTimer);
    if (context && master) {
      const end = context.currentTime + 0.35;
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(0, context.currentTime, 0.06);
      if (rainSource) { rainSource.stop(end); rainSource = null; }
      for (const source of thunderVoices) source.stop(end);
    }
    updateToggle();
  }
  toggle.addEventListener('click', async () => {
    if (active) { stop(); status.textContent = 'Ambient sound paused.'; return; }
    toggle.disabled = true;
    try {
      if (!context || context.state === 'closed') initialize();
      await context.resume();
      if (context.state !== 'running') throw new Error('Audio did not start');
      active = true;
      startRain();
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(volume(), context.currentTime, 0.6);
      scheduleThunder(true);
      status.textContent = 'Rain and distant thunder playing.';
      updateToggle();
    } catch {
      stop();
      status.textContent = 'Audio could not start. Please tap the sound button again.';
    } finally { toggle.disabled = false; }
  });
  slider.addEventListener('input', updateVolume);
  window.addEventListener('pagehide', () => {
    stop();
    if (context && context.state !== 'closed') context.close().catch(() => {});
  });
  updateVolume();
  updateToggle();
})();
