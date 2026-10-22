/* Tiny DOM builder so screens describe markup with classes instead of inline cssText.
   h('button', { class: 'btn', onClick: fn }, 'Label') -> <button class="btn">Label</button>
   Text children are always inserted as text nodes, never parsed as HTML. */
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'style') node.style.cssText = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
}

/* SVG elements need the SVG namespace; markup here is static and trusted */
export function svg(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstElementChild;
}

/* Formatting helpers shared by HUD, results and stats */
export const fmt = {
  int: (n) => Math.round(Number(n) || 0).toLocaleString('en-US'),
  pct: (n) => `${(Number(n) || 0).toFixed(1)}%`,
  ms: (n) => `${Math.round(Number(n) || 0)} ms`,
  clock: (seconds) => {
    const s = Math.max(0, Number(seconds) || 0);
    if (s >= 10) return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    return s.toFixed(1);
  },
  date: (ts) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  time: (ts) => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
};

/* Reads a CSS custom property so canvas drawings use the same tokens as the CSS */
export function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* Keeps a range input's filled track in sync with its value */
export function syncSliderFill(slider) {
  const min = Number(slider.min) || 0;
  const max = Number(slider.max) || 100;
  const pct = ((Number(slider.value) - min) / (max - min)) * 100;
  slider.style.setProperty('--fill', `${Math.max(0, Math.min(100, pct))}%`);
}

/* Sizes a canvas backing store to its CSS box at device pixel ratio; returns a ready 2D context */
export function prepareCanvas(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
