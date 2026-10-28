/*
 * Energie Flow Card — carte Home Assistant animée (solaire, batterie, réseau, maison, voiture)
 * Installation : copier ce fichier dans /config/www/energie-flow-card.js
 * puis Paramètres > Tableaux de bord > ⋮ > Ressources > + Ajouter :
 *   URL : /local/energie-flow-card.js?v=1   Type : Module JavaScript
 */
class EnergieFlowCard extends HTMLElement {
  setConfig(config) {
    this._config = Object.assign(
      {
        title: "Mon énergie",
        invert_battery: false, // false : puissance batterie positive = décharge
        invert_grid: false, // false : puissance réseau positive = achat
        car_name: "Ma voiture",
      },
      config
    );
    this._built = false;
    this._keys = {};
    if (this.shadowRoot) this.shadowRoot.innerHTML = "";
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._build();
    this._update();
  }

  getCardSize() {
    return 8;
  }

  /* ---------- lecture des capteurs ---------- */
  _st(id) {
    return id && this._hass ? this._hass.states[id] : undefined;
  }
  _raw(id) {
    const s = this._st(id);
    if (!s) return null;
    const v = parseFloat(s.state);
    return isNaN(v) ? null : v;
  }
  _w(id) {
    const s = this._st(id);
    const v = this._raw(id);
    if (v === null) return null;
    const u = ((s.attributes || {}).unit_of_measurement || "").toLowerCase();
    return u === "kw" ? v * 1000 : v;
  }
  _kwh(id) {
    const s = this._st(id);
    const v = this._raw(id);
    if (v === null) return null;
    const u = ((s.attributes || {}).unit_of_measurement || "").toLowerCase();
    return u === "wh" ? v / 1000 : v;
  }
  _fw(w) {
    if (w === null || w === undefined) return "—";
    const a = Math.abs(w);
    return a >= 1000 ? (a / 1000).toFixed(2).replace(".", ",") + " kW" : Math.round(a) + " W";
  }
  _fk(k) {
    return k === null || k === undefined ? "—" : k.toFixed(1).replace(".", ",") + " kWh";
  }
  _f(v, d, u) {
    return v === null || v === undefined ? "—" : v.toFixed(d).replace(".", ",") + " " + u;
  }

  /* ---------- construction (une seule fois) ---------- */
  _build() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const c = this._config;
    this.shadowRoot.innerHTML = `
<style>
  :host { display:block; }
  ha-card, .card {
    display:block; position:relative; overflow:hidden; border-radius:24px; padding:18px 16px 16px;
    background: radial-gradient(120% 80% at 50% 0%, #23315c 0%, #121a33 45%, #0b1020 100%);
    color:#eef2ff; font-family: var(--ha-card-header-font-family, "Segoe UI", Roboto, sans-serif);
    box-shadow: 0 10px 40px rgba(0,0,0,.45);
  }
  .top { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
  .title { font-size:20px; font-weight:700; letter-spacing:.3px; }
  .mood { font-size:13px; opacity:.85; margin-top:4px; min-height:18px; transition: opacity .4s; }
  .ratio { text-align:right; }
  .ratio b { font-size:26px; font-weight:800; background:linear-gradient(90deg,#ffd166,#06d6a0);
             -webkit-background-clip:text; background-clip:text; color:transparent; }
  .ratio span { display:block; font-size:11px; opacity:.7; text-transform:uppercase; letter-spacing:.8px; }
  svg { width:100%; height:auto; display:block; margin-top:4px; overflow:visible; }
  .lbl { font-size:15px; font-weight:800; fill:#fff; text-anchor:middle; }
  .sub { font-size:10.5px; fill:#aab4d6; text-anchor:middle; }
  .tag { font-size:9.5px; fill:#8b95b8; text-anchor:middle; text-transform:uppercase; letter-spacing:1px; }
  .wire { fill:none; stroke:rgba(255,255,255,.08); stroke-width:6; stroke-linecap:round; }
  .rays { transform-origin:200px 72px; animation: spin 18s linear infinite; }
  .sunglow { transform-origin:200px 72px; animation: pulse 3s ease-in-out infinite; }
  .inv-arrows { transform-origin:200px 250px; animation: spin 6s linear infinite; }
  .wave { animation: wave 2.6s linear infinite; }
  .bolt { animation: blink 1s ease-in-out infinite; }
  .star { animation: twinkle 2.4s ease-in-out infinite; }
  .win { transition: fill .6s; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100% { transform: scale(1); opacity:.55 } 50% { transform: scale(1.12); opacity:.9 } }
  @keyframes wave { from { transform: translateX(0) } to { transform: translateX(-60px) } }
  @keyframes blink { 0%,100% { opacity:1 } 50% { opacity:.25 } }
  @keyframes twinkle { 0%,100% { opacity:.2 } 50% { opacity:1 } }
  .stats { display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-top:10px; }
  .chip { background: rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.08);
          border-radius:14px; padding:8px 10px; }
  .chip .k { font-size:10px; text-transform:uppercase; letter-spacing:.8px; opacity:.7; }
  .chip .v { font-size:15px; font-weight:700; margin-top:2px; }
  .chip .v small { font-size:11px; font-weight:500; opacity:.75; }
  .bar { height:8px; border-radius:6px; background:rgba(255,255,255,.08); margin-top:12px; overflow:hidden; }
  .bar i { display:block; height:100%; width:0; border-radius:6px; transition: width 1s;
           background: linear-gradient(90deg,#ef476f,#ffd166,#06d6a0); }
  .apl-head { display:flex; justify-content:space-between; align-items:baseline; margin:14px 2px 0; }
  .apl-head b { font-size:14px; font-weight:700; }
  .apl-head span { font-size:11px; opacity:.7; }
  .apl-node { cursor:pointer; transition: opacity .5s, filter .5s; }
  .apl-node.off { opacity:.38; filter: grayscale(1); }
  .apl-node .ring { transition: stroke-opacity .5s; }
  .apl-node.on .ring { animation: aplPulse 2.2s ease-in-out infinite; }
  @keyframes aplPulse { 0%,100% { stroke-opacity:.35 } 50% { stroke-opacity:1 } }
  .apl-emoji { font-size:20px; text-anchor:middle; dominant-baseline:central; }
  .barlbl { display:flex; justify-content:space-between; font-size:10.5px; opacity:.7; margin-top:4px; }
</style>
<ha-card class="card">
  <div class="top">
    <div><div class="title">${c.title}</div><div class="mood" id="mood"></div></div>
    <div class="ratio"><b id="auto">—</b><span>autonomie</span></div>
  </div>

  <svg viewBox="0 0 400 470" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="bigglow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="10"/></filter>
      <radialGradient id="gSun" cx="40%" cy="35%"><stop offset="0" stop-color="#fff3b0"/><stop offset=".55" stop-color="#ffd166"/><stop offset="1" stop-color="#f77f00"/></radialGradient>
      <linearGradient id="gInv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4a80"/><stop offset="1" stop-color="#1c2550"/></linearGradient>
      <clipPath id="batClip"><rect x="42" y="203" width="56" height="94" rx="12"/></clipPath>
    </defs>

    <!-- câbles -->
    <path id="p-pv"   class="wire" d="M200,114 L200,212"/>
    <path id="p-bat"  class="wire" d="M100,250 L162,250"/>
    <path id="p-grid" class="wire" d="M300,250 L238,250"/>
    <path id="p-home" class="wire" d="M130,360 Q138,300 164,284"/>
    <path id="p-car"  class="wire" d="M272,360 Q264,300 236,284"/>
    <g id="f-pv"></g><g id="f-bat"></g><g id="f-grid"></g><g id="f-home"></g><g id="f-car"></g>

    <!-- SOLEIL / LUNE -->
    <g id="sun">
      <circle class="sunglow" cx="200" cy="72" r="44" fill="#ffd166" filter="url(#bigglow)"/>
      <g class="rays" id="rays" stroke="#ffd166" stroke-width="4" stroke-linecap="round">
        ${[...Array(12)].map((_, i) => {
          const a = (i * Math.PI) / 6, r1 = 40, r2 = i % 2 ? 48 : 54;
          return `<line x1="${200 + r1 * Math.cos(a)}" y1="${72 + r1 * Math.sin(a)}" x2="${200 + r2 * Math.cos(a)}" y2="${72 + r2 * Math.sin(a)}"/>`;
        }).join("")}
      </g>
      <circle cx="200" cy="72" r="32" fill="url(#gSun)"/>
      <circle cx="190" cy="68" r="3" fill="#7a3e00"/><circle cx="210" cy="68" r="3" fill="#7a3e00"/>
      <path d="M190,80 Q200,89 210,80" stroke="#7a3e00" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </g>
    <g id="moon" style="display:none">
      <circle class="star" cx="140" cy="40" r="1.8" fill="#fff"/>
      <circle class="star" cx="262" cy="30" r="1.5" fill="#fff" style="animation-delay:.8s"/>
      <circle class="star" cx="250" cy="96" r="1.3" fill="#fff" style="animation-delay:1.6s"/>
      <circle class="star" cx="152" cy="98" r="1.2" fill="#fff" style="animation-delay:.4s"/>
      <circle cx="200" cy="72" r="38" fill="#c9d6ff" filter="url(#bigglow)" opacity=".35"/>
      <path d="M214,44 A30,30 0 1,0 214,100 A24,24 0 1,1 214,44 Z" fill="#e8eeff"/>
    </g>
    <text class="lbl" x="200" y="16" id="t-pv" style="font-size:17px">—</text>

    <!-- CHAMPS PV SUPPLÉMENTAIRES -->
    ${(c.extra_pv || []).map((p, i) => {
      const x = i % 2 === 0 ? 62 : 338, y = 46 + Math.floor(i / 2) * 64;
      return `<g transform="translate(${x},${y})">
        <g transform="skewX(-14)">
          <rect x="-17" y="-13" width="34" height="20" rx="3" fill="rgba(255,209,102,.12)" stroke="#ffd166" stroke-width="2"/>
          <path d="M-6,-13 L-6,7 M6,-13 L6,7 M-17,-3 L17,-3" stroke="#ffd166" stroke-width="1.2" opacity=".7"/>
        </g>
        <path d="M0,7 L0,13" stroke="#ffd166" stroke-width="2"/>
        <text class="tag" y="25">${p.name || "PV " + (i + 1)}</text>
        <text class="lbl" y="42" id="xpv-v-${i}" style="font-size:14px">—</text>
        <text class="sub" y="55" id="xpv-a-${i}"></text>
      </g>`;
    }).join("")}

    <!-- BATTERIE -->
    <rect x="62" y="194" width="16" height="9" rx="3" fill="#cfd8ff"/>
    <rect x="40" y="201" width="60" height="98" rx="14" fill="rgba(255,255,255,.05)" stroke="#cfd8ff" stroke-width="3"/>
    <g clip-path="url(#batClip)">
      <g id="batfill">
        <rect id="batrect" x="0" y="297" width="200" height="0" fill="#06d6a0"/>
        <path id="batwave" class="wave" d="" fill="#06d6a0"/>
      </g>
    </g>
    <text class="lbl" x="70" y="256" id="t-soc" style="font-size:17px">—</text>
    <text class="lbl" x="70" y="322" id="t-bat">—</text>
    <text class="sub" x="70" y="337" id="t-batinfo"></text>
    <text class="tag" x="70" y="188" id="t-batstate">batterie</text>
    ${[1, 2].map((n, i) => `
    <g id="mb${n}" style="display:none">
      <text class="tag" x="6" y="${352 + i * 14}" style="text-anchor:start;font-size:9px;letter-spacing:.5px">${n === 1 ? (c.battery1_name || "B1") : (c.battery2_name || "B2")}</text>
      <rect x="48" y="${345 + i * 14}" width="42" height="7" rx="3.5" fill="rgba(255,255,255,.1)"/>
      <rect id="mb${n}-f" x="48" y="${345 + i * 14}" width="0" height="7" rx="3.5" fill="#06d6a0"/>
      <text class="sub" id="mb${n}-t" x="94" y="${352 + i * 14}" style="text-anchor:start;font-size:10px;font-weight:700;fill:#fff">—</text>
    </g>`).join("")}

    <!-- ONDULEUR -->
    <rect x="162" y="212" width="76" height="76" rx="20" fill="url(#gInv)" stroke="#6c7fd8" stroke-width="2"/>
    <g class="inv-arrows" stroke="#a9b6ff" stroke-width="3.5" fill="none" stroke-linecap="round">
      <path d="M185,240 A20,20 0 0,1 218,244"/><path d="M215,262 A20,20 0 0,1 182,256"/>
      <path d="M212,236 L219,245 L208,247" /><path d="M188,264 L181,255 L192,253"/>
    </g>
    <text class="tag" x="200" y="304">onduleur</text>

    <!-- RÉSEAU -->
    <g stroke="#7ab8ff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)">
      <path d="M318,292 L330,212 L342,292"/><path d="M314,232 L346,232"/><path d="M310,250 L350,250"/>
      <path d="M322,250 L338,272 M338,250 L322,272"/>
    </g>
    <text class="lbl" x="330" y="322" id="t-grid">—</text>
    <text class="tag" x="330" y="200" id="t-gridstate">réseau</text>

    <!-- MAISON -->
    <g transform="translate(130,392)">
      <path d="M-36,0 L0,-30 L36,0" stroke="#c77dff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
      <rect x="-27" y="-2" width="54" height="40" rx="5" fill="rgba(199,125,255,.12)" stroke="#c77dff" stroke-width="3"/>
      <rect class="win" id="w1" x="-18" y="6" width="12" height="11" rx="2" fill="#2a2f4a"/>
      <rect class="win" id="w2" x="6" y="6" width="12" height="11" rx="2" fill="#2a2f4a"/>
      <rect x="-6" y="20" width="12" height="18" rx="2" fill="#c77dff"/>
    </g>
    <text class="lbl" x="130" y="452" id="t-home">—</text>
    <text class="tag" x="130" y="466">maison</text>

    <!-- VOITURE -->
    <g id="car-g">
    <g transform="translate(272,402)">
      <path d="M-40,8 L-36,-6 Q-30,-20 -14,-22 L12,-22 Q26,-22 34,-8 L42,-4 Q46,-2 46,6 L46,12 L-40,12 Z"
            fill="rgba(76,201,240,.15)" stroke="#4cc9f0" stroke-width="3" stroke-linejoin="round" filter="url(#glow)"/>
      <path d="M-26,-8 Q-22,-17 -12,-17 L-2,-17 L-2,-8 Z M4,-17 L12,-17 Q22,-17 27,-8 L4,-8 Z" fill="#4cc9f0" opacity=".5"/>
      <circle cx="-22" cy="13" r="8" fill="#0b1020" stroke="#4cc9f0" stroke-width="3"/>
      <circle cx="28" cy="13" r="8" fill="#0b1020" stroke="#4cc9f0" stroke-width="3"/>
      <path id="bolt" class="bolt" d="M4,-44 L-6,-28 L1,-28 L-3,-14 L10,-32 L3,-32 Z" fill="#ffd166" style="display:none"/>
    </g>
    <text class="lbl" x="272" y="452" id="t-car">—</text>
    <text class="tag" x="272" y="466" id="t-carname">${c.car_name}</text>
    </g>
  </svg>
${this._aplHtml()}

  <div class="bar"><i id="barfill"></i></div>
  <div class="barlbl"><span>Autoconsommation du jour</span><span id="t-autoday">—</span></div>

  <div class="stats">
    <div class="chip"><div class="k">☀️ Production</div><div class="v" id="d-pv">—</div></div>
    <div class="chip"><div class="k">🏠 Consommation</div><div class="v" id="d-load">—</div></div>
    <div class="chip"><div class="k">🔋 Batterie</div><div class="v" id="d-bat">—</div></div>
    <div class="chip"><div class="k">⚡ Achat</div><div class="v" id="d-imp">—</div></div>
    <div class="chip"><div class="k">💸 Vente</div><div class="v" id="d-exp">—</div></div>
    <div class="chip"><div class="k">🚗 ${c.car_name}</div><div class="v" id="d-car">—</div></div>
  </div>
</ha-card>`;
    this._built = true;
  }

  /* ---------- bloc appareils (optionnel, jusqu'à 8) ---------- */
  _aplHtml() {
    const list = (this._config.appliances || []).slice(0, 8);
    if (!list.length) return "";
    const PAL = ["#ff8fab", "#ffd166", "#06d6a0", "#4cc9f0", "#c77dff", "#f78c6b", "#7ab8ff", "#b5e48c"];
    const cx = 200, cy = 162, n = list.length;
    const nTop = Math.ceil(n / 2), nBot = n - nTop;
    const nodes = list.map((a, i) => {
      const top = i < nTop, k = top ? i : i - nTop, cnt = top ? nTop : nBot;
      const x = (400 / cnt) * (k + 0.5), y = top ? 74 : 250;
      const col = a.color || PAL[i % PAL.length];
      const ic = a.icon || "🔌";
      const icon = ic.startsWith("mdi:")
        ? `<foreignObject x="-13" y="-13" width="26" height="26"><ha-icon icon="${ic}" style="--mdc-icon-size:22px;color:${col};display:flex;justify-content:center"></ha-icon></foreignObject>`
        : `<text class="apl-emoji">${ic}</text>`;
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
      const x1 = cx + (dx / d) * 34, y1 = cy + (dy / d) * 34, x2 = x - (dx / d) * 25, y2 = y - (dy / d) * 25;
      return { i, x, y, top, col, icon, name: a.name || "Appareil " + (i + 1), path: `M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}` };
    });
    return `
  <div class="apl-head"><b>🔌 Appareils</b><span id="apl-sum"></span></div>
  <svg viewBox="0 0 400 322" xmlns="http://www.w3.org/2000/svg" style="margin-top:0">
    ${nodes.map((o) => `<path id="p-apl-${o.i}" class="wire" d="${o.path}"/>`).join("")}
    ${nodes.map((o) => `<g id="f-apl-${o.i}"></g>`).join("")}
    <g transform="translate(${cx},${cy})">
      <circle r="34" fill="rgba(199,125,255,.12)" stroke="#c77dff" stroke-width="2.5" filter="url(#glow)"/>
      <path d="M-13,-2 L0,-13 L13,-2 M-9,-4 L-9,10 L9,10 L9,-4" stroke="#c77dff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(0,-8)"/>
      <text class="lbl" y="18" id="apl-home" style="font-size:12.5px">—</text>
    </g>
    ${nodes.map((o) => `
    <g class="apl-node off" id="apl-n-${o.i}" data-i="${o.i}" transform="translate(${o.x.toFixed(1)},${o.y.toFixed(1)})">
      <circle r="24" fill="rgba(255,255,255,.05)"/>
      <circle class="ring" r="24" fill="none" stroke="${o.col}" stroke-width="2.5" stroke-opacity=".35"/>
      ${o.icon}
      <text class="tag" y="${o.top ? -60 : 37}" style="font-size:8.5px">${o.name}</text>
      <text class="lbl" y="${o.top ? -45 : 52}" id="apl-v-${o.i}" style="font-size:13px">—</text>
      <text class="sub" y="${o.top ? -32 : 65}" id="apl-d-${o.i}" style="font-size:9px"></text>
    </g>`).join("")}
  </svg>`;
  }

  _aplUpdate(load) {
    const list = (this._config.appliances || []).slice(0, 8);
    if (!list.length) return;
    const PAL = ["#ff8fab", "#ffd166", "#06d6a0", "#4cc9f0", "#c77dff", "#f78c6b", "#7ab8ff", "#b5e48c"];
    let sum = 0, on = 0;
    list.forEach((a, i) => {
      const w = this._w(a.entity);
      const node = this._$("apl-n-" + i);
      if (!node) return;
      const active = w !== null && w >= (a.threshold || 5);
      if (w !== null) sum += Math.max(0, w);
      if (active) on++;
      node.classList.toggle("on", active);
      node.classList.toggle("off", !active);
      this._txt("apl-v-" + i, w === null ? "—" : this._fw(w));
      const d = this._kwh(a.energy_today);
      this._txt("apl-d-" + i, d === null ? "" : d.toFixed(1).replace(".", ",") + " kWh auj.");
      this._flow("apl-" + i, active ? w : null, a.color || PAL[i % PAL.length]);
      if (!node._click) {
        node._click = true;
        node.addEventListener("click", () => {
          const ev = new Event("hass-more-info", { bubbles: true, composed: true });
          ev.detail = { entityId: a.entity };
          this.dispatchEvent(ev);
        });
      }
    });
    this._txt("apl-home", this._fw(load));
    const rest = load !== null ? Math.max(0, load - sum) : null;
    this._txt("apl-sum", `${on} en marche · ${this._fw(sum)}` + (rest !== null ? ` · autres ${this._fw(rest)}` : ""));
  }

  _$(id) {
    return this.shadowRoot.getElementById(id);
  }
  _txt(id, t) {
    const e = this._$(id);
    if (e && e.textContent !== t) e.textContent = t;
  }

  /* flux animé : w > 0 = vers l'onduleur, w < 0 = depuis l'onduleur */
  _flow(name, w, color) {
    const g = this._$("f-" + name);
    if (!g) return;
    let key = "off", html = "";
    if (w !== null && Math.abs(w) >= 15) {
      const a = Math.abs(w);
      const dur = Math.max(0.6, 3.4 - Math.log10(a) * 0.75).toFixed(1);
      const n = a > 3000 ? 5 : a > 1000 ? 4 : a > 300 ? 3 : 2;
      const r = a > 2500 ? 4.5 : a > 800 ? 3.8 : 3;
      const fwd = w > 0;
      key = `${fwd}|${dur}|${n}|${r}|${color}`;
      html =
        `<use href="#p-${name}" stroke="${color}" stroke-opacity=".28" stroke-width="6" fill="none" stroke-linecap="round"/>` +
        [...Array(n)].map((_, i) =>
          `<circle r="${r}" fill="${color}" filter="url(#glow)">
             <animateMotion dur="${dur}s" repeatCount="indefinite" begin="-${((dur * i) / n).toFixed(2)}s"
               keyPoints="${fwd ? "0;1" : "1;0"}" keyTimes="0;1" calcMode="linear"><mpath href="#p-${name}"/></animateMotion>
           </circle>`).join("");
    }
    if (this._keys[name] !== key) {
      this._keys[name] = key;
      g.innerHTML = html;
    }
  }

  _update() {
    if (!this._built || !this._hass) return;
    const c = this._config;

    // puissances instantanées
    let pv = this._w(c.pv_power);
    if (pv === null && (c.pv1_power || c.pv2_power)) pv = (this._w(c.pv1_power) || 0) + (this._w(c.pv2_power) || 0);
    let bat = this._w(c.battery_power); // + = décharge
    if (bat !== null && c.invert_battery) bat = -bat;
    let grid = this._w(c.grid_power); // + = achat
    if (grid !== null && c.invert_grid) grid = -grid;
    const loadE = this._w(c.load_power);
    const loadN = this._w(c.load_non_essential_power);
    const load = loadE === null && loadN === null ? null : (loadE || 0) + (loadN || 0);
    const car = this._w(c.car_power);
    const soc = this._raw(c.battery_soc);
    const carSoc = this._raw(c.car_soc);

    // jour / nuit
    const sunEnt = this._st("sun.sun");
    const night = sunEnt ? sunEnt.state === "below_horizon" : (pv || 0) < 20;
    this._$("sun").style.display = night ? "none" : "";
    this._$("moon").style.display = night ? "" : "none";
    const rays = this._$("rays");
    if (rays) rays.style.animationDuration = Math.max(3, 24 - ((pv || 0) / 1000) * 3) + "s";

    // flux
    this._flow("pv", pv, "#ffd166");
    this._flow("bat", bat, bat !== null && bat < 0 ? "#06d6a0" : "#ff8fab");
    this._flow("grid", grid, grid !== null && grid < 0 ? "#06d6a0" : "#7ab8ff");
    this._flow("home", load === null ? null : -load, "#c77dff");
    this._flow("car", car === null ? null : -car, "#4cc9f0");

    // textes
    this._txt("t-pv", (night ? "🌙 " : "☀️ ") + this._fw(pv));
    this._txt("t-soc", soc === null ? "—" : Math.round(soc) + "%");
    this._txt("t-bat", this._fw(bat));
    const bv = this._raw(c.battery_voltage), bt = this._raw(c.battery_temperature);
    this._txt("t-batinfo", [bv !== null ? this._f(bv, 1, "V") : null, bt !== null ? this._f(bt, 1, "°C") : null].filter(Boolean).join(" · "));
    this._txt("t-batstate", bat === null || Math.abs(bat) < 15 ? "batterie" : bat > 0 ? "décharge" : "charge");
    this._txt("t-grid", this._fw(grid));
    this._txt("t-gridstate", grid === null || Math.abs(grid) < 15 ? "réseau" : grid > 0 ? "achat" : "vente");
    this._txt("t-home", this._fw(load));
    const carCharging = car !== null && car >= 15;
    this._txt("t-car", carSoc !== null ? "🔋 " + Math.round(carSoc) + " %" : carCharging ? this._fw(car) : "—");
    this._txt("t-carname", c.car_name + (carCharging ? " · " + this._fw(car) : ""));

    // batteries individuelles
    [[1, c.battery1_soc], [2, c.battery2_soc]].forEach(([n, id]) => {
      const g = this._$("mb" + n);
      if (!g) return;
      const v = this._raw(id);
      if (!id) { g.style.display = "none"; return; }
      g.style.display = "";
      const f = this._$("mb" + n + "-f");
      const pct = v === null ? 0 : Math.max(0, Math.min(100, v));
      f.setAttribute("width", (42 * pct) / 100);
      f.setAttribute("fill", pct < 20 ? "#ef476f" : pct < 40 ? "#ffb703" : "#06d6a0");
      this._txt("mb" + n + "-t", v === null ? "—" : Math.round(v) + " %");
    });

    // champs PV supplémentaires (+ alerte si données anciennes)
    (c.extra_pv || []).forEach((p, i) => {
      const s = this._st(p.entity);
      const v = this._w(p.entity);
      const ve = this._$("xpv-v-" + i), ae = this._$("xpv-a-" + i);
      if (!ve) return;
      if (!s || s.state === "unavailable" || s.state === "unknown") {
        ve.textContent = "—";
        ae.textContent = "hors ligne";
        ae.style.fill = "#ef476f";
        return;
      }
      ve.textContent = this._fw(v);
      const t = new Date(s.last_reported || s.last_updated || s.last_changed).getTime();
      const min = (Date.now() - t) / 60000;
      const lim = p.stale_minutes || 30;
      // pas d'alerte la nuit ni à 0 W : un capteur à 0 constant ne se met pas à jour, c'est normal
      if (min > lim && !night && (v || 0) > 0) {
        ae.textContent = "⚠ il y a " + (min >= 120 ? Math.round(min / 60) + " h" : Math.round(min) + " min");
        ae.style.fill = "#ffb703";
      } else {
        ae.textContent = "";
      }
    });

    // batterie : remplissage + vague
    if (soc !== null) {
      const h = Math.max(0, Math.min(100, soc)) * 0.94;
      const y = 297 - h;
      const col = soc < 20 ? "#ef476f" : soc < 40 ? "#ffb703" : "#06d6a0";
      const rect = this._$("batrect");
      rect.setAttribute("y", y + 4);
      rect.setAttribute("height", h);
      rect.setAttribute("fill", col);
      let d = `M0,${y + 5}`;
      for (let x = 0; x <= 180; x += 15) d += ` Q${x + 7.5},${y + (x % 30 ? 9 : 0)} ${x + 15},${y + 5}`;
      d += ` L195,${y + 12} L0,${y + 12} Z`;
      const wave = this._$("batwave");
      wave.setAttribute("d", d);
      wave.setAttribute("fill", col);
    }

    // maison : fenêtres allumées
    const lit = (load || 0) > 50;
    this._$("w1").setAttribute("fill", lit ? "#ffd166" : "#2a2f4a");
    this._$("w2").setAttribute("fill", (load || 0) > 1500 ? "#ffd166" : "#2a2f4a");

    // voiture
    this._$("bolt").style.display = car !== null && car >= 15 ? "" : "none";

    // autonomie instantanée
    let auto = null;
    if (load !== null && load > 0) auto = Math.max(0, Math.min(100, ((load - Math.max(grid || 0, 0)) / load) * 100));
    this._txt("auto", auto === null ? "—" : Math.round(auto) + "%");

    // jour
    const dPv = this._kwh(c.pv_today), dLoad = this._kwh(c.load_today),
      dCh = this._kwh(c.battery_charge_today), dDis = this._kwh(c.battery_discharge_today),
      dImp = this._kwh(c.grid_import_today), dExp = this._kwh(c.grid_export_today), dCar = this._kwh(c.car_today);
    this._txt("d-pv", this._fk(dPv));
    this._txt("d-load", this._fk(dLoad));
    this._$("d-bat").innerHTML = `${dCh === null ? "—" : "↑" + dCh.toFixed(1).replace(".", ",")} <small>/ ${dDis === null ? "—" : "↓" + dDis.toFixed(1).replace(".", ",")} kWh</small>`;
    this._txt("d-imp", this._fk(dImp));
    this._txt("d-exp", this._fk(dExp));
    this._txt("d-car", dCar !== null ? this._fk(dCar) : carSoc !== null ? Math.round(carSoc) + " %" : "—");
    let autoDay = null;
    if (dLoad && dImp !== null) autoDay = Math.max(0, Math.min(100, ((dLoad - dImp) / dLoad) * 100));
    this._$("barfill").style.width = (autoDay || 0) + "%";
    this._txt("t-autoday", autoDay === null ? "—" : Math.round(autoDay) + " %");

    // voiture masquée si non configurée
    this._$("car-g").style.display = c.car_power || c.car_soc ? "" : "none";
    this._$("p-car").style.display = c.car_power || c.car_soc ? "" : "none";
    if (!(c.car_power || c.car_soc)) this._flow("car", null, "");
    this._$("d-car").parentElement.style.display = c.car_power || c.car_soc || c.car_today ? "" : "none";

    // appareils
    this._aplUpdate(load);

    // humeur du moment
    let mood;
    if (car !== null && car >= 15) mood = `🚗 La ${c.car_name} fait le plein d'électrons…`;
    else if (night && bat !== null && bat > 15) mood = "🌙 Bonne nuit, la batterie veille sur la maison.";
    else if (night) mood = "🌙 Le soleil dort, tout est calme.";
    else if ((pv || 0) > (load || 0) + 200 && bat !== null && bat < -15) mood = "☀️ Le soleil fait tout le boulot et remplit la batterie !";
    else if ((pv || 0) > (load || 0)) mood = "😎 100 % soleil, la maison tourne gratis.";
    else if (grid !== null && grid > 300) mood = "🔌 On pioche un peu sur le réseau.";
    else if (bat !== null && bat > 15) mood = "🔋 La batterie prend le relais.";
    else mood = "⚡ Tout roule.";
    if (soc !== null && soc < 20) mood = "🪫 Batterie basse, on économise !";
    this._txt("mood", mood);
  }

  static getStubConfig() {
    return { title: "Mon énergie" };
  }
}

customElements.define("energie-flow-card", EnergieFlowCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "energie-flow-card", name: "Energie Flow Card", description: "Flux d'énergie animé et coloré" });
