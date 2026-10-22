/* Crosshair builder: renders the player's crosshair as inline SVG from a
   config object, so every property (shape, rotation, gap, dot, outline...)
   can be tuned live from the settings UI. */

export const CROSSHAIR_DEFAULTS = {
  style: 'cross',     // cross | x | t | circle | square
  size: 6,            // arm length (px at 1:1 preview scale)
  thickness: 2,       // arm stroke width
  gap: 3,             // distance between center and arm start
  dot: false,         // center dot toggle
  dotSize: 4,         // center dot diameter
  color: '#ffffff',
  outline: true,      // dark border behind the strokes for visibility
  rotation: 0,        // degrees, 0-360
  opacity: 1
};

const STYLES = new Set(['cross', 'x', 't', 'circle', 'square']);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/* The config round-trips through localStorage, so validate every field:
   only whitelisted styles and plain 6-digit hex colors reach the SVG markup. */
function sanitize(stored) {
  const raw = { ...CROSSHAIR_DEFAULTS, ...(stored || {}) };
  const clamp = (value, min, max, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  return {
    style: STYLES.has(raw.style) ? raw.style : CROSSHAIR_DEFAULTS.style,
    size: clamp(raw.size, 0, 40, CROSSHAIR_DEFAULTS.size),
    thickness: clamp(raw.thickness, 0, 10, CROSSHAIR_DEFAULTS.thickness),
    gap: clamp(raw.gap, 0, 24, CROSSHAIR_DEFAULTS.gap),
    dot: raw.dot === true,
    dotSize: clamp(raw.dotSize, 1, 20, CROSSHAIR_DEFAULTS.dotSize),
    color: HEX_COLOR.test(raw.color) ? raw.color : CROSSHAIR_DEFAULTS.color,
    outline: raw.outline === true,
    rotation: ((clamp(raw.rotation, -360, 360, 0) % 360) + 360) % 360,
    opacity: clamp(raw.opacity, 0.1, 1, CROSSHAIR_DEFAULTS.opacity)
  };
}

export function mergeCrosshairConfig(stored) {
  return sanitize(stored);
}

const CENTER = 50; // SVG viewBox is 100x100 with the crosshair at dead center
const OUTLINE_OFFSET = 2; // extra black stroke around colored strokes

/* One arm drawn twice: dark outline underneath, colored stroke on top */
function armElement(angleDeg, cfg) {
  const rad = (angleDeg * Math.PI) / 180;
  // 0deg points straight up, sweeping clockwise
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const x1 = CENTER + dx * cfg.gap;
  const y1 = CENTER + dy * cfg.gap;
  const x2 = CENTER + dx * (cfg.gap + cfg.size);
  const y2 = CENTER + dy * (cfg.gap + cfg.size);
  const geometry = `x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-linecap="round"`;

  const colored = `<line ${geometry} stroke="${cfg.color}" stroke-width="${cfg.thickness}"/>`;
  const outline = cfg.outline
    ? `<line ${geometry} stroke="#000" stroke-width="${cfg.thickness + OUTLINE_OFFSET}"/>`
    : '';
  return outline + colored;
}

/* circle / square: closed outline shapes with `gap + size` as reach */
/* Builds the full inline SVG markup for a crosshair config */
export function buildCrosshairSVG(cfg) {
  const c = mergeCrosshairConfig(cfg);
  let parts = '';

  if (c.style === 'cross') {
    for (const angle of [0, 90, 180, 270]) parts += armElement(angle, c);
  } else if (c.style === 'x') {
    for (const angle of [45, 135, 225, 315]) parts += armElement(angle, c);
  } else if (c.style === 't') {
    for (const angle of [90, 180, 270]) parts += armElement(angle, c);
  } else {
    parts += buildClosedShape(c);
  }

  if (c.dot) {
    if (c.outline && c.dotSize > 1) {
      parts += `<circle cx="${CENTER}" cy="${CENTER}" r="${Math.max(0, c.dotSize / 2 - 0.5)}" fill="${c.color}" stroke="#000" stroke-width="1"/>`;
    } else {
      parts += `<circle cx="${CENTER}" cy="${CENTER}" r="${c.dotSize / 2}" fill="${c.color}"/>`;
    }
  }

  const rotation = c.rotation ? ` transform="rotate(${c.rotation} ${CENTER} ${CENTER})"` : '';
  return `<svg viewBox="0 0 100 100" style="position:absolute; left:50%; top:50%; width:100px; height:100px; transform:translate(-50%,-50%); overflow:visible; opacity:${c.opacity}">` +
    `<g${rotation}>${parts}</g></svg>`;
}

function buildClosedShape(cfg) {
  const reach = cfg.gap + cfg.size;
  const geometry = cfg.style === 'circle'
    ? { tag: 'circle', props: `cx="${CENTER}" cy="${CENTER}" r="${reach}"` }
    : { tag: 'rect', props: `x="${CENTER - reach}" y="${CENTER - reach}" width="${reach * 2}" height="${reach * 2}"` };

  const fill = 'fill="none"';
  const colored = `<${geometry.tag} ${geometry.props} ${fill} stroke="${cfg.color}" stroke-width="${cfg.thickness}"/>`;
  const outline = cfg.outline
    ? `<${geometry.tag} ${geometry.props} ${fill} stroke="#000" stroke-width="${cfg.thickness + OUTLINE_OFFSET}"/>`
    : '';
  return outline + colored;
}
