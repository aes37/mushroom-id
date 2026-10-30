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
