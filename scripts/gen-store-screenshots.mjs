#!/usr/bin/env node
/**
 * App Store screenshot generator.
 *
 * Apple asks for one set at 1242 × 2688 (iPhone 6.5") and one at 2064 × 2752
 * (iPad 13"). Both are rendered here from HTML with headless Chrome, so the
 * marketing frames stay in the repo as source instead of living in a designer's
 * Figma file: change a caption, re-run, upload.
 *
 *   node scripts/gen-store-screenshots.mjs
 *
 * Output: store/appstore/iphone-6.5/*.png and store/appstore/ipad-13/*.png
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'store/appstore');
const WORK = resolve(OUT, '.build');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// --- Brand ------------------------------------------------------------------
const INK = '#082D36';
const INK_DEEP = '#04191F';
const LIME = '#E7FFA4';
const CLOUD = '#F6F7F9';
const MUTED_FG = '#40606B';
const BORDER = '#E2E6E9';

const MARK = `<svg viewBox="48.5 19 164 224" fill="none"><path d="M71.11 20.01L49.73 31.98L49.69 57.88L167.31 94.24L158.3 98.35L53.75 164.66L60.33 166.53L50.29 172.2L49.87 172.89L50.08 198.1L189.43 241.62L190.33 241.64L211.12 229.99L211.41 203.61L210.88 203.22L104.29 170.12L120.37 168.66L198.43 122.65L210.21 94.67L204.5 92.93L210.77 89.28L210.88 62.98L147.32 43.12L73.16 20.34ZM71.7 21.67L208.09 63.73L189.1 74.84L52.11 32.56ZM189.59 76.31L189.43 99.93L189.16 76.16ZM202.91 93.86L207.34 95.23L187.04 105.77L161.33 98.48L169.27 94.83L189.6 101.19ZM202.99 108.51L197.98 120.47L188.1 106.72L207.95 96.58ZM192.08 114.62L197.1 121.88L119.95 167.36L85.66 170.24L186.93 107.43ZM72.3 169.55L81.57 171.97L99.74 170.49L208.63 204.25L189.56 215.34L52.94 172.78L62.87 167.13ZM189.87 217.02L189.92 240.22L189.49 240.63L189.52 218.32L189.57 217.09Z" fill="CURRENT" stroke="CURRENT" stroke-width="2"/></svg>`;
const mark = (color) => MARK.replaceAll('CURRENT', color);

// Small line icons, drawn here rather than pulled from Ionicons so the frames
// render without a webfont round-trip.
const ICON = {
  grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  albums: '<path d="M4 8h16v12H4zM6 5h12M8 2h8"/>',
  calendar: '<path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  eye: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/>',
  send: '<path d="M3 12l18-8-7 18-3-7z"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  bell: '<path d="M6 9a6 6 0 1112 0v6l2 3H4l2-3z"/>',
};
const icon = (name, color, size = 22, w = 1.7) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;

// --- App UI fragments -------------------------------------------------------
const statusBar = `<div class="status"><span>9:41</span><span class="bars"><i></i><i></i><i></i></span></div>`;

// The real dock: a floating ink pill, icon-only, with the landing tab sitting
// in a notch carved out of the top-centre as a lime circle wearing the Z.
// Mirrors src/components/brand-tab-bar.tsx — keep the two in step.
const DOCK_TABS = [
  ['albums', 'Leads'], ['calendar', 'Planning'], ['chat', 'Live Chat'], ['settings', 'Settings'],
];
const tabBar = (active, d) => {
  const side = (i) => {
    const [ic] = DOCK_TABS[i];
    const on = active === DOCK_TABS[i][1];
    return `<div class="dtab ${on ? 'on' : ''}">${on ? '<i class="halo"></i>' : ''}${icon(ic, on ? LIME : 'rgba(246,247,249,.6)', d.dk * 26, 1.8)}</div>`;
  };
  return `<div class="dockwrap"><div class="dock">
    <div class="notch"><span></span></div>
    ${side(0)}${side(1)}
    <div class="dtab fabslot"><div class="fab ${active === 'Dashboard' ? '' : 'off'}">${mark(INK)}</div></div>
    ${side(2)}${side(3)}
  </div></div>`;
};

const tile = (label, value, delta, ic) => `
  <div class="tile">
    <div class="tile-h">${icon(ic, MUTED_FG, 17)}<span>${label}</span></div>
    <div class="tile-v">${value}</div>
    <div class="tile-d ${delta.startsWith('+') ? 'up' : ''}">${delta}</div>
  </div>`;

const action = (title, sub, badge) => `
  <div class="row">
    <div class="row-dot"></div>
    <div class="row-t"><b>${title}</b><span>${sub}</span></div>
    ${badge ? `<div class="pill">${badge}</div>` : ''}
  </div>`;

const leadCard = (name, place, price, status, tone, when, hue) => `
  <div class="lead">
    <div class="shot" style="--h:${hue}"></div>
    <div class="lead-b">
      <div class="lead-r"><b>${name}</b><span class="price">${price}</span></div>
      <div class="lead-r"><span class="sub">${place}</span><span class="sub">${when}</span></div>
      <div class="status ${tone}"><i></i>${status}</div>
    </div>
  </div>`;

const bubble = (text, mine, time) => `
  <div class="bub ${mine ? 'mine' : ''}"><p>${text}</p><time>${time}</time></div>`;

const agenda = (time, title, sub, kind) => `
  <div class="ag ${kind}">
    <div class="ag-t">${time}</div>
    <div class="ag-b"><b>${title}</b><span>${sub}</span></div>
  </div>`;

// --- Screens ----------------------------------------------------------------
const SCREENS = [
  {
    file: '1-dashboard',
    headline: 'Your showroom,<br><em>in your pocket</em>',
    sub: 'Today’s leads, offers and visitors the moment you open the app.',
    body: (device) => `
      ${statusBar}
      <div class="app">
        <div class="hello"><h2>Hi, Bram 👋</h2><span>Valk Veranda B.V.</span></div>
        <div class="tiles">${tile('Leads today', '12', '+4 vs yesterday', 'albums')}${tile('Offers sent', '7', '+2 vs yesterday', 'send')}</div>
        <div class="tiles">${tile('Visitors', '284', 'today', 'eye')}${tile('Requests', '19', 'today', 'check')}</div>
        <h3>Action required</h3>
        <div class="card">
          ${action('3 offers waiting on an answer', 'Sent more than 5 days ago', '3')}
          ${action('2 requests need review', 'Configuration incomplete', '2')}
          ${action('1 visit to confirm', 'Tomorrow, 10:00', '')}
        </div>
        <h3>On your site now</h3>
        <div class="card">
          ${action('Amsterdam, NL', 'Filling in the form · 4m', 'live')}
          ${action('Antwerpen, BE', 'Looking around · 1m', 'live')}
          ${action('Eindhoven, NL', 'Configuring a veranda · 6m', 'live')}
        </div>
      </div>
      ${tabBar('Dashboard', device)}`,
  },
  {
    file: '2-leads',
    headline: 'Every request,<br><em>with the render</em>',
    sub: 'You recognise the configuration before you read the name.',
    body: (device) => `
      ${statusBar}
      <div class="app">
        <div class="nav"><h2>Leads</h2><div class="count">38 open</div></div>
        <div class="segs"><span class="on">New</span><span>Sent</span><span>Approved</span><span>Declined</span></div>
        ${leadCard('Familie de Vries', 'Utrecht · Veranda 6 × 3.5 m', '€ 8.940', 'Needs review', 'bad', '12m', '86')}
        ${leadCard('J. Peeters', 'Breda · Free-standing 4 × 3 m', '€ 6.410', 'Offer sent', 'info', '2h', '150')}
        ${leadCard('M. Janssen', 'Gent · Glasschuifwand', '€ 3.280', 'Signed', 'good', '1d', '30')}
      </div>
      ${tabBar('Leads', device)}`,
  },
  {
    file: '3-chat',
    headline: 'Answer while<br><em>they’re still there</em>',
    sub: 'Live chat from your website, answered wherever you are.',
    body: (device) => `
      ${statusBar}
      <div class="app chat-bg">
        <div class="chead">
          <div class="av">SD</div>
          <div><b>Sanne Dekker</b><span>Online · 2 offers</span></div>
        </div>
        <div class="thread">
          ${bubble('Hi! Can the veranda be 6.5 m wide with only two posts?', false, '14:02')}
          ${bubble('Yes — up to 7 m with the reinforced beam. I’ll put it in your offer.', true, '14:03')}
          ${bubble('Great. And how long is delivery?', false, '14:04')}
          ${bubble('Four to six weeks, installation included.', true, '14:04')}
          ${bubble('Perfect, send it over 🙌', false, '14:05')}
        </div>
        <div class="composer"><span>Write a message…</span><div class="send">${icon('send', INK, 18)}</div></div>
      </div>
      ${tabBar('Live Chat', device)}`,
  },
  {
    file: '4-planning',
    headline: 'Measure, mount,<br><em>done</em>',
    sub: 'Visits, measurements and installations on one calendar.',
    body: (device) => `
      ${statusBar}
      <div class="app">
        <div class="nav"><h2>June 2026</h2><div class="count">Today</div></div>
        <div class="cal">
          ${['M','T','W','T','F','S','S'].map((d) => `<span class="dow">${d}</span>`).join('')}
          ${Array.from({ length: 28 }, (_, i) => {
            const d = i + 1;
            const cls = d === 11 ? 'sel' : [3, 5, 12, 18, 24].includes(d) ? 'dot' : '';
            return `<span class="day ${cls}">${d}</span>`;
          }).join('')}
        </div>
        <div class="segs"><span class="on">All</span><span>Visits</span><span>Follow-ups</span></div>
        ${agenda('09:00', 'On-site measurement', 'Familie de Vries · Utrecht', 'a')}
        ${agenda('11:30', 'Showroom visit', 'J. Peeters · 2 persons', 'b')}
        ${agenda('15:00', 'Installation', 'M. Janssen · Gent · crew of 3', 'c')}
        ${agenda('16:30', 'Call back', 'Familie Bakker · about the sunroof', 'b')}
        ${agenda('17:15', 'Service', 'De Wit · gutter check', 'a')}
      </div>
      ${tabBar('Planning', device)}`,
  },
  {
    file: '5-offer',
    headline: 'From request<br><em>to signed offer</em>',
    sub: 'Build the quote, send it, and watch it get approved.',
    body: (device) => `
      ${statusBar}
      <div class="app">
        <div class="nav back"><h2>Offer #2416</h2><div class="count">Draft</div></div>
        <div class="hero" style="--h:120"></div>
        <div class="card lines">
          <div class="line"><span>Veranda 6.0 × 3.5 m</span><b>€ 6.240</b></div>
          <div class="line"><span>Glasschuifwand, 4 panels</span><b>€ 1.850</b></div>
          <div class="line"><span>LED spots + dimmer</span><b>€ 410</b></div>
          <div class="line"><span>Installation</span><b>€ 440</b></div>
          <div class="line total"><span>Total incl. VAT</span><b>€ 8.940</b></div>
        </div>
        <div class="cta">${icon('send', INK, 19)}<span>Send offer to customer</span></div>
        <div class="hintrow">${icon('bell', MUTED_FG, 16)}<span>You get a push the second they open it.</span></div>
        <h3>History</h3>
        <div class="card">
          ${action('Configuration received', 'Today, 09:12 · from your website', '')}
          ${action('Reviewed by you', 'Today, 09:40', '')}
          ${action('Visit planned', 'Thu 11 June, 09:00 · measurement', '')}
        </div>
      </div>
      ${tabBar('Leads', device)}`,
  },
];

// --- Page -------------------------------------------------------------------
const css = (device) => `
@font-face { font-family: Sora; src: url(Sora-Regular.ttf); font-weight: 400 }
@font-face { font-family: Sora; src: url(Sora-SemiBold.ttf); font-weight: 600 }
@font-face { font-family: Sora; src: url(Sora-Bold.ttf); font-weight: 700 }
@font-face { font-family: Sora; src: url(Sora-ExtraBold.ttf); font-weight: 800 }
* { margin: 0; padding: 0; box-sizing: border-box; -webkit-font-smoothing: antialiased }
body {
  width: ${device.w}px; height: ${device.h}px; overflow: hidden;
  font-family: Sora, system-ui, sans-serif; color: ${CLOUD};
  background: radial-gradient(120% 80% at 50% -10%, #10505F 0%, ${INK} 42%, ${INK_DEEP} 100%);
  display: flex; flex-direction: column; align-items: center;
}
.glow { position: absolute; inset: 0; overflow: hidden; }
.glow::before, .glow::after { content: ''; position: absolute; border-radius: 50%; filter: blur(${device.blur}px); }
.glow::before { width: ${device.w * 0.9}px; height: ${device.w * 0.9}px; left: -20%; top: 8%;
  background: rgba(231,255,164,.11) }
.glow::after { width: ${device.w * 0.8}px; height: ${device.w * 0.8}px; right: -25%; bottom: 4%;
  background: rgba(212,243,76,.07) }
.wrap { position: relative; z-index: 1; width: 100%; height: 100%;
  display: flex; flex-direction: column; align-items: center; padding: ${device.pad}px ${device.pad}px 0 }
.brandrow { display: flex; align-items: center; gap: ${device.gap * 0.5}px; margin-bottom: ${device.gap}px }
.brandrow svg { width: ${device.markW}px; height: ${device.markW * 1.36}px }
.brandrow span { font-weight: 700; letter-spacing: .22em; font-size: ${device.brand}px; color: rgba(246,247,249,.72) }
h1 { font-size: ${device.h1}px; line-height: 1.12; font-weight: 800; text-align: center; letter-spacing: -.02em }
h1 em { font-style: normal; color: ${LIME} }
.lede { margin-top: ${device.gap * 0.7}px; font-size: ${device.sub}px; line-height: 1.45; font-weight: 400;
  color: rgba(246,247,249,.94); text-align: center; max-width: ${device.subW}px }
.stage { flex: 1; width: 100%; display: flex; justify-content: center; align-items: flex-end;
  margin-top: ${device.gap * 1.4}px }

/* Device frame */
.frame { width: ${device.frameW}px; height: ${device.frameH}px; background: #05171C;
  border-radius: ${device.radius}px; padding: ${device.bezel}px;
  box-shadow: 0 ${device.bezel * 3}px ${device.bezel * 9}px rgba(0,0,0,.55),
              0 0 0 ${device.bezel * 0.34}px rgba(246,247,249,.10);
}
.screen { width: 100%; height: 100%; background: ${CLOUD}; border-radius: ${device.radius - device.bezel}px;
  overflow: hidden; position: relative; display: flex; flex-direction: column;
  font-size: ${device.ui}px; color: ${INK}; }

/* App chrome */
.status { display: flex; justify-content: space-between; align-items: center;
  padding: ${device.ui * 1.1}px ${device.ui * 1.5}px ${device.ui * 0.2}px; font-size: ${device.ui * 0.86}px; font-weight: 600 }
.status .bars { display: flex; gap: ${device.ui * 0.22}px; align-items: flex-end }
.status .bars i { width: ${device.ui * 0.22}px; background: ${INK}; border-radius: 2px }
.status .bars i:nth-child(1) { height: ${device.ui * 0.4}px }
.status .bars i:nth-child(2) { height: ${device.ui * 0.6}px }
.status .bars i:nth-child(3) { height: ${device.ui * 0.8}px }
.app { flex: 1; padding: ${device.ui * 0.9}px ${device.ui * 1.25}px ${device.dk * 92}px; overflow: hidden }

.hello h2, .nav h2 { font-size: ${device.ui * 1.5}px; font-weight: 700; letter-spacing: -.01em }
.hello span { font-size: ${device.ui * 0.9}px; color: ${MUTED_FG} }
.nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: ${device.ui * 0.9}px }
.count { font-size: ${device.ui * 0.82}px; font-weight: 600; color: ${MUTED_FG};
  background: #fff; border: 1px solid ${BORDER}; padding: ${device.ui * 0.3}px ${device.ui * 0.7}px; border-radius: 999px }
.hello { margin-bottom: ${device.ui}px }
h3 { font-size: ${device.ui}px; font-weight: 600; margin: ${device.ui * 1.15}px 0 ${device.ui * 0.55}px }

.tiles { display: flex; gap: ${device.ui * 0.7}px; margin-bottom: ${device.ui * 0.7}px }
.tile { flex: 1; background: #fff; border: 1px solid ${BORDER}; border-radius: ${device.ui * 1.05}px;
  padding: ${device.ui * 0.85}px; box-shadow: 0 2px 8px rgba(8,45,54,.05) }
.tile-h { display: flex; align-items: center; gap: ${device.ui * 0.35}px; font-size: ${device.ui * 0.82}px; color: ${MUTED_FG} }
.tile-v { font-size: ${device.ui * 1.85}px; font-weight: 700; margin-top: ${device.ui * 0.25}px; letter-spacing: -.02em }
.tile-d { font-size: ${device.ui * 0.75}px; color: ${MUTED_FG} }
.tile-d.up { color: #16A34A; font-weight: 600 }

.card { background: #fff; border: 1px solid ${BORDER}; border-radius: ${device.ui * 1.05}px; overflow: hidden;
  box-shadow: 0 2px 8px rgba(8,45,54,.05) }
.row { display: flex; align-items: center; gap: ${device.ui * 0.7}px; padding: ${device.ui * 0.8}px ${device.ui * 0.9}px;
  border-bottom: 1px solid ${BORDER} }
.row:last-child { border-bottom: 0 }
.row-dot { width: ${device.ui * 0.5}px; height: ${device.ui * 0.5}px; border-radius: 50%; background: ${LIME};
  box-shadow: 0 0 0 ${device.ui * 0.2}px rgba(231,255,164,.35); flex: none }
.row-t { flex: 1; display: flex; flex-direction: column }
.row-t b { font-size: ${device.ui * 0.95}px; font-weight: 600 }
.row-t span { font-size: ${device.ui * 0.8}px; color: ${MUTED_FG} }
.pill { font-size: ${device.ui * 0.72}px; font-weight: 700; background: ${INK}; color: ${LIME};
  padding: ${device.ui * 0.2}px ${device.ui * 0.5}px; border-radius: 999px }

.segs { display: flex; gap: ${device.ui * 0.4}px; margin-bottom: ${device.ui * 0.9}px }
.segs span { font-size: ${device.ui * 0.82}px; font-weight: 600; color: ${MUTED_FG};
  padding: ${device.ui * 0.35}px ${device.ui * 0.8}px; border-radius: 999px; background: #fff; border: 1px solid ${BORDER} }
.segs span.on { background: ${INK}; color: ${LIME}; border-color: ${INK} }

.lead { background: #fff; border: 1px solid ${BORDER}; border-radius: ${device.ui * 1.05}px; overflow: hidden;
  margin-bottom: ${device.ui * 0.75}px; box-shadow: 0 2px 10px rgba(8,45,54,.06) }
.shot { height: ${device.ui * 7}px;
  background: linear-gradient(160deg, hsl(var(--h) 30% 78%), hsl(var(--h) 22% 52%) 60%, hsl(200 25% 32%));
  position: relative }
.shot::after { content: ''; position: absolute; inset: 12% 10% 0;
  border: ${device.ui * 0.16}px solid rgba(255,255,255,.55); border-bottom: 0;
  border-radius: ${device.ui * 0.3}px ${device.ui * 0.3}px 0 0;
  background: linear-gradient(180deg, rgba(255,255,255,.22), rgba(255,255,255,.04)) }
.lead-b { padding: ${device.ui * 0.8}px ${device.ui * 0.9}px; display: flex; flex-direction: column; gap: ${device.ui * 0.25}px }
.lead-r { display: flex; justify-content: space-between; align-items: baseline }
.lead-r b { font-size: ${device.ui}px; font-weight: 600 }
.price { font-weight: 700; font-size: ${device.ui}px }
.sub { font-size: ${device.ui * 0.78}px; color: ${MUTED_FG} }
.lead .status { display: inline-flex; align-items: center; gap: ${device.ui * 0.35}px; padding: 0; margin-top: ${device.ui * 0.2}px;
  font-size: ${device.ui * 0.78}px; font-weight: 600; color: ${MUTED_FG}; justify-content: flex-start }
.lead .status i { width: ${device.ui * 0.4}px; height: ${device.ui * 0.4}px; border-radius: 50%; background: ${MUTED_FG} }
.lead .status.bad { color: #B91C1C } .lead .status.bad i { background: #B91C1C }
.lead .status.good { color: #16A34A } .lead .status.good i { background: #16A34A }
.lead .status.info { color: ${INK} } .lead .status.info i { background: ${INK} }

.chead { display: flex; align-items: center; gap: ${device.ui * 0.7}px; padding-bottom: ${device.ui * 0.9}px;
  border-bottom: 1px solid ${BORDER}; margin-bottom: ${device.ui * 0.9}px }
.av { width: ${device.ui * 2.4}px; height: ${device.ui * 2.4}px; border-radius: 50%; background: ${INK}; color: ${LIME};
  display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: ${device.ui * 0.85}px }
.chead b { display: block; font-size: ${device.ui}px; font-weight: 600 }
.chead span { font-size: ${device.ui * 0.78}px; color: ${MUTED_FG} }
.thread { display: flex; flex-direction: column; gap: ${device.ui * 0.6}px }
.bub { max-width: 78%; background: #fff; border: 1px solid ${BORDER}; border-radius: ${device.ui}px;
  padding: ${device.ui * 0.6}px ${device.ui * 0.8}px; align-self: flex-start }
.bub p { font-size: ${device.ui * 0.92}px; line-height: 1.4 }
.bub time { display: block; margin-top: ${device.ui * 0.2}px; font-size: ${device.ui * 0.68}px; color: ${MUTED_FG} }
.bub.mine { align-self: flex-end; background: ${INK}; border-color: ${INK}; color: ${CLOUD} }
.bub.mine time { color: rgba(246,247,249,.55) }
.composer { margin-top: ${device.ui * 1.1}px; display: flex; align-items: center; justify-content: space-between;
  background: #fff; border: 1px solid ${BORDER}; border-radius: 999px; padding: ${device.ui * 0.55}px ${device.ui * 0.55}px ${device.ui * 0.55}px ${device.ui}px;
  font-size: ${device.ui * 0.9}px; color: ${MUTED_FG} }
.send { width: ${device.ui * 2}px; height: ${device.ui * 2}px; border-radius: 50%; background: ${LIME};
  display: flex; align-items: center; justify-content: center }

.cal { background: #fff; border: 1px solid ${BORDER}; border-radius: ${device.ui * 1.05}px; padding: ${device.ui * 0.8}px;
  display: grid; grid-template-columns: repeat(7, 1fr); gap: ${device.ui * 0.3}px; margin-bottom: ${device.ui}px }
.dow { text-align: center; font-size: ${device.ui * 0.7}px; color: ${MUTED_FG}; font-weight: 600; padding-bottom: ${device.ui * 0.2}px }
.day { text-align: center; font-size: ${device.ui * 0.82}px; padding: ${device.ui * 0.35}px 0; border-radius: ${device.ui * 0.5}px; position: relative }
.day.sel { background: ${INK}; color: ${LIME}; font-weight: 700 }
.day.dot::after { content: ''; position: absolute; left: 50%; bottom: ${device.ui * 0.08}px; transform: translateX(-50%);
  width: ${device.ui * 0.24}px; height: ${device.ui * 0.24}px; border-radius: 50%; background: #7FA02B }
.ag { display: flex; gap: ${device.ui * 0.8}px; background: #fff; border: 1px solid ${BORDER};
  border-left: ${device.ui * 0.3}px solid ${LIME}; border-radius: ${device.ui * 0.8}px;
  padding: ${device.ui * 0.75}px ${device.ui * 0.9}px; margin-bottom: ${device.ui * 0.6}px }
.ag.b { border-left-color: #7FA02B } .ag.c { border-left-color: ${INK} }
.ag-t { font-size: ${device.ui * 0.85}px; font-weight: 700; color: ${MUTED_FG}; width: ${device.ui * 3.2}px }
.ag-b b { display: block; font-size: ${device.ui * 0.95}px; font-weight: 600 }
.ag-b span { font-size: ${device.ui * 0.78}px; color: ${MUTED_FG} }

.nav.back h2::before { content: '‹  '; color: ${MUTED_FG} }
.hero { height: ${device.ui * 8.5}px; border-radius: ${device.ui * 1.05}px; margin-bottom: ${device.ui * 0.9}px;
  background: linear-gradient(160deg, hsl(var(--h) 28% 76%), hsl(var(--h) 20% 48%) 62%, hsl(200 26% 30%)); position: relative }
.hero::after { content: ''; position: absolute; inset: 14% 12% 0;
  border: ${device.ui * 0.18}px solid rgba(255,255,255,.6); border-bottom: 0;
  border-radius: ${device.ui * 0.3}px ${device.ui * 0.3}px 0 0;
  background: linear-gradient(180deg, rgba(255,255,255,.24), rgba(255,255,255,.05)) }
.lines .line { display: flex; justify-content: space-between; padding: ${device.ui * 0.7}px ${device.ui * 0.9}px;
  border-bottom: 1px solid ${BORDER}; font-size: ${device.ui * 0.9}px }
.lines .line b { font-weight: 600 }
.lines .line.total { border-bottom: 0; background: ${CLOUD}; font-weight: 700; font-size: ${device.ui * 1.02}px }
.cta { margin-top: ${device.ui}px; background: ${LIME}; border-radius: 999px; display: flex; align-items: center;
  justify-content: center; gap: ${device.ui * 0.5}px; padding: ${device.ui * 0.85}px;
  font-weight: 700; font-size: ${device.ui * 0.98}px; color: ${INK} }
.hintrow { display: flex; align-items: center; justify-content: center; gap: ${device.ui * 0.4}px;
  margin-top: ${device.ui * 0.7}px; font-size: ${device.ui * 0.78}px; color: ${MUTED_FG} }

.dockwrap { position: absolute; left: 0; right: 0; bottom: 0;
  padding: 0 ${device.dk * 16}px ${device.dk * 14}px; pointer-events: none }
.dock { position: relative; height: ${device.dk * 64}px; border-radius: ${device.dk * 32}px;
  background: ${INK}; display: flex; align-items: center;
  box-shadow: 0 ${device.dk * 8}px ${device.dk * 16}px rgba(0,0,0,.22) }
.notch { position: absolute; inset: 0; border-radius: ${device.dk * 32}px; overflow: hidden }
.notch span { position: absolute; left: 50%; top: ${device.dk * -42}px; margin-left: ${device.dk * -29}px;
  width: ${device.dk * 58}px; height: ${device.dk * 58}px; border-radius: 50%; background: ${CLOUD} }
.dtab { flex: 1; height: 100%; display: flex; align-items: center; justify-content: center; position: relative }
.halo { position: absolute; width: ${device.dk * 46}px; height: ${device.dk * 34}px;
  border-radius: ${device.dk * 17}px; background: rgba(231,255,164,.16) }
.fabslot { overflow: visible }
.fab { position: absolute; top: ${device.dk * -8}px; width: ${device.dk * 60}px; height: ${device.dk * 60}px;
  border-radius: 50%; background: ${LIME}; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 ${device.dk * 4}px ${device.dk * 9}px rgba(0,0,0,.24) }
.fab.off { opacity: .9 }
.fab svg { width: ${device.dk * 22}px; height: ${device.dk * 30}px }
`;

const page = (device, screen) => `<!doctype html><html><head><meta charset="utf-8"><style>${css(device)}</style></head>
<body><div class="glow"></div><div class="wrap">
  <div class="brandrow">${mark(LIME)}<span>ZINEVU</span></div>
  <h1>${screen.headline}</h1>
  <p class="lede">${screen.sub}</p>
  <div class="stage"><div class="frame"><div class="screen">${screen.body(device)}</div></div></div>
</div></body></html>`;

// --- Devices ----------------------------------------------------------------
// CSS pixels are half the target, rendered at device-scale-factor 2.
const DEVICES = [
  {
    name: 'iphone-6.5', w: 621, h: 1344, scale: 2,
    pad: 42, gap: 18, markW: 26, brand: 13, h1: 50, sub: 17, subW: 470,
    frameW: 466, frameH: 960, radius: 48, bezel: 9, ui: 16, blur: 90, dk: 1.05,
  },
  {
    name: 'ipad-13', w: 1032, h: 1376, scale: 2,
    pad: 64, gap: 22, markW: 34, brand: 17, h1: 66, sub: 23, subW: 720,
    frameW: 812, frameH: 1024, radius: 44, bezel: 13, ui: 22, blur: 130, dk: 1.3,
  },
];

// --- Render -----------------------------------------------------------------
mkdirSync(WORK, { recursive: true });
const FONTS = {
  'Sora-Regular.ttf': '@expo-google-fonts/sora/400Regular/Sora_400Regular.ttf',
  'Sora-SemiBold.ttf': '@expo-google-fonts/sora/600SemiBold/Sora_600SemiBold.ttf',
  'Sora-Bold.ttf': '@expo-google-fonts/sora/700Bold/Sora_700Bold.ttf',
  'Sora-ExtraBold.ttf': '@expo-google-fonts/sora/800ExtraBold/Sora_800ExtraBold.ttf',
};
for (const [dest, src] of Object.entries(FONTS)) {
  const from = resolve(ROOT, 'node_modules', src);
  if (existsSync(from)) copyFileSync(from, resolve(WORK, dest));
  else console.warn(`! font missing: ${src} — falling back to system sans`);
}

for (const device of DEVICES) {
  const dir = resolve(OUT, device.name);
  mkdirSync(dir, { recursive: true });
  for (const screen of SCREENS) {
    const html = resolve(WORK, `${device.name}-${screen.file}.html`);
    const png = resolve(dir, `${screen.file}.png`);
    writeFileSync(html, page(device, screen));
    execFileSync(CHROME, [
      '--headless', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
      `--force-device-scale-factor=${device.scale}`,
      `--window-size=${device.w},${device.h}`,
      `--screenshot=${png}`,
      `file://${html}`,
    ], { stdio: 'ignore' });
    console.log(`${device.name}/${screen.file}.png  ${device.w * device.scale} × ${device.h * device.scale}`);
  }
}
