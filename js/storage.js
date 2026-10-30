// localStorage helpers. Storage can be unavailable (private mode, blocked cookies), so every
// access is guarded and the game still works without persistence.

const PREFIX = 'mushroom-id:';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Ignore quota or access errors; progress just won't persist.
  }
}

// Keys (without our prefix) that start with `start`.
export function keys(start = '') {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX + start))
      .map((k) => k.slice(PREFIX.length));
  } catch {
    return [];
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // Ignore.
  }
}
