// Paleta compartilhada de minérios e materiais.
// A cor é estável pelo nome: o mesmo material aparece igual no Baú e no Tracking.

const KNOWN_MATERIALS = [
  'Agricium','Aluminium','Aluminum','Amiant','Aphorite','Aslarite','Beryl','Bexalite',
  'Beradom','Borase','Caranite','Caranite Pure','Copper','Corundum','Decari','Degnous',
  'Diamond','Dolivine','Feynmaline','Flareweed','Fotia','Glacosite','Gold','Golden Medmon',
  'Hadanite','Heart of the Woods','Hephaestanite','Ice','Industrial Polymer','Inert Material',
  'Iron','Jaclium','Janalite','Laranite','Lindinium','Medical Grade Polymer','Ouratite',
  'Pingala','Pitambu','Polymer','Prota','Quantainium','Quartz','Reactive Material','Revenant',
  'Riccite','Sadaryx','Saldynium','Savrilium','Silicon','Steel','Stileron','Sunset Berry',
  'Taranite','Tin','Titanium','Torite','Tungsten','Wuotan','Mg Scrip','Council Scrip',
  'Concuil Script','Orotite','Caranite','Polymer'
];

function hslToHex(h, s = 68, l = 66) {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
  const m = lightness - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (h < 60) [red, green, blue] = [chroma, x, 0];
  else if (h < 120) [red, green, blue] = [x, chroma, 0];
  else if (h < 180) [red, green, blue] = [0, chroma, x];
  else if (h < 240) [red, green, blue] = [0, x, chroma];
  else if (h < 300) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];

  return `#${[red, green, blue]
    .map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

const COLOR_PALETTE = Array.from({ length: 72 }, (_, index) =>
  hslToHex((index * 137.508 + 18) % 360)
);

const MATERIAL_COLOR_MAP = new Map(
  [...new Set(KNOWN_MATERIALS.map(name => name.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .map((name, index) => [name.toLowerCase(), COLOR_PALETTE[index % COLOR_PALETTE.length]])
);

function hashMaterialName(value) {
  return [...String(value || '').toLowerCase()].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 7);
}

export function normalizeMaterialName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function getOreColor(name) {
  const normalized = normalizeMaterialName(name);
  if (!normalized) return '#94a3b8';
  return MATERIAL_COLOR_MAP.get(normalized.toLowerCase())
    || COLOR_PALETTE[hashMaterialName(normalized) % COLOR_PALETTE.length];
}

export function getOreColorSoft(name, alpha = 0.12) {
  const color = getOreColor(name);
  const hex = color.replace('#', '');
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

export function getOreColorBorder(name, alpha = 0.38) {
  return getOreColorSoft(name, alpha);
}
