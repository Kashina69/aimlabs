import { StaticMode } from '../modes/StaticMode.js';

const MODE_IMPORTS = [
  { label: 'Flick', path: '../modes/FlickMode.js', exportName: 'FlickMode' },
  { label: 'Click Track', path: '../modes/ClickTrackMode.js', exportName: 'ClickTrackMode' },
  { label: 'Hold Track', path: '../modes/HoldTrackMode.js', exportName: 'HoldTrackMode' },
  { label: 'Reaction', path: '../modes/ReactionMode.js', exportName: 'ReactionMode' }
];

export async function loadSelectableModes() {
  const modes = { Static: StaticMode };

  await Promise.all(
    MODE_IMPORTS.map(async ({ label, path, exportName }) => {
      try {
        const module = await import(path);
        if (module?.[exportName]) {
          modes[label] = module[exportName];
        }
      } catch (error) {
        console.warn('Mode import failed', path, error);
      }
    })
  );

  return modes;
}
