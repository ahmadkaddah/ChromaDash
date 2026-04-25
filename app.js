
const container      = document.getElementById('container');
const cols           = document.querySelectorAll('.color-col');
const modeSelect     = document.getElementById('modeSelect');
const cbSelect       = document.getElementById('cbSelect');
const historyStrip   = document.getElementById('historyStrip');
const saveBtn        = document.getElementById('saveBtn');
const exportPanel    = document.getElementById('exportPanel');
const favPanel       = document.getElementById('favoritesPanel');
const exportPreview  = document.getElementById('exportPreview');
const gradientToggle = document.getElementById('gradientToggle');
const gradientBar    = document.getElementById('gradientBar');
const gradientPreview= document.getElementById('gradientPreview');
const gradientCopyBtn= document.getElementById('gradientCopyBtn');
const gradientCopied = document.getElementById('gradientCopied');
const mockupSection  = document.getElementById('mockupSection');
const imageInput     = document.getElementById('imageInput');
const imgCanvas      = document.getElementById('imgCanvas');

let paletteHistory = [];
let favorites      = loadFavorites();
let gradientMode   = false;


function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function randomHex() {
  const ch = '0123456789ABCDEF';
  let c = '#';
  for (let i = 0; i < 6; i++) c += ch[Math.floor(Math.random() * 16)];
  return c;
}

function contrastColor(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return (0.299*r + 0.587*g + 0.114*b)/255 > 0.5 ? '#111111' : '#ffffff';
}


function generatePalette(mode) {
  const baseH = Math.random() * 360;
  const baseS = 55 + Math.random() * 30;
  const baseL = 40 + Math.random() * 20;

  switch (mode) {
    case 'analogous':
      return [0,30,60,-30,-60].map(o => hslToHex((baseH+o+360)%360, baseS, baseL));
    case 'monochromatic':
      return [baseL-25,baseL-12,baseL,baseL+12,baseL+25]
        .map(l => hslToHex(baseH, baseS, Math.max(10, Math.min(90,l))));
    case 'triadic':
      return [0,120,240,60,180].map(o => hslToHex((baseH+o)%360, baseS, baseL));
    default:
      return Array.from({length:5}, randomHex);
  }
}


function applyPalette(colors) {
  cols.forEach((col, i) => {
    if (col.classList.contains('locked')) return;
    const hex = colors[i];
    col.style.backgroundColor = hex;
    const codeEl = col.querySelector('.color-code');
    codeEl.textContent = hex;
    const fg = contrastColor(hex);
    codeEl.style.color = fg;
    col.querySelector('.lock-btn').style.color = fg;
    col.querySelector('.drag-handle').style.color = fg;
  });
  updateGradientBar();
  updateMockup();
}

function getCurrentColors() {
  return Array.from(cols).map(c => c.querySelector('.color-code').textContent);
}

function refreshPalette() {
  const colors = generatePalette(modeSelect.value);
  const merged = getCurrentColors().map((ex, i) =>
    cols[i].classList.contains('locked') ? ex : colors[i]
  );
  applyPalette(merged);
  addToHistory(merged);
}


function copyColor(col) {
  const hex = col.querySelector('.color-code').textContent;
  navigator.clipboard.writeText(hex).then(() => {
    const msg = col.querySelector('.copied-msg');
    msg.classList.add('show');
    setTimeout(() => msg.classList.remove('show'), 1400);
  });
}

function toggleLock(e, btn) {
  e.stopPropagation();
  const col = btn.closest('.color-col');
  col.classList.toggle('locked');
  btn.textContent = col.classList.contains('locked') ? '🔒' : '🔓';
}


let dragSrc = null;

cols.forEach(col => {
  col.addEventListener('dragstart', e => {
    dragSrc = col;
    col.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  col.addEventListener('dragend', () => {
    col.classList.remove('dragging');
    cols.forEach(c => c.classList.remove('drag-over'));
  });

  col.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (col !== dragSrc) col.classList.add('drag-over');
  });

  col.addEventListener('dragleave', () => col.classList.remove('drag-over'));

  col.addEventListener('drop', e => {
    e.preventDefault();
    col.classList.remove('drag-over');
    if (!dragSrc || dragSrc === col) return;

    const srcHex  = dragSrc.querySelector('.color-code').textContent;
    const destHex = col.querySelector('.color-code').textContent;

    setColColor(dragSrc, destHex);
    setColColor(col, srcHex);

    updateGradientBar();
    updateMockup();
  });

  col.querySelector('.drag-handle').addEventListener('mousedown', e => e.stopPropagation());
});

function setColColor(col, hex) {
  col.style.backgroundColor = hex;
  const codeEl = col.querySelector('.color-code');
  codeEl.textContent = hex;
  const fg = contrastColor(hex);
  codeEl.style.color = fg;
  col.querySelector('.lock-btn').style.color = fg;
  col.querySelector('.drag-handle').style.color = fg;
}


(function injectSVGFilters() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('svg-filters');
  svg.innerHTML = `
    <defs>
      <!-- Protanopia (red-blind) -->
      <filter id="protanopia">
        <feColorMatrix type="matrix" values="
          0.567 0.433 0     0 0
          0.558 0.442 0     0 0
          0     0.242 0.758 0 0
          0     0     0     1 0"/>
      </filter>
      <!-- Deuteranopia (green-blind) -->
      <filter id="deuteranopia">
        <feColorMatrix type="matrix" values="
          0.625 0.375 0   0 0
          0.7   0.3   0   0 0
          0     0.3   0.7 0 0
          0     0     0   1 0"/>
      </filter>
      <!-- Tritanopia (blue-blind) -->
      <filter id="tritanopia">
        <feColorMatrix type="matrix" values="
          0.95  0.05  0     0 0
          0     0.433 0.567 0 0
          0     0.475 0.525 0 0
          0     0     0     1 0"/>
      </filter>
    </defs>`;
  document.body.appendChild(svg);
})();

cbSelect.addEventListener('change', () => {
  const val = cbSelect.value;
  container.className = container.className
    .replace(/\bcb-\S+/g, '')
    .trim();
  if (val !== 'none') container.classList.add(`cb-${val}`);
});


gradientToggle.addEventListener('click', () => {
  gradientMode = !gradientMode;
  gradientToggle.classList.toggle('active', gradientMode);
  gradientBar.classList.toggle('hidden', !gradientMode);
  container.classList.toggle('gradient-mode', gradientMode);
  if (gradientMode) updateGradientBar();
});

function updateGradientBar() {
  if (!gradientMode) return;
  const colors = getCurrentColors();
  const grad = `linear-gradient(to right, ${colors.join(', ')})`;
  gradientPreview.style.background = grad;
}

gradientCopyBtn.addEventListener('click', () => {
  const colors = getCurrentColors();
  const css = `background: linear-gradient(to right, ${colors.join(', ')});`;
  navigator.clipboard.writeText(css).then(() => {
    gradientCopied.classList.add('show');
    setTimeout(() => gradientCopied.classList.remove('show'), 1500);
  });
});

function exportGradientCSS() {
  const colors = getCurrentColors();
  const css = `background: linear-gradient(to right, ${colors.join(', ')});`;
  navigator.clipboard.writeText(css);
  exportPreview.style.display = 'block';
  exportPreview.textContent = css;
}


function updateMockup() {
  const c = getCurrentColors();
  if (!mockupSection.classList.contains('visible')) return;

  const navbar = document.getElementById('mockupNavbar');
  navbar.style.backgroundColor = c[0];
  const navFg = contrastColor(c[0]);
  document.getElementById('mockupLogo').style.color = navFg;
  document.querySelectorAll('.mockup-nav-links span').forEach(s => s.style.color = navFg);

  document.getElementById('mockupBody').style.backgroundColor = c[2];

  const card1 = document.getElementById('mockupCard');
  card1.style.backgroundColor = c[3];
  card1.style.boxShadow = `0 4px 20px ${c[0]}44`;
  const cardFg = contrastColor(c[3]);
  document.getElementById('mockupCardTitle').style.color = cardFg;
  document.getElementById('mockupCardText').style.color = cardFg;

  const card2 = document.getElementById('mockupCard2');
  card2.style.backgroundColor = c[1] || c[3];
  const card2Fg = contrastColor(c[1] || c[3]);
  document.getElementById('mockupCardTitle2').style.color = card2Fg;
  document.getElementById('mockupCardText2').style.color = card2Fg;

  const btn = document.getElementById('mockupBtn');
  btn.style.backgroundColor = c[4];
  btn.style.color = contrastColor(c[4]);

  const btnOutline = document.getElementById('mockupBtnOutline');
  btnOutline.style.color = c[4];
  btnOutline.style.borderColor = c[4];
  btnOutline.style.backgroundColor = 'transparent';
}

(function setupMockupToggle() {
  const btn = document.createElement('button');
  btn.id = 'mockupToggle';
  btn.textContent = '🖥 معاينة';
  btn.title = 'معاينة التصميم';
  document.querySelector('.topbar-controls').appendChild(btn);

  btn.addEventListener('click', () => {
    const visible = mockupSection.classList.toggle('visible');
    container.classList.toggle('with-mockup', visible);
    btn.classList.toggle('active', visible);
    if (visible) updateMockup();
  });
})();


imageInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const W = 100, H = 100;
    imgCanvas.width = W; imgCanvas.height = H;
    const ctx = imgCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;
    URL.revokeObjectURL(url);

    const colors = extractDominantColors(data, 5);
    applyPalette(colors);
    addToHistory(colors);
  };
  img.src = url;
  imageInput.value = '';
});

function extractDominantColors(data, count) {
  const buckets = {};
  for (let i = 0; i < data.length; i += 4) {
    const r = Math.round(data[i]   / 32) * 32;
    const g = Math.round(data[i+1] / 32) * 32;
    const b = Math.round(data[i+2] / 32) * 32;
    if (data[i+3] < 128) continue;
    const key = `${r},${g},${b}`;
    buckets[key] = (buckets[key] || 0) + 1;
  }

  const sorted = Object.entries(buckets)
    .sort((a, b) => b[1] - a[1]);

  const picked = [];
  for (const [key] of sorted) {
    const [r, g, b] = key.split(',').map(Number);
    const tooClose = picked.some(([pr,pg,pb]) =>
      Math.abs(pr-r) < 48 && Math.abs(pg-g) < 48 && Math.abs(pb-b) < 48
    );
    if (!tooClose) picked.push([r, g, b]);
    if (picked.length === count) break;
  }

  while (picked.length < count) picked.push([
    Math.floor(Math.random()*256),
    Math.floor(Math.random()*256),
    Math.floor(Math.random()*256)
  ]);

  return picked.map(([r,g,b]) =>
    '#' + [r,g,b].map(v => Math.min(255,v).toString(16).padStart(2,'0')).join('').toUpperCase()
  );
}


function addToHistory(colors) {
  paletteHistory.unshift([...colors]);
  if (paletteHistory.length > 10) paletteHistory.pop();
  renderHistory();
}

function renderHistory() {
  historyStrip.innerHTML = '';
  paletteHistory.forEach((palette, idx) => {
    if (idx === 0) return;
    const item = document.createElement('div');
    item.className = 'history-item';
    item.title = 'استعادة هذا الباليت';
    palette.forEach(hex => {
      const s = document.createElement('div');
      s.className = 'history-swatch';
      s.style.backgroundColor = hex;
      item.appendChild(s);
    });
    item.addEventListener('click', () => {
      applyPalette(palette);
      paletteHistory.unshift([...palette]);
      if (paletteHistory.length > 10) paletteHistory.pop();
      renderHistory();
    });
    historyStrip.appendChild(item);
  });
}


function loadFavorites() {
  try { return JSON.parse(localStorage.getItem('chromadash_favs')) || []; }
  catch { return []; }
}

function saveFavoritesToStorage() {
  localStorage.setItem('chromadash_favs', JSON.stringify(favorites));
}

function saveCurrent() {
  favorites.unshift(getCurrentColors());
  saveFavoritesToStorage();
  saveBtn.textContent = '♥';
  saveBtn.classList.add('saved');
  setTimeout(() => { saveBtn.classList.remove('saved'); saveBtn.textContent = '♡'; }, 600);
  renderFavorites();
}

function renderFavorites() {
  const list  = document.getElementById('favoritesList');
  const empty = document.getElementById('favEmpty');
  list.innerHTML = '';
  if (!favorites.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  favorites.forEach((palette, idx) => {
    const item = document.createElement('div');
    item.className = 'fav-item';

    const swatches = document.createElement('div');
    swatches.className = 'fav-swatches';
    palette.forEach(hex => {
      const s = document.createElement('div');
      s.className = 'fav-swatch';
      s.style.backgroundColor = hex;
      swatches.appendChild(s);
    });

    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'fav-restore';
    restoreBtn.textContent = 'استعادة';
    restoreBtn.onclick = () => { applyPalette(palette); addToHistory(palette); closePanel('favoritesPanel'); };

    const delBtn = document.createElement('button');
    delBtn.className = 'fav-delete';
    delBtn.textContent = '✕';
    delBtn.onclick = () => { favorites.splice(idx,1); saveFavoritesToStorage(); renderFavorites(); };

    item.append(swatches, restoreBtn, delBtn);
    list.appendChild(item);
  });
}


function exportCSS() {
  const colors = getCurrentColors();
  const css = colors.map((c,i) => `  --color-${i+1}: ${c};`).join('\n');
  const full = `:root {\n${css}\n}`;
  navigator.clipboard.writeText(full);
  exportPreview.style.display = 'block';
  exportPreview.textContent = full;
}

function exportJSON() {
  const data = JSON.stringify({ palette: getCurrentColors() }, null, 2);
  downloadBlob(new Blob([data], {type:'application/json'}), 'chromadash-palette.json');
}

function exportPNG() {
  const colors = getCurrentColors();
  const canvas = document.createElement('canvas');
  const W=1000, H=200;
  canvas.width=W; canvas.height=H;
  const ctx = canvas.getContext('2d');
  const sw = W/colors.length;
  colors.forEach((hex,i) => {
    ctx.fillStyle = hex;
    ctx.fillRect(i*sw, 0, sw, H);
    ctx.fillStyle = contrastColor(hex);
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(hex, i*sw+sw/2, H/2+7);
  });
  canvas.toBlob(blob => downloadBlob(blob, 'chromadash-palette.png'));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}


function closePanel(id) {
  document.getElementById(id).classList.remove('open');
  exportPreview.style.display = 'none';
}

document.getElementById('exportBtn').addEventListener('click', () => {
  exportPanel.classList.toggle('open');
  favPanel.classList.remove('open');
  exportPreview.style.display = 'none';
});

document.getElementById('favoritesBtn').addEventListener('click', () => {
  favPanel.classList.toggle('open');
  exportPanel.classList.remove('open');
  renderFavorites();
});

saveBtn.addEventListener('click', saveCurrent);

document.addEventListener('click', e => {
  if (!exportPanel.contains(e.target) && e.target.id !== 'exportBtn')
    exportPanel.classList.remove('open');
  if (!favPanel.contains(e.target) && e.target.id !== 'favoritesBtn')
    favPanel.classList.remove('open');
});


window.addEventListener('keydown', e => {
  if (e.code === 'Space' && !['SELECT','INPUT','BUTTON'].includes(e.target.tagName)) {
    e.preventDefault();
    refreshPalette();
  }
});

refreshPalette();
