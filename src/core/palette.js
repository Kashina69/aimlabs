/* Hex mirrors of the OKLCH tokens in styles/tokens.css, for Three.js materials.
   Keep the two in sync: CSS owns the design, this file only translates it. */
export const PALETTE = {
  bg: 0x090e12,        // --bg
  wall: 0x2b3035,
  wallSeam: 0x181c20,
  floor: 0x1a1e23,
  floorSeam: 0x22272c,
  ceiling: 0x1b2025,
  marker: 0x81878d,    // --ink-3
  light: 0xf2f5f8,     // --ink, ceiling panels
  signal: 0xc8f23c     // --signal, default target colour
};

/* Target colour presets offered in Settings > Targets. Lime is the default;
   the others cover common colour-vision differences and personal taste. */
export const TARGET_COLORS = [
  { id: 'lime', label: 'Lime', hex: '#c8f23c' },
  { id: 'cyan', label: 'Cyan', hex: '#44e7ef' },
  { id: 'orange', label: 'Orange', hex: '#fe8c2c' },
  { id: 'magenta', label: 'Magenta', hex: '#f259c8' },
  { id: 'white', label: 'White', hex: '#eff2f5' }
];

export function targetColorHex(id) {
  return (TARGET_COLORS.find((c) => c.id === id) || TARGET_COLORS[0]).hex;
}
