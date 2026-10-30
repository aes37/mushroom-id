// Photo URLs and Creative Commons attribution helpers shared by the game and the credits page.

export const LICENSES = {
  CC0: { label: 'CC0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  'CC-BY': { label: 'CC BY', url: 'https://creativecommons.org/licenses/by/4.0/' },
  'CC-BY-SA': { label: 'CC BY-SA', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
};

export const EDIBILITY = {
  edible: { label: 'Edible', icon: '✓' },
  inedible: { label: 'Inedible', icon: '–' },
  toxic: { label: 'Poisonous', icon: '!' },
  deadly: { label: 'Deadly', icon: '☠' },
};

export const imageUrl = (id) => `img/${id}.webp`;
export const sourceUrl = (id) => `https://www.inaturalist.org/photos/${id}`;

// CC0 works are dedicated to the public domain, so they get no copyright sign.
const isPublicDomain = (photo) => photo.license === 'CC0';

export function creditText(photo) {
  const who = isPublicDomain(photo) ? photo.by : `© ${photo.by}`;
  return `Photo: ${who} · ${LICENSES[photo.license].label} · iNaturalist`;
}

// Builds "Name · CC BY" as DOM nodes (no innerHTML with user-supplied names). With `copyright`,
// prefixes "©" for licensed (non-CC0) photos.
export function creditNodes(photo, { prefix = 'Photo: ', copyright = false } = {}) {
  const frag = document.createDocumentFragment();
  frag.append(prefix);
  if (copyright && !isPublicDomain(photo)) frag.append('© ');
  const who = document.createElement('a');
  who.href = sourceUrl(photo.id);
  who.target = '_blank';
  who.rel = 'noopener';
  who.textContent = photo.by;
  frag.append(who, ' · ');
  const lic = LICENSES[photo.license];
  const licLink = document.createElement('a');
  licLink.href = lic.url;
  licLink.target = '_blank';
  licLink.rel = 'noopener license';
  licLink.textContent = lic.label;
  frag.append(licLink);
  return frag;
}
