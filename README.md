AimLabs — lightweight browser aim trainer

Quick start

Serve locally (recommended) and open http://localhost:8001

```bash
cd learning/project/aimlabs
python3 -m http.server 8001
# open http://localhost:8001 in your browser
```

Notes
- External libraries (Three.js) are imported via `src/three-shim.js` which currently points to the unpkg CDN. To use a local copy, place `three.module.js` next to `src/three-shim.js` and change the export line.
- Audio uses a lightweight WebAudio fallback; add real audio files under `assets/sounds/` and restore Howler usage if desired.
- UI uses plain DOM and CSS; `src/ui/Settings.js` and `src/ui/Stats.js` are minimal placeholders to be extended.

Development
- The project is modular ES modules — run via an HTTP server (browsers block module imports from file://).
- To add more modes, add files under `src/modes/` and register them in `src/core/Game.js`.
