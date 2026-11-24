// Remplit les éléments marqués data-* (cartes, marque, icônes) pour garder les deux visuels courts.
const NOTE = `<svg viewBox="0 0 64 64"><defs><linearGradient id="fb" gradientUnits="userSpaceOnUse" x1="6" y1="4" x2="58" y2="60"><stop offset="0" stop-color="#ff3d9a"/><stop offset=".55" stop-color="#7c5cff"/><stop offset="1" stop-color="#27d9ff"/></linearGradient></defs><g fill="url(#fb)"><ellipse cx="17" cy="50" rx="10" ry="7.5" transform="rotate(-20 17 50)"/><ellipse cx="45" cy="44" rx="10" ry="7.5" transform="rotate(-20 45 44)"/><rect x="23" y="14" width="4" height="36" rx="2"/><rect x="51" y="8" width="4" height="36" rx="2"/><path d="M23 14 L55 6 L55 17 L23 25 Z"/></g></svg>`;

const vinyl = (label) => `<svg class="vinyl" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="49" fill="#0d0a1c"/>
  ${[44, 39, 34, 29].map((r) => `<circle cx="50" cy="50" r="${r}" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="1"/>`).join("")}
  <path d="M20 22 A40 40 0 0 1 60 11" stroke="rgba(255,255,255,.28)" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="50" cy="50" r="17" fill="${label}"/><circle cx="50" cy="50" r="3" fill="#0d0a1c"/></svg>`;

const ICONS = {
  tv: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 17H3V5h18m0-2H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5v2h8v-2h5a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 19H7V5h10m0-4H7a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2z"/></svg>`,
  headphones: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a9 9 0 0 0-9 9v7a3 3 0 0 0 3 3h3v-8H5v-2a7 7 0 0 1 14 0v2h-4v8h3a3 3 0 0 0 3-3v-7a9 9 0 0 0-9-9z"/></svg>`,
  trophy: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2v2h-2V2H8v2H6V2H2v7a3 3 0 0 0 3 3h1.1A6 6 0 0 0 11 15.9V18H8v4h8v-4h-3v-2.1A6 6 0 0 0 17.9 12H19a3 3 0 0 0 3-3V2zM4 9V4h2v6H5a1 1 0 0 1-1-1zm16 0a1 1 0 0 1-1 1h-1V4h2z"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.3 18.2 21l-1.6-7L22 9.2l-7.2-.6L12 2 9.2 8.6 2 9.2 7.5 14l-1.6 7z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>`,
  arrow: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 11v2h12l-5.5 5.5 1.4 1.4L19.8 12l-7.9-7.9-1.4 1.4L16 11z"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="#fff"><path d="M6 3.5v17l14-8.5z"/></svg>`,
};

for (const el of document.querySelectorAll("[data-brand]")) el.insertAdjacentHTML("afterbegin", NOTE);
for (const el of document.querySelectorAll("[data-icon]")) el.insertAdjacentHTML("afterbegin", ICONS[el.dataset.icon]);

for (const el of document.querySelectorAll("[data-card]")) {
  const [year, title, artist, a, b, label] = el.dataset.card.split("|");
  el.classList.add("card");
  el.innerHTML = `<div class="cover" style="--cover: linear-gradient(135deg, ${a}, ${b})">${vinyl(label)}<span class="year">${year}</span></div>
    <div class="meta"><div class="t">${title}</div><div class="a">${artist}</div></div>`;
}
for (const el of document.querySelectorAll("[data-mystery]")) {
  const [title, artist] = el.dataset.mystery.split("|");
  el.classList.add("card", "mystery");
  el.innerHTML = `<div class="cover"><div class="play">${ICONS.play}</div><span class="year">?</span></div>
    <div class="meta"><div class="t">${title}</div><div class="a">${artist}</div></div>`;
}
