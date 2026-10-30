import { SPECIES } from '../data/species.js';
import { PHOTOS } from '../data/photos.js';
import { EDIBILITY, imageUrl, creditNodes } from './attribution.js';

const list = document.getElementById('credit-list');
const keys = Object.keys(PHOTOS)
  .filter((k) => SPECIES[k])
  .sort((a, b) => SPECIES[a].name.localeCompare(SPECIES[b].name));

let total = 0;
for (const key of keys) {
  const s = SPECIES[key];
  const section = document.createElement('section');
  section.className = 'credit-species';
  const h2 = document.createElement('h2');
  h2.append(s.name, ' ');
  const sci = document.createElement('em');
  sci.textContent = s.sci;
  const badge = document.createElement('span');
  badge.className = `badge ${s.edibility}`;
  badge.textContent = `${EDIBILITY[s.edibility].icon} ${EDIBILITY[s.edibility].label}`;
  h2.append(sci, ' ', badge);
  section.append(h2);

  const ul = document.createElement('ul');
  ul.className = 'credit-photos';
  for (const photo of PHOTOS[key]) {
    total++;
    const li = document.createElement('li');
    const img = document.createElement('img');
    img.src = imageUrl(photo.id);
    img.alt = `${s.name} (${photo.taxon})`;
    img.loading = 'lazy';
    const cap = document.createElement('p');
    const taxon = document.createElement('em');
    taxon.textContent = photo.taxon;
    cap.append(taxon, document.createElement('br'), creditNodes(photo, { prefix: '© ' }));
    li.append(img, cap);
    ul.append(li);
  }
  section.append(ul);
  list.append(section);
}

document.getElementById('summary').textContent = `${total} photos of ${keys.length} species.`;
