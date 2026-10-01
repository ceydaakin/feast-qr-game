// Canvas font stack shared by every renderer (gates, signs, banners, popups…).
// A theme can put a bundled web font first (İTÜ: "Baloo 2", see reward.css);
// everything else keeps the system rounded stack. `FONT` is a live binding:
// renderers read it when they draw, after main.js has called setGameFont().

export const SYSTEM_FONT = 'ui-rounded, system-ui, -apple-system, sans-serif';
// eslint-disable-next-line import/no-mutable-exports
export let FONT = SYSTEM_FONT;

export function setGameFont(family) {
  FONT = family ? `${family}, ${SYSTEM_FONT}` : SYSTEM_FONT;
}

// Canvas text does not wait for web fonts, so load the face (including the
// Turkish glyphs, which live in the latin-ext file) before sprites are drawn.
export async function loadGameFont(family) {
  if (!family || !document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load(`800 20px ${family}`, 'feast'),
      document.fonts.load(`800 20px ${family}`, 'ğşİıĞŞ'),
    ]);
  } catch {
    // Font failed to load: the system stack takes over, the game still works.
  }
}
