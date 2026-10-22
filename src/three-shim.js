// Centralized Three.js shim. The module is vendored at src/vendor/three.module.js
// (pinned r159) so the game never executes third-party CDN code. To upgrade,
// download the new build into src/vendor/ and update this file deliberately.
export * from './vendor/three.module.js';
