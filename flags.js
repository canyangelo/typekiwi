// Language flags (SVG) for the popup. Hand-drawn because Windows doesn't render flag emoji (it shows the letters "TR").
// Simplified enough to read at small size (20x14).
(function (root) {
  function star(cx, cy, r, rot = -90) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.4 : r;
      const a = ((rot + i * 36) * Math.PI) / 180;
      pts.push((cx + rr * Math.cos(a)).toFixed(2) + ',' + (cy + rr * Math.sin(a)).toFixed(2));
    }
    return pts.join(' ');
  }
  const h3 = (a, b, c) => `<rect width="30" height="20" fill="${a}"/><rect y="6.67" width="30" height="6.67" fill="${b}"/><rect y="13.33" width="30" height="6.67" fill="${c}"/>`;
  const v3 = (a, b, c) => `<rect width="10" height="20" fill="${a}"/><rect x="10" width="10" height="20" fill="${b}"/><rect x="20" width="10" height="20" fill="${c}"/>`;

  const FLAGS = {
    tr: `<rect width="30" height="20" fill="#E30A17"/><circle cx="11" cy="10" r="5" fill="#fff"/><circle cx="12.3" cy="10" r="4" fill="#E30A17"/><polygon points="${star(17.6, 10, 2.3, 180)}" fill="#fff"/>`,
    ru: h3('#fff', '#0039A6', '#D52B1E'),
    en: `<rect width="30" height="20" fill="#012169"/><path d="M0,0 30,20 M30,0 0,20" stroke="#fff" stroke-width="4"/><path d="M0,0 30,20 M30,0 0,20" stroke="#C8102E" stroke-width="1.4"/><path d="M15,0V20M0,10H30" stroke="#fff" stroke-width="6"/><path d="M15,0V20M0,10H30" stroke="#C8102E" stroke-width="3.4"/>`,
    uk: `<rect width="30" height="10" fill="#0057B7"/><rect y="10" width="30" height="10" fill="#FFD700"/>`,
    de: h3('#000', '#DD0000', '#FFCE00'),
    fr: v3('#0055A4', '#fff', '#EF4135'),
    es: `<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>`,
    pt: `<rect width="12" height="20" fill="#006600"/><rect x="12" width="18" height="20" fill="#FF0000"/><circle cx="12" cy="10" r="4" fill="#FFCC00"/><circle cx="12" cy="10" r="2.4" fill="#fff" stroke="#FF0000" stroke-width="0.8"/>`,
    pl: `<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#DC143C"/>`,
    ar: `<rect width="30" height="20" fill="#006C35"/><path d="M8,8.2h14M10,6.4h10" stroke="#fff" stroke-width="1" stroke-dasharray="2 1"/><path d="M8,13.5h13l1.5-0.8" stroke="#fff" stroke-width="1" fill="none"/>`,
    'zh-CN': `<rect width="30" height="20" fill="#EE1C25"/><polygon points="${star(5, 5, 3)}" fill="#FFFF00"/><polygon points="${star(10, 2, 1)}" fill="#FFFF00"/><polygon points="${star(12, 4, 1)}" fill="#FFFF00"/><polygon points="${star(12, 7, 1)}" fill="#FFFF00"/><polygon points="${star(10, 9, 1)}" fill="#FFFF00"/>`,
    kk: `<rect width="30" height="20" fill="#00AFCA"/><circle cx="16" cy="9" r="3" fill="#FEC50C"/><circle cx="16" cy="9" r="4.4" fill="none" stroke="#FEC50C" stroke-width="0.8" stroke-dasharray="0.9 0.7"/><path d="M14,14.6q2,-1.4 4,0" stroke="#FEC50C" stroke-width="0.9" fill="none"/><rect x="2" y="1.5" width="1.4" height="17" fill="#FEC50C"/>`,
    az: `${h3('#00B5E2', '#EF3340', '#509E2F')}<circle cx="14" cy="10" r="2.6" fill="#fff"/><circle cx="14.7" cy="10" r="2.1" fill="#EF3340"/><polygon points="${star(17.6, 10, 1.3)}" fill="#fff"/>`,
  };

  function flagSvg(code) {
    const body = FLAGS[code] || `<rect width="30" height="20" fill="#9aa0ad"/>`;
    return `<svg class="flag" viewBox="0 0 30 20" preserveAspectRatio="none" aria-hidden="true">${body}</svg>`;
  }

  root.CC = Object.assign(root.CC || {}, { flagSvg });
})(globalThis);
