// localStorage wrapper. Storage can be unavailable (private mode, blocked cookies),
// so every access is guarded and the game still works without persistence.
const PREFIX = 'mushroom-id:v1:';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Ignore: progress just won't survive a reload.
  }
}

// Daily game states are only needed for the current day; finished results live in
// "history". Drop the rest so storage doesn't grow forever.
export function pruneDailyGames(keepKey) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key.startsWith(`${PREFIX}daily:`) && key !== `${PREFIX}daily:${keepKey}`) localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable: nothing to prune.
  }
}
