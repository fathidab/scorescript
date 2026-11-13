# ScoreScript

A static sight-reading studio and key transposer. Built with HTML, CSS, vanilla JavaScript, VexFlow 4.2.3, and the native Web Audio API with recorded grand piano samples. No build step, package installation, local audio files, or backend.

## Run Locally

Open `index.html` directly in a current Chrome, Edge, Firefox, or Safari browser. An internet connection is required to load VexFlow from jsDelivr and piano recordings from Tone.js's audio hosting. Fonts and Lucide icons are also CDN-hosted; system font fallbacks are provided.

Choose a clef and key, then generate an eight-quarter-note exercise in 4/4. Changing the key transposes the existing melody by preserving its scale degrees; changing clef shifts it between treble and bass octave ranges. C Minor uses the natural minor scale. Solfege is movable-do, with the requested Do/Re/Mi/Fa/Sol/La/Si labels in both modes.

Play the melody at 40-160 BPM, or click piano keys to match each successive note. Blue indicates playback, green indicates a correct pitch, and red indicates a mismatch. Matching requires the exact octave. Reset practice to retry the same exercise; New exercise creates another melody. Playback does not affect practice accuracy. Tempo changes are disabled during playback.

Audio starts only after a user interaction, as required by browsers. The two-octave piano is C4-B5 in treble and C2-B3 in bass. Computer keyboard shortcuts, from lowest to highest pitch: `A W S E D F T G Y H U J K O L P ; ' ] \ Z X C V`. They are ignored while a form control or button has focus; piano buttons also work with Tab and Enter/Space. Hover a key to see its pitch and shortcut.

## Piano Sound

Both the keyboard and melody use actual grand piano recordings, not synthesized oscillator tones. Samples are fetched on first audio interaction and cached as decoded audio buffers for the session. The first note may take a moment to load. Melody playback waits for all required samples before scheduling audio and synchronized highlights. Failed downloads display a retryable error.

Samples are recorded every three semitones; intervening pitches use the nearest recording, shifted by at most one semitone through Web Audio playback rate. Short gain envelopes preserve the piano attack and add a smooth release. No audio library or extra deployment files are needed.

Piano recordings: **Salamander Grand Piano v3**, by **Alexander Holm**, licensed under [Creative Commons Attribution 3.0 Unported](https://creativecommons.org/licenses/by/3.0/). [Original collection and license](https://github.com/sfzinstruments/SalamanderGrandPiano). MP3 samples are served from [Tone.js's audio collection](https://github.com/Tonejs/audio/tree/master/salamander) at `https://tonejs.github.io/audio/salamander/`. Playback applies pitch shifting and volume/release envelopes; the hosted recording files are not modified.

## GitHub Pages

1. Create a GitHub repository and upload `index.html`, `style.css`, `app.js`, and `README.md` to its root.
2. Open **Settings > Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Select your branch (usually `main`) and **/ (root)**, then save.
5. After deployment, visit `https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/`.

All local assets use relative paths, so repository subpaths work without configuration. VexFlow is loaded from `https://cdn.jsdelivr.net/npm/vexflow@4.2.3/build/cjs/vexflow.js`. No GitHub Actions workflow or build command is needed.

## Files

- `index.html`: accessible application structure and CDN imports.
- `style.css`: responsive dark workspace, light notation sheet, and piano states.
- `app.js`: scale spelling, transposition, VexFlow rendering, audio scheduling, and practice feedback.
- `README.md`: usage and deployment instructions.

Random exercises are diatonic, limited to the tonic octave, and finish on the tonic. The score wraps to two staff systems on smaller screens. Playback is cancelled when changing an exercise, key, or clef, resetting practice, or hiding the browser tab.