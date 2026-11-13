'use strict';

(() => {
  // Written scale spellings are kept separate from MIDI pitches for correct key signatures.
  const KEYS = {
    C: { name: 'C Major', notes: ['c', 'd', 'e', 'f', 'g', 'a', 'b'] },
    G: { name: 'G Major', notes: ['g', 'a', 'b', 'c', 'd', 'e', 'f#'] },
    F: { name: 'F Major', notes: ['f', 'g', 'a', 'bb', 'c', 'd', 'e'] },
    D: { name: 'D Major', notes: ['d', 'e', 'f#', 'g', 'a', 'b', 'c#'] },
    Bb: { name: 'Bb Major', notes: ['bb', 'c', 'd', 'eb', 'f', 'g', 'a'] },
    Eb: { name: 'Eb Major', notes: ['eb', 'f', 'g', 'ab', 'bb', 'c', 'd'] },
    Cm: { name: 'C Minor', notes: ['c', 'd', 'eb', 'f', 'g', 'ab', 'bb'] },
  };
  const PITCH_CLASSES = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  const SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
  const PIANO_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const SAMPLE_NAMES = { 0: 'C', 3: 'Ds', 6: 'Fs', 9: 'A' };
  const SAMPLE_BASE = 'https://tonejs.github.io/audio/salamander/';
  const COMPUTER_KEYS = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p', ';', "'", ']', '\\', 'z', 'x', 'c', 'v'];
  const elements = Object.fromEntries(['score', 'key-select', 'solfege', 'generate', 'play', 'tempo', 'tempo-value', 'piano', 'piano-range', 'score-title', 'score-caption', 'sheet-count', 'exercise-number', 'progress-label', 'progress-dots', 'status', 'accuracy', 'reset'].map(id => [id, document.getElementById(id)]));
  const state = { key: 'C', clef: 'treble', degrees: [], melody: [], exercise: 0, next: 0, attempts: 0, correct: 0, wrong: -1, active: -1, playing: false };
  const audio = { context: null, samples: new Map(), voices: new Set(), timers: new Set(), generation: 0 };
  const pressedKeys = new Set();
  const keyTimers = new Map();
  let feedbackTimer;
  let resizeFrame;
  let notationAvailable = Boolean(window.Vex && window.Vex.Flow);

  function icons() { if (window.lucide) window.lucide.createIcons(); }
  function setStatus(message, tone = '') { elements.status.textContent = message; elements.status.dataset.tone = tone; }
  function baseOctave() { return state.clef === 'treble' ? 4 : 2; }
  function pitchClass(spelling) { return PITCH_CLASSES[spelling[0]] + (spelling.includes('#') ? 1 : spelling.length > 1 ? -1 : 0); }

  function buildMelody() {
    const scale = KEYS[state.key].notes;
    const tonic = pitchClass(scale[0]);
    state.melody = state.degrees.map(degree => {
      const spelling = scale[degree % 7];
      const octave = baseOctave() + (pitchClass(spelling) < tonic ? 1 : 0) + Math.floor(degree / 7);
      return { spelling, octave, midi: (octave + 1) * 12 + pitchClass(spelling), solfege: SOLFEGE[degree % 7] };
    });
  }

  function renderScore() {
    if (!notationAvailable) return;
    const VF = window.Vex.Flow;
    const width = Math.max(250, Math.floor(elements.score.clientWidth));
    const stacked = width < 620;
    const height = stacked ? 370 : 220;
    elements.score.replaceChildren();
    const renderer = new VF.Renderer(elements.score, VF.Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();
    context.setFillStyle('#282c29').setStrokeStyle('#282c29');
    const firstExtra = 100 + (state.key === 'C' ? 0 : 30);
    const firstWidth = stacked ? width - 12 : (width - 12 + firstExtra) / 2;
    for (let bar = 0; bar < 2; bar++) {
      const x = stacked || bar === 0 ? 6 : 6 + firstWidth;
      const y = stacked && bar === 1 ? 195 : 35;
      const barWidth = stacked ? width - 12 : bar === 0 ? firstWidth : width - 12 - firstWidth;
      const stave = new VF.Stave(x, y, barWidth);
      if (bar === 0 || stacked) stave.addClef(state.clef).addKeySignature(state.key);
      if (bar === 0) stave.addTimeSignature('4/4');
      if (bar === 1) stave.setEndBarType(VF.Barline.type.END);
      stave.setContext(context).draw();
      const notes = state.melody.slice(bar * 4, bar * 4 + 4).map((pitch, offset) => {
        const index = bar * 4 + offset;
        const note = new VF.StaveNote({ clef: state.clef, keys: [`${pitch.spelling}/${pitch.octave}`], duration: 'q', auto_stem: true });
        const color = index === state.active ? '#417cbe' : index === state.wrong ? '#cf4545' : index < state.next ? '#21834f' : '#282c29';
        note.setStyle({ fillStyle: color, strokeStyle: color });
        return note;
      });
      const voice = new VF.Voice({ num_beats: 4, beat_value: 4 }).addTickables(notes);
      new VF.Formatter().joinVoices([voice]).formatToStave([voice], stave, { padding: 14 });
      voice.draw(context, stave);
      // Labels use formatted note coordinates, so they remain aligned after responsive layout.
      if (elements.solfege.checked) notes.forEach((note, offset) => {
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', note.getAbsoluteX() + 6);
        label.setAttribute('y', y + 137);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('class', 'solfege-note');
        label.textContent = state.melody[bar * 4 + offset].solfege;
        elements.score.querySelector('svg').append(label);
      });
    }
    elements.score.setAttribute('aria-label', `${KEYS[state.key].name}, ${state.clef} clef, 4/4 time: ${state.melody.map(note => `${note.spelling[0].toUpperCase()}${note.spelling.slice(1)}${note.octave}`).join(', ')}`);
  }

  function renderPiano() {
    elements.piano.replaceChildren();
    const firstMidi = (baseOctave() + 1) * 12;
    let whiteIndex = 0;
    for (let offset = 0; offset < 24; offset++) {
      const midi = firstMidi + offset;
      const name = `${PIANO_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
      const black = PIANO_NAMES[midi % 12].includes('#');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `piano-key ${black ? 'black-key' : 'white-key'}`;
      button.dataset.midi = midi;
      button.textContent = name;
      button.setAttribute('aria-label', `Play ${name}`);
      button.title = `${name} (${COMPUTER_KEYS[offset].toUpperCase()})`;
      if (black) button.style.left = `calc(${whiteIndex / 14 * 100}% - 2.15%)`;
      else whiteIndex++;
      button.addEventListener('click', () => practicePitch(midi));
      elements.piano.append(button);
    }
    elements['piano-range'].textContent = `C${baseOctave()} - B${baseOctave() + 1}`;
  }

  function updateProgress() {
    elements['progress-label'].textContent = `${state.next} of 8 notes`;
    elements['progress-dots'].replaceChildren(...Array.from({ length: 8 }, (_, index) => {
      const dot = document.createElement('span');
      dot.className = `progress-dot${index < state.next ? ' done' : ''}`;
      return dot;
    }));
    elements['sheet-count'].textContent = `${String(Math.min(state.next + 1, 8)).padStart(2, '0')} / 08`;
    elements.accuracy.innerHTML = `Accuracy <strong>${state.attempts ? Math.round(state.correct / state.attempts * 100) + '%' : '--'}</strong>`;
  }

  function resetPractice() {
    clearTimeout(feedbackTimer);
    state.next = 0;
    state.attempts = 0;
    state.correct = 0;
    state.wrong = -1;
    updateProgress();
    renderScore();
    setStatus('Ready when you are.');
  }

  function refreshExercise() {
    stopPlayback();
    buildMelody();
    elements['score-title'].innerHTML = `${KEYS[state.key].name} <span>/</span> ${state.clef === 'treble' ? 'Treble' : 'Bass'} clef`;
    renderPiano();
    resetPractice();
  }

  function generateExercise() {
    // A bounded diatonic walk makes the exercise readable while avoiding repeated-note runs.
    let degree = Math.floor(Math.random() * 5);
    state.degrees = Array.from({ length: 8 }, (_, index) => {
      if (index === 7) return 0;
      if (index > 0) {
        const options = [-2, -1, 1, 2].map(step => degree + step).filter(value => value >= 0 && value <= 7);
        degree = options[Math.floor(Math.random() * options.length)];
      }
      return degree;
    });
    state.exercise++;
    elements['exercise-number'].textContent = String(state.exercise).padStart(3, '0');
    refreshExercise();
  }

  async function getAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Web Audio is unavailable in this browser.');
    if (!audio.context) audio.context = new AudioContextClass();
    if (audio.context.state === 'suspended') await audio.context.resume();
    if (audio.context.state !== 'running') throw new Error('Audio is blocked. Please enable sound in your browser.');
    const firstMidi = (baseOctave() + 1) * 12;
    for (let offset = 0; offset <= 24; offset += 3) loadPianoSample(audio.context, firstMidi + offset).catch(() => {});
    return audio.context;
  }

  function sampleMidi(midi) { return Math.round(midi / 3) * 3; }

  function loadPianoSample(context, midi) {
    const recordedMidi = sampleMidi(midi);
    if (!audio.samples.has(recordedMidi)) {
      const name = `${SAMPLE_NAMES[recordedMidi % 12]}${Math.floor(recordedMidi / 12) - 1}`;
      const loading = fetch(`${SAMPLE_BASE}${name}.mp3`, { signal: AbortSignal.timeout(15000) })
        .then(response => {
          if (!response.ok) throw new Error(`Sample HTTP ${response.status}`);
          return response.arrayBuffer();
        })
        .then(data => context.decodeAudioData(data))
        .catch(() => {
          audio.samples.delete(recordedMidi);
          throw new Error('Piano recordings could not load. Check your connection and try again.');
        });
      audio.samples.set(recordedMidi, loading);
    }
    return audio.samples.get(recordedMidi);
  }

  function soundPitch(context, midi, buffer, start, duration) {
    const source = context.createBufferSource();
    const envelope = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = 2 ** ((midi - sampleMidi(midi)) / 12);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(0.7, start + 0.005);
    envelope.gain.setValueAtTime(0.7, start + duration);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + duration + 0.22);
    envelope.gain.linearRampToValueAtTime(0, start + duration + 0.25);
    source.connect(envelope);
    envelope.connect(context.destination);
    audio.voices.add(source);
    source.onended = () => { audio.voices.delete(source); source.disconnect(); envelope.disconnect(); };
    source.start(start);
    source.stop(start + duration + 0.26);
  }

  function flashKey(midi, className, duration = 350) {
    const key = elements.piano.querySelector(`[data-midi="${midi}"]`);
    if (!key) return;
    clearTimeout(keyTimers.get(midi));
    key.classList.remove('is-active', 'is-correct', 'is-wrong');
    key.classList.add(className);
    keyTimers.set(midi, setTimeout(() => { key.classList.remove(className); keyTimers.delete(midi); }, duration));
  }

  function setPlaybackButton() {
    elements.play.innerHTML = state.playing ? '<i data-lucide="square"></i><span>Stop melody</span>' : '<i data-lucide="play"></i><span>Play melody</span>';
    elements.play.setAttribute('aria-pressed', String(state.playing));
    elements.tempo.disabled = state.playing;
    icons();
  }

  function stopPlayback() {
    audio.generation++;
    audio.timers.forEach(timer => clearTimeout(timer));
    audio.timers.clear();
    audio.voices.forEach(voice => { try { voice.stop(); } catch (_) { /* Already-ended voices need no action. */ } });
    keyTimers.forEach(timer => clearTimeout(timer));
    keyTimers.clear();
    elements.piano.querySelectorAll('.is-active, .is-correct, .is-wrong').forEach(key => key.classList.remove('is-active', 'is-correct', 'is-wrong'));
    state.playing = false;
    state.active = -1;
    setPlaybackButton();
    updateProgress();
  }

  function schedule(callback, delay) {
    const timer = setTimeout(() => { audio.timers.delete(timer); callback(); }, delay);
    audio.timers.add(timer);
  }

  async function playMelody() {
    if (state.playing) { stopPlayback(); renderScore(); setStatus('Playback stopped.'); return; }
    const generation = ++audio.generation;
    state.playing = true;
    setPlaybackButton();
    try {
      setStatus('Loading piano recordings...');
      const context = await getAudioContext();
      if (generation !== audio.generation) return;
      const buffers = await Promise.all(state.melody.map(note => loadPianoSample(context, note.midi)));
      if (generation !== audio.generation) return;
      const beat = 60 / Number(elements.tempo.value);
      const start = context.currentTime + 0.08;
      setStatus('Listening to the melody.');
      state.melody.forEach((note, index) => {
        soundPitch(context, note.midi, buffers[index], start + index * beat, beat * 0.85);
        schedule(() => {
          state.active = index;
          elements['sheet-count'].textContent = `${String(index + 1).padStart(2, '0')} / 08`;
          renderScore();
          flashKey(note.midi, 'is-active', beat * 850);
        }, (start - context.currentTime + index * beat) * 1000);
      });
      schedule(() => { stopPlayback(); updateProgress(); renderScore(); setStatus('Your turn.'); }, (start - context.currentTime + 8 * beat + 0.25) * 1000);
    } catch (error) {
      if (generation !== audio.generation) return;
      stopPlayback(); renderScore(); setStatus(error.message, 'error');
    }
  }

  async function practicePitch(midi) {
    const generation = audio.generation;
    try {
      const context = await getAudioContext();
      if (generation !== audio.generation) return;
      const buffer = await loadPianoSample(context, midi);
      if (generation !== audio.generation) return;
      soundPitch(context, midi, buffer, context.currentTime, 1.2);
    } catch (error) {
      if (generation === audio.generation) setStatus(error.message, 'error');
      return;
    }
    if (state.playing || state.next === 8) { flashKey(midi, 'is-active'); return; }
    clearTimeout(feedbackTimer);
    state.attempts++;
    if (midi === state.melody[state.next].midi) {
      state.correct++;
      state.next++;
      state.wrong = -1;
      flashKey(midi, 'is-correct');
      setStatus(state.next === 8 ? 'Exercise complete. Nicely played.' : 'Right note. Keep going.', 'success');
    } else {
      state.wrong = state.next;
      flashKey(midi, 'is-wrong');
      setStatus('Not quite. Try that note again.', 'error');
      feedbackTimer = setTimeout(() => { state.wrong = -1; renderScore(); }, 650);
    }
    updateProgress();
    renderScore();
  }

  document.querySelectorAll('[data-clef]').forEach(button => button.addEventListener('click', () => {
    if (state.clef === button.dataset.clef) return;
    state.clef = button.dataset.clef;
    document.querySelectorAll('[data-clef]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    refreshExercise();
  }));
  elements['key-select'].addEventListener('change', () => { state.key = elements['key-select'].value; refreshExercise(); });
  elements.solfege.addEventListener('change', renderScore);
  elements.generate.addEventListener('click', generateExercise);
  elements.play.addEventListener('click', playMelody);
  elements.reset.addEventListener('click', () => { stopPlayback(); resetPractice(); });
  elements.tempo.addEventListener('input', () => {
    const bpm = Number(elements.tempo.value);
    elements['tempo-value'].innerHTML = `${bpm} <span>BPM</span>`;
    elements['score-caption'].textContent = bpm < 60 ? 'Largo' : bpm < 76 ? 'Adagio' : bpm < 108 ? 'Andante' : bpm < 120 ? 'Moderato' : 'Allegro';
  });
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.repeat || /INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName)) return;
    const key = event.key.toLowerCase();
    const offset = COMPUTER_KEYS.indexOf(key);
    if (offset < 0 || pressedKeys.has(key)) return;
    event.preventDefault();
    pressedKeys.add(key);
    practicePitch((baseOctave() + 1) * 12 + offset);
  });
  document.addEventListener('keyup', event => pressedKeys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => pressedKeys.clear());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopPlayback(); renderScore(); }
  });
  new ResizeObserver(() => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(renderScore); }).observe(elements.score);
  generateExercise();
  icons();
  if (!notationAvailable) {
    elements.score.textContent = 'Sheet music could not load. Check your internet connection and reload.';
    elements.play.disabled = true;
    elements.generate.disabled = true;
    setStatus('VexFlow is unavailable. An internet connection is required.', 'error');
  }
})();