(() => {
  'use strict';
  const toggle = document.getElementById('ambienceToggle');
  const slider = document.getElementById('ambienceVolume');
  const status = document.getElementById('ambienceStatus');
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  let context, master, windBuffer, active = false, birdTimer;
  const sources = new Set();
  if (!AudioEngine) {
    toggle.disabled = true;
    toggle.title = 'Ambient sound is unavailable in this browser.';
    return;
  }
  try {
    const saved = localStorage.getItem('frankenstein-ambience-volume');
    if (saved !== null && Number.isFinite(Number(saved))) slider.value = String(Math.max(0, Math.min(100, Number(saved))));
  } catch {}
  function updateVolume() {
    slider.setAttribute('aria-valuetext', slider.value + '%');
    if (master && active) master.gain.setTargetAtTime(Number(slider.value) / 100, context.currentTime, 0.15);
    try { localStorage.setItem('frankenstein-ambience-volume', slider.value); } catch {}
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
    windBuffer = context.createBuffer(2, context.sampleRate * 12, context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = windBuffer.getChannelData(channel);
      let brown = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        brown = (brown + 0.02 * white) / 1.02;
        data[i] = white * 0.4 + brown * 2.5;
      }
    }
  }
  function startWind() {
    const wind = context.createBufferSource();
    wind.buffer = windBuffer;
    wind.loop = true;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1050;
    lowpass.Q.value = 0.3;
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 100;
    const swell = context.createGain();
    swell.gain.value = 0.6;
    const breeze = context.createOscillator();
    breeze.frequency.value = 0.075;
    const depth = context.createGain();
    depth.gain.value = 0.18;
    breeze.connect(depth);
    depth.connect(swell.gain);
    wind.connect(lowpass);
    lowpass.connect(highpass);
    highpass.connect(swell);
    swell.connect(master);
    sources.add(wind);
    sources.add(breeze);
    wind.onended = () => {
      sources.delete(wind);
      lowpass.disconnect();
      highpass.disconnect();
      swell.disconnect();
    };
    breeze.onended = () => { sources.delete(breeze); depth.disconnect(); };
    wind.start();
    breeze.start();
  }
  function birdsong() {
    const base = 1700 + Math.random() * 900;
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const bird = context.createOscillator();
      bird.type = 'sine';
      const envelope = context.createGain();
      const flutter = context.createOscillator();
      const depth = context.createGain();
      flutter.frequency.value = 25 + Math.random() * 15;
      depth.gain.value = 40;
      flutter.connect(depth);
      depth.connect(bird.frequency);
      const start = context.currentTime + i * (0.23 + Math.random() * 0.04);
      bird.frequency.setValueAtTime(base, start);
      bird.frequency.exponentialRampToValueAtTime(base * 1.4, start + 0.065);
      bird.frequency.exponentialRampToValueAtTime(base * 1.08, start + 0.18);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(0.045, start + 0.025);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
      bird.connect(envelope);
      envelope.connect(master);
      sources.add(bird);
      sources.add(flutter);
      bird.onended = () => { sources.delete(bird); envelope.disconnect(); };
      flutter.onended = () => { sources.delete(flutter); depth.disconnect(); };
      bird.start(start);
      flutter.start(start);
      bird.stop(start + 0.22);
      flutter.stop(start + 0.22);
    }
  }
  function scheduleBirds(first) {
    clearTimeout(birdTimer);
    birdTimer = setTimeout(() => {
      if (!active) return;
      if (context.state === 'running') birdsong();
      scheduleBirds(false);
    }, (first ? 2.5 + Math.random() * 3 : 12 + Math.random() * 13) * 1000);
  }
  function updateToggle() {
    toggle.setAttribute('aria-pressed', String(active));
    toggle.setAttribute('aria-label', (active ? 'Pause' : 'Play') + ' forest wind and birds');
    toggle.title = active ? 'Pause forest ambience' : 'Play gentle forest wind and birds';
    document.getElementById('ambienceIcon').textContent = active ? 'Ⅱ' : '▶';
    document.getElementById('ambienceState').textContent = active ? 'On' : 'Off';
  }
  function stop() {
    active = false;
    clearTimeout(birdTimer);
    if (context && master) {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(0, context.currentTime, 0.06);
      for (const source of sources) source.stop(context.currentTime + 0.3);
    }
    updateToggle();
  }
  toggle.addEventListener('click', async () => {
    if (active) { stop(); status.textContent = 'Forest ambience paused.'; return; }
    toggle.disabled = true;
    try {
      if (!context || context.state === 'closed') initialize();
      await context.resume();
      if (context.state !== 'running') throw new Error('Audio did not start');
      active = true;
      startWind();
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(Number(slider.value) / 100, context.currentTime, 0.5);
      scheduleBirds(true);
      status.textContent = 'Gentle forest wind and birds playing.';
      updateToggle();
    } catch {
      stop();
      status.textContent = 'Sound could not start. Tap the forest button to try again.';
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
