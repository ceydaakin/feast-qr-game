// Outlined number labels (enemy HP) rendered once per value+colour into small
// canvases, then scaled with drawImage. strokeText/fillText with a fresh font
// every frame is one of the most expensive canvas calls on mobile.

const BASE_PX = 48;
const MAX_ENTRIES = 400;

export function createLabelCache({ font, ink }) {
  const cache = new Map();
  let dpr = 1;

  function render(text, color) {
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = `900 ${BASE_PX}px ${font}`;
    const pad = BASE_PX * 0.2;
    const w = probe.measureText(text).width + pad * 2;
    const h = BASE_PX * 1.3;
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr);
    c.height = Math.ceil(h * dpr);
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.font = probe.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = BASE_PX * 0.22;
    ctx.strokeStyle = ink;
    ctx.strokeText(text, w / 2, h / 2);
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, h / 2);
    return c;
  }

  function get(value, color) {
    const key = `${value}|${color}`;
    let c = cache.get(key);
    if (!c) {
      if (cache.size >= MAX_ENTRIES) cache.clear();
      c = render(String(value), color);
      cache.set(key, c);
    }
    return c;
  }

  // Draws `value` centred on (x, y) at roughly `size` px font size.
  function draw(ctx, value, x, y, size, color) {
    const c = get(value, color);
    const k = size / BASE_PX / dpr;
    const w = c.width * k; const h = c.height * k;
    ctx.drawImage(c, x - w / 2, y - h / 2, w, h);
  }

  function reset(pixelRatio) {
    dpr = pixelRatio;
    cache.clear();
  }

  return { draw, reset };
}
