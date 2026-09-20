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
 * Output: store/appstore/<device>/<locale>/*.png — one set per store language,
 * captions AND app copy translated, because the Dutch listing is the one most
 * dealers read.
 *
 * The frames wear the zinevu.com design system the app itself moved to in
 * 1.2.0: paper canvas, black structure, lime action, DM Sans with Bricolage
 * Grotesque for display. Nothing here is blurred and no card floats on a
 * shadow — keep it in step with src/global.css and src/lib/theme.ts.
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
const INK = '#000000'; // structure: text, edges
const DEEP = '#082D36'; // the dark surface — ground and dock, never body text
const DEEP_950 = '#04191F';
const LIME = '#E7FFA4';
const PAPER = '#F7F4ED';
const PAPER_DIM = '#EFEBE1';
const CHALK = '#FFFFFF';
const SMOKE = '#5B6566';
const LINE = '#D4D2CC';

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
  plus: '<path d="M12 5v14M5 12h14"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0M17 11a3 3 0 100-6M16.5 14.5A6 6 0 0121 20"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18.5h2"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8M21 7v5M21 7h-5"/>',
};
const icon = (name, color, size = 22, w = 1.7) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;

// --- App UI fragments -------------------------------------------------------
const statusBar = `<div class="status"><span>9:41</span><span class="bars"><i></i><i></i><i></i></span></div>`;

// The real dock: a floating deep pill, icon-only, with the landing tab sitting
// in a notch carved out of the top-centre as a lime circle wearing the Z, edged
// in black like every other brand surface.
// Mirrors src/components/brand-tab-bar.tsx — keep the two in step.
const DOCK_TABS = ['albums', 'calendar', 'chat', 'settings'];
const tabBar = (active, d) => {
  const side = (i) => {
    const on = active === i;
    return `<div class="dtab">${on ? '<i class="halo"></i>' : ''}${icon(DOCK_TABS[i], on ? LIME : 'rgba(247,244,237,.62)', d.dk * 26, 1.8)}</div>`;
  };
  return `<div class="dockwrap"><div class="dock">
    <div class="notch"><span></span></div>
    ${side(0)}${side(1)}
    <div class="dtab fabslot"><div class="fab">${mark(INK)}</div></div>
    ${side(2)}${side(3)}
  </div></div>`;
};

// src/components/ui/floating-action.tsx — a lime pill with a black edge and a
// black chip carrying the glyph.
const floatingAction = (label, d) => `
  <div class="floatwrap"><div class="floataction">
    <div class="fchip">${icon('plus', LIME, d.ui * 0.95, 2.2)}</div><span>${label}</span>
  </div></div>`;

const tile = (label, value, delta, ic, up = false) => `
  <div class="tile">
    <div class="tile-h">${icon(ic, SMOKE, 17)}<span>${label}</span></div>
    <div class="tile-v">${value}</div>
    <div class="tile-d ${up ? 'up' : ''}">${delta}</div>
  </div>`;

const row = (title, sub, badge, kind = '') => `
  <div class="row">
    <div class="row-dot ${kind}"></div>
    <div class="row-t"><b>${title}</b><span>${sub}</span></div>
    ${badge ? `<div class="pill ${kind}">${badge}</div>` : ''}
  </div>`;

const leadCard = (name, place, price, status, tone, when, render) => `
  <div class="lead">
    <div class="shot" style="background-image:url(${render}.jpg)"></div>
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

// Plain bars, the way the app draws them: deep fill on a paper track, no chart
// library and no gradient.
const bars = (months) => `
  <div class="bars-chart">
    ${months.map(([m, n, h]) => `<div class="bcol"><span class="bn">${n}</span><i style="height:${h}%"></i><span class="bm">${m}</span></div>`).join('')}
  </div>`;

const breakdown = (title, rows) => `
  <h3>${title}</h3>
  <div class="card">
    ${rows.map(([label, share, pct]) => `
      <div class="brow">
        <div class="brow-h"><span>${label}</span><b>${share}</b></div>
        <div class="track"><i style="width:${pct}%"></i></div>
      </div>`).join('')}
  </div>`;

const kpi = (label, value, hint, delta, up = true) => `
  <div class="kpi">
    <span class="kpi-l">${label}</span>
    <div class="kpi-r"><b>${value}</b><em class="${up ? 'up' : 'down'}">${delta}</em></div>
    <span class="kpi-h">${hint}</span>
  </div>`;

// --- Screens ----------------------------------------------------------------
// Every string that appears in a frame lives here twice: `en` for the
// English-language storefronts, `nl` for the Dutch one.
const SCREENS = [
  {
    file: '1-dashboard',
    headline: { en: 'Your showroom,<br><em>in your pocket</em>', nl: 'Je showroom,<br><em>in je zak</em>' },
    sub: {
      en: 'Today’s leads, offers and visitors the moment you open the app.',
      nl: 'De leads, offertes en bezoekers van vandaag zodra je de app opent.',
    },
    t: {
      hello: { en: 'Hi, Bram 👋', nl: 'Hoi, Bram 👋' },
      leads: { en: 'Leads today', nl: 'Leads vandaag' },
      leadsD: { en: '+4 vs yesterday', nl: '+4 t.o.v. gisteren' },
      offers: { en: 'Offers sent', nl: 'Offertes verstuurd' },
      offersD: { en: '+2 vs yesterday', nl: '+2 t.o.v. gisteren' },
      visitors: { en: 'Visitors', nl: 'Bezoekers' },
      requests: { en: 'Requests', nl: 'Aanvragen' },
      today: { en: 'today', nl: 'vandaag' },
      chart: { en: 'Leads per month', nl: 'Leads per maand' },
      chartN: { en: '33 in 6 months', nl: '33 in 6 maanden' },
      live: { en: 'On your site now', nl: 'Nu op je site' },
      a1: { en: 'Filling in the form · 4m', nl: 'Vult het formulier in · 4m' },
      a2: { en: 'Looking around · 1m', nl: 'Kijkt rond · 1m' },
      a3: { en: 'Configuring a veranda · 6m', nl: 'Stelt een veranda samen · 6m' },
      a4: { en: 'Asking for a price · 9m', nl: 'Vraagt een prijs op · 9m' },
      a5: { en: 'Comparing two designs · 11m', nl: 'Vergelijkt twee ontwerpen · 11m' },
    },
    body: (d, s) => `
      ${statusBar}
      <div class="app">
        <div class="hello"><h2>${s.hello}</h2><span>Valk Veranda B.V.</span></div>
        <div class="tiles">${tile(s.leads, '12', s.leadsD, 'albums', true)}${tile(s.offers, '7', s.offersD, 'send', true)}</div>
        <div class="tiles">${tile(s.visitors, '284', s.today, 'eye')}${tile(s.requests, '19', s.today, 'check')}</div>
        <div class="card chart">
          <div class="chart-h"><b>${s.chart}</b><span>${s.chartN}</span></div>
          ${bars([['J', '3', 34], ['F', '4', 45], ['M', '6', 68], ['A', '5', 56], ['M', '7', 79], ['J', '8', 100]])}
        </div>
        <h3>${s.live}</h3>
        <div class="card">
          ${row('Amsterdam, NL', s.a1, 'live', 'live')}
          ${row('Antwerpen, BE', s.a2, 'live', 'live')}
          ${row('Eindhoven, NL', s.a3, 'live', 'live')}
          ${row('Rotterdam, NL', s.a4, 'live', 'live')}
          ${row('Den Haag, NL', s.a5, 'live', 'live')}
        </div>
      </div>
      ${tabBar(-1, d)}`,
  },
  {
    file: '2-leads',
    headline: { en: 'Every request,<br><em>with the render</em>', nl: 'Elke aanvraag,<br><em>met de render</em>' },
    sub: {
      en: 'You recognise the configuration before you read the name.',
      nl: 'Je herkent de configuratie voordat je de naam leest.',
    },
    t: {
      title: { en: 'Leads', nl: 'Leads' },
      count: { en: '38 open', nl: '38 open' },
      segs: { en: ['New', 'Sent', 'Approved', 'Declined'], nl: ['Nieuw', 'Verstuurd', 'Akkoord', 'Afgewezen'] },
      l1: { en: 'Utrecht · Veranda 6 × 3.5 m', nl: 'Utrecht · Veranda 6 × 3,5 m' },
      s1: { en: 'Needs review', nl: 'Nog beoordelen' },
      l2: { en: 'Breda · Free-standing 4 × 3 m', nl: 'Breda · Vrijstaand 4 × 3 m' },
      s2: { en: 'Offer sent', nl: 'Offerte verstuurd' },
      l3: { en: 'Gent · Sliding glass wall', nl: 'Gent · Glasschuifwand' },
      s3: { en: 'Signed', nl: 'Getekend' },
      fab: { en: 'New lead', nl: 'Nieuwe lead' },
    },
    body: (d, s) => `
      ${statusBar}
      <div class="app">
        <div class="nav"><h2>${s.title}</h2><div class="count">${s.count}</div></div>
        <div class="segs">${s.segs.map((x, i) => `<span class="${i === 0 ? 'on' : ''}">${x}</span>`).join('')}</div>
        ${leadCard('Familie de Vries', s.l1, '€ 8.940', s.s1, 'bad', '12m', 'veranda-anthracite')}
        ${leadCard('J. Peeters', s.l2, '€ 6.410', s.s2, 'info', '2h', 'veranda-cream')}
        ${leadCard('M. Janssen', s.l3, '€ 3.280', s.s3, 'good', '1d', 'veranda-black')}
      </div>
      ${floatingAction(s.fab, d)}
      ${tabBar(0, d)}`,
  },
  {
    file: '3-analytics',
    headline: {
      en: 'Your forms,<br><em>as they happen</em>',
      nl: 'Je formulieren,<br><em>terwijl het gebeurt</em>',
    },
    sub: {
      en: 'Who is filling one in right now, where they came from, and what it turns into.',
      nl: 'Wie er nu invult, waar ze vandaan komen en wat het oplevert.',
    },
    t: {
      title: { en: 'Form analytics', nl: 'Formulier-analyse' },
      live: { en: 'On the form now', nl: 'Nu op het formulier' },
      liveHint: { en: 'Refreshes every 15 seconds', nl: 'Ververst elke 15 seconden' },
      v1: { en: 'Dimensions · 2m', nl: 'Afmetingen · 2m' },
      v2: { en: 'Just arrived', nl: 'Net aangekomen' },
      days: { en: ['7 days', '30 days', '90 days'], nl: ['7 dagen', '30 dagen', '90 dagen'] },
      kVisitors: { en: 'Visitors', nl: 'Bezoekers' },
      kVisitorsH: { en: '1,640 visits', nl: '1.640 bezoeken' },
      kStarted: { en: 'Started', nl: 'Gestart' },
      kStartedH: { en: '63% of visits', nl: '63% van de bezoeken' },
      kConv: { en: 'Conversions', nl: 'Conversies' },
      kConvH: { en: 'requests sent', nl: 'aanvragen verstuurd' },
      kRate: { en: 'Conversion rate', nl: 'Conversieratio' },
      kRateH: { en: 'per visitor', nl: 'per bezoeker' },
      sources: { en: 'Traffic sources', nl: 'Verkeersbronnen' },
      direct: { en: 'Direct', nl: 'Direct' },
      devices: { en: 'Devices', nl: 'Apparaten' },
      mobile: { en: 'Mobile', nl: 'Mobiel' },
      desktop: { en: 'Desktop', nl: 'Desktop' },
    },
    body: (d, s) => `
      ${statusBar}
      <div class="app">
        <div class="nav"><h2>${s.title}</h2></div>
        <div class="card live">
          <div class="chart-h"><b>${s.live}</b><span>${s.liveHint}</span></div>
          ${row('Utrecht, NL', s.v1, '2', 'live')}
          ${row('Gent, BE', s.v2, '1', 'live')}
        </div>
        <div class="segs period">${s.days.map((x, i) => `<span class="${i === 1 ? 'on' : ''}">${x}</span>`).join('')}</div>
        <div class="kpis">
          ${kpi(s.kVisitors, '1.284', s.kVisitorsH, '+12%')}
          ${kpi(s.kStarted, '812', s.kStartedH, '+8%')}
          ${kpi(s.kConv, '164', s.kConvH, '+21%')}
          ${kpi(s.kRate, '12,8%', s.kRateH, '+1,4 pt')}
        </div>
        ${breakdown(s.sources, [['Google Ads', '48%', 100], [s.direct, '22%', 46], ['Facebook', '18%', 38]])}
        ${breakdown(s.devices, [[s.mobile, '71%', 100], [s.desktop, '24%', 34]])}
      </div>
      ${tabBar(3, d)}`,
  },
  {
    file: '4-chat',
    headline: { en: 'Answer while<br><em>they’re still there</em>', nl: 'Antwoord terwijl<br><em>ze er nog zijn</em>' },
    sub: {
      en: 'Live chat from your website, answered wherever you are.',
      nl: 'Live chat vanaf je website, waar je ook bent.',
    },
    t: {
      state: { en: 'Online · 2 offers', nl: 'Online · 2 offertes' },
      b: {
        en: [
          'Hi! I just configured a veranda on your site — 6 × 3.5 m, anthracite.',
          'Saw it come in, nice choice. I can hold that price for 14 days.',
          'Can it be 6.5 m wide with only two posts?',
          'Yes — up to 7 m with the reinforced beam. I’ll put it in your offer.',
          'Great. And how long is delivery?',
          'Four to six weeks, installation included.',
          'Perfect, send it over 🙌',
          'On its way — you’ll get it by e-mail in a minute.',
        ],
        nl: [
          'Hoi! Ik heb net een veranda samengesteld op jullie site — 6 × 3,5 m, antraciet.',
          'Gezien, mooie keuze. Die prijs kan ik 14 dagen vasthouden.',
          'Kan hij 6,5 m breed met maar twee staanders?',
          'Ja — tot 7 m met de versterkte ligger. Ik zet het in je offerte.',
          'Top. En hoe lang is de levertijd?',
          'Vier tot zes weken, inclusief montage.',
          'Perfect, stuur maar op 🙌',
          'Onderweg — je hebt hem zo per e-mail.',
        ],
      },
      composer: { en: 'Write a message…', nl: 'Schrijf een bericht…' },
    },
    body: (d, s) => `
      ${statusBar}
      <div class="app chat">
        <div class="chead">
          <div class="av">SD</div>
          <div><b>Sanne Dekker</b><span>${s.state}</span></div>
        </div>
        <div class="thread">
          ${s.b.map((text, i) => bubble(text, i % 2 === 1, ['13:58', '13:59', '14:02', '14:03', '14:04', '14:04', '14:05', '14:06'][i])).join('')}
        </div>
        <div class="composer"><span>${s.composer}</span><div class="send">${icon('send', INK, 18)}</div></div>
      </div>
      ${tabBar(2, d)}`,
  },
  {
    file: '5-planning',
    headline: { en: 'Measure, mount,<br><em>done</em>', nl: 'Inmeten, monteren,<br><em>klaar</em>' },
    sub: {
      en: 'Visits, measurements and installations on one calendar.',
      nl: 'Bezoeken, inmetingen en montages op één agenda.',
    },
    t: {
      month: { en: 'June 2026', nl: 'Juni 2026' },
      today: { en: 'Today', nl: 'Vandaag' },
      dow: { en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], nl: ['M', 'D', 'W', 'D', 'V', 'Z', 'Z'] },
      segs: { en: ['All', 'Visits', 'Follow-ups'], nl: ['Alles', 'Bezoeken', 'Opvolging'] },
      a: {
        en: [
          ['On-site measurement', 'Familie de Vries · Utrecht'],
          ['Showroom visit', 'J. Peeters · 2 people'],
          ['Installation', 'M. Janssen · Gent · crew of 3'],
          ['Call back', 'Familie Bakker · about the sun protection'],
          ['Service', 'De Wit · gutter check'],
        ],
        nl: [
          ['Inmeten op locatie', 'Familie de Vries · Utrecht'],
          ['Showroombezoek', 'J. Peeters · 2 personen'],
          ['Montage', 'M. Janssen · Gent · ploeg van 3'],
          ['Terugbellen', 'Familie Bakker · over de zonwering'],
          ['Service', 'De Wit · goot controleren'],
        ],
      },
    },
    body: (d, s) => `
      ${statusBar}
      <div class="app">
        <div class="nav"><h2>${s.month}</h2><div class="count">${s.today}</div></div>
        <div class="cal">
          ${s.dow.map((x) => `<span class="dow">${x}</span>`).join('')}
          ${Array.from({ length: 28 }, (_, i) => {
            const day = i + 1;
            const cls = day === 11 ? 'sel' : [3, 5, 12, 18, 24].includes(day) ? 'dot' : '';
            return `<span class="day ${cls}">${day}</span>`;
          }).join('')}
        </div>
        <div class="segs">${s.segs.map((x, i) => `<span class="${i === 0 ? 'on' : ''}">${x}</span>`).join('')}</div>
        ${s.a.map(([title, sub], i) => agenda(['09:00', '11:30', '15:00', '16:30', '17:15'][i], title, sub, ['a', 'b', 'c', 'b', 'a'][i])).join('')}
      </div>
      ${tabBar(1, d)}`,
  },
  {
    file: '6-offer',
    headline: { en: 'From request<br><em>to signed offer</em>', nl: 'Van aanvraag<br><em>tot getekende offerte</em>' },
    sub: {
      en: 'Build the quote, send it, and watch it get approved.',
      nl: 'Stel de offerte samen, verstuur hem en zie hem akkoord komen.',
    },
    t: {
      title: { en: 'Offer #2416', nl: 'Offerte #2416' },
      state: { en: 'Draft', nl: 'Concept' },
      lines: {
        en: [
          ['Veranda 6.0 × 3.5 m', '€ 6.240'],
          ['Sliding glass wall, 4 panels', '€ 1.850'],
          ['LED spots + dimmer', '€ 410'],
          ['Installation', '€ 440'],
        ],
        nl: [
          ['Veranda 6,0 × 3,5 m', '€ 6.240'],
          ['Glasschuifwand, 4 panelen', '€ 1.850'],
          ['LED-spots + dimmer', '€ 410'],
          ['Montage en plaatsing', '€ 440'],
        ],
      },
      total: { en: 'Total incl. VAT', nl: 'Totaal incl. btw' },
      cta: { en: 'Send offer to customer', nl: 'Offerte naar klant sturen' },
      hint: { en: 'You get a push the second they open it.', nl: 'Je krijgt een push zodra hij hem opent.' },
      history: { en: 'History', nl: 'Geschiedenis' },
      h: {
        en: [
          ['Configuration received', 'Today, 09:12 · from your website'],
          ['Reviewed by you', 'Today, 09:40'],
          ['Visit planned', 'Thu 11 June, 09:00 · measurement'],
        ],
        nl: [
          ['Configuratie ontvangen', 'Vandaag, 09:12 · via je website'],
          ['Door jou beoordeeld', 'Vandaag, 09:40'],
          ['Bezoek ingepland', 'do 11 juni, 09:00 · inmeten'],
        ],
      },
    },
    body: (d, s) => `
      ${statusBar}
      <div class="app">
        <div class="nav back"><h2>${s.title}</h2><div class="count">${s.state}</div></div>
        <div class="hero"></div>
        <div class="card lines">
          ${s.lines.map(([label, price]) => `<div class="line"><span>${label}</span><b>${price}</b></div>`).join('')}
          <div class="line total"><span>${s.total}</span><b>€ 8.940</b></div>
        </div>
        <div class="cta">${icon('send', INK, 19)}<span>${s.cta}</span></div>
        <div class="hintrow">${icon('bell', SMOKE, 16)}<span>${s.hint}</span></div>
        <h3>${s.history}</h3>
        <div class="card">
          ${s.h.map(([title, sub]) => row(title, sub, '')).join('')}
        </div>
      </div>
      ${tabBar(0, d)}`,
  },
];

// --- Page -------------------------------------------------------------------
const css = (d) => {
  const e = Math.max(1.4, d.ui * 0.11); // the brand's 1.5px edge, at frame scale
  return `
@font-face { font-family: DMSans; src: url(DMSans-Regular.ttf); font-weight: 400 }
@font-face { font-family: DMSans; src: url(DMSans-Medium.ttf); font-weight: 500 }
@font-face { font-family: DMSans; src: url(DMSans-SemiBold.ttf); font-weight: 600 }
@font-face { font-family: DMSans; src: url(DMSans-Bold.ttf); font-weight: 700 }
@font-face { font-family: Bricolage; src: url(Bricolage-Bold.ttf); font-weight: 700 }
* { margin: 0; padding: 0; box-sizing: border-box; -webkit-font-smoothing: antialiased }
body {
  width: ${d.w}px; height: ${d.h}px; overflow: hidden;
  font-family: DMSans, system-ui, sans-serif; color: ${PAPER};
  background: ${DEEP};
  display: flex; flex-direction: column; align-items: center;
}
/* A solid lime plate the device stands on — the site stacks plates, it never
   blurs them. */
.plate { position: absolute; left: 0; right: 0; bottom: 0; height: ${d.plate}px;
  background: ${LIME}; border-top: ${e * 1.3}px solid ${INK};
  border-radius: ${d.radius}px ${d.radius}px 0 0 }
.wrap { position: relative; z-index: 1; width: 100%; height: 100%;
  display: flex; flex-direction: column; align-items: center; padding: ${d.pad}px ${d.pad}px 0 }
.brandrow { display: flex; align-items: center; gap: ${d.gap * 0.5}px; margin-bottom: ${d.gap}px }
.brandrow svg { width: ${d.markW}px; height: ${d.markW * 1.36}px }
.brandrow span { font-weight: 700; letter-spacing: .22em; font-size: ${d.brand}px; color: rgba(247,244,237,.7) }
h1 { font-family: Bricolage, DMSans, system-ui, sans-serif;
  font-size: ${d.h1}px; line-height: 1.08; font-weight: 700; text-align: center; letter-spacing: -.02em }
h1 em { font-style: normal; color: ${LIME} }
.lede { margin-top: ${d.gap * 0.7}px; font-size: ${d.sub}px; line-height: 1.45; font-weight: 400;
  color: rgba(247,244,237,.92); text-align: center; max-width: ${d.subW}px }
.stage { flex: 1; width: 100%; display: flex; justify-content: center; align-items: flex-end;
  margin-top: ${d.gap * 1.3}px }

/* Device frame */
.frame { width: ${d.frameW}px; height: ${d.frameH}px; background: ${INK};
  border-radius: ${d.radius}px; padding: ${d.bezel}px }
.screen { width: 100%; height: 100%; background: ${PAPER}; border-radius: ${d.radius - d.bezel}px;
  overflow: hidden; position: relative; display: flex; flex-direction: column;
  font-size: ${d.ui}px; color: ${INK}; }

/* App chrome */
.status { display: flex; justify-content: space-between; align-items: center;
  padding: ${d.ui * 1.1}px ${d.ui * 1.5}px ${d.ui * 0.2}px; font-size: ${d.ui * 0.86}px; font-weight: 600 }
.status .bars { display: flex; gap: ${d.ui * 0.22}px; align-items: flex-end }
.status .bars i { width: ${d.ui * 0.22}px; background: ${INK}; border-radius: 2px }
.status .bars i:nth-child(1) { height: ${d.ui * 0.4}px }
.status .bars i:nth-child(2) { height: ${d.ui * 0.6}px }
.status .bars i:nth-child(3) { height: ${d.ui * 0.8}px }
.app { flex: 1; padding: ${d.ui * 0.9}px ${d.ui * 1.25}px ${d.dk * 92}px; overflow: hidden }

.hello h2, .nav h2 { font-family: Bricolage, DMSans, sans-serif;
  font-size: ${d.ui * 1.55}px; font-weight: 700; letter-spacing: -.01em }
.hello span { font-size: ${d.ui * 0.9}px; color: ${SMOKE} }
.nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: ${d.ui * 0.9}px }
.count { font-size: ${d.ui * 0.82}px; font-weight: 600; color: ${INK};
  background: ${CHALK}; border: ${e}px solid ${INK}; padding: ${d.ui * 0.26}px ${d.ui * 0.7}px; border-radius: 999px }
.hello { margin-bottom: ${d.ui}px }
h3 { font-family: Bricolage, DMSans, sans-serif;
  font-size: ${d.ui * 1.02}px; font-weight: 700; margin: ${d.ui * 1.05}px 0 ${d.ui * 0.5}px }

.tiles { display: flex; gap: ${d.ui * 0.7}px; margin-bottom: ${d.ui * 0.7}px }
.tile { flex: 1; background: ${CHALK}; border: ${e}px solid ${INK}; border-radius: ${d.ui * 1.15}px;
  padding: ${d.ui * 0.85}px }
.tile-h { display: flex; align-items: center; gap: ${d.ui * 0.35}px; font-size: ${d.ui * 0.82}px; color: ${SMOKE} }
.tile-v { font-family: Bricolage, DMSans, sans-serif;
  font-size: ${d.ui * 1.9}px; font-weight: 700; margin-top: ${d.ui * 0.2}px; letter-spacing: -.02em }
.tile-d { font-size: ${d.ui * 0.75}px; color: ${SMOKE} }
.tile-d.up { color: #16A34A; font-weight: 600 }

.card { background: ${CHALK}; border: ${e}px solid ${INK}; border-radius: ${d.ui * 1.15}px; overflow: hidden }
.row { display: flex; align-items: center; gap: ${d.ui * 0.7}px; padding: ${d.ui * 0.72}px ${d.ui * 0.9}px;
  border-bottom: 1px solid ${LINE} }
.row:last-child { border-bottom: 0 }
.row-dot { width: ${d.ui * 0.45}px; height: ${d.ui * 0.45}px; aspect-ratio: 1; border-radius: 50%;
  background: ${DEEP}; flex: none; align-self: center }
.row-dot.live { background: ${LIME}; border: ${e * 0.8}px solid ${INK} }
.row-t { flex: 1; display: flex; flex-direction: column }
.row-t b { font-size: ${d.ui * 0.95}px; font-weight: 600 }
.row-t span { font-size: ${d.ui * 0.8}px; color: ${SMOKE} }
.pill { font-size: ${d.ui * 0.7}px; font-weight: 700; background: ${LIME}; color: ${INK}; line-height: 1;
  border: ${e * 0.8}px solid ${INK}; padding: ${d.ui * 0.32}px ${d.ui * 0.52}px; border-radius: 999px;
  min-width: ${d.ui * 1.5}px; text-align: center; align-self: center }

.chart { padding: ${d.ui * 0.85}px ${d.ui * 0.9}px ${d.ui * 0.7}px }
.chart-h { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: ${d.ui * 0.5}px }
.chart-h b { font-size: ${d.ui * 0.95}px; font-weight: 600 }
.chart-h span { font-size: ${d.ui * 0.75}px; color: ${SMOKE} }
.bars-chart { display: flex; align-items: flex-end; gap: ${d.ui * 0.5}px; height: ${d.ui * 7.2}px }
.bcol { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100% }
.bcol i { width: 100%; background: ${DEEP}; border-radius: ${d.ui * 0.3}px; display: block }
.bn { font-size: ${d.ui * 0.66}px; font-weight: 600; margin-bottom: ${d.ui * 0.15}px }
.bm { font-size: ${d.ui * 0.66}px; color: ${SMOKE}; margin-top: ${d.ui * 0.2}px }
.live .row:first-of-type { border-top: 1px solid ${LINE} }
.live { padding-top: ${d.ui * 0.85}px }
.live .chart-h { padding: 0 ${d.ui * 0.9}px }

.segs { display: flex; gap: ${d.ui * 0.4}px; margin-bottom: ${d.ui * 0.9}px }
.segs span { font-size: ${d.ui * 0.82}px; font-weight: 600; color: ${INK};
  padding: ${d.ui * 0.32}px ${d.ui * 0.8}px; border-radius: 999px; background: ${CHALK}; border: ${e}px solid ${INK} }
.segs span.on { background: ${INK}; color: ${PAPER}; border-color: ${INK} }
.segs.period { margin-top: ${d.ui * 0.9}px }

.kpis { display: flex; flex-wrap: wrap; gap: ${d.ui * 0.6}px }
.kpi { flex: 1 1 42%; background: ${CHALK}; border: ${e}px solid ${INK}; border-radius: ${d.ui * 1.15}px;
  padding: ${d.ui * 0.8}px; display: flex; flex-direction: column }
.kpi-l { font-size: ${d.ui * 0.8}px; color: ${SMOKE} }
.kpi-r { display: flex; align-items: baseline; gap: ${d.ui * 0.35}px }
.kpi-r b { font-family: Bricolage, DMSans, sans-serif; font-size: ${d.ui * 1.5}px; font-weight: 700; letter-spacing: -.02em }
.kpi-r em { font-style: normal; font-size: ${d.ui * 0.72}px; font-weight: 700 }
.kpi-r em.up { color: #16A34A } .kpi-r em.down { color: #B91C1C }
.kpi-h { font-size: ${d.ui * 0.72}px; color: ${SMOKE} }
.brow { padding: ${d.ui * 0.6}px ${d.ui * 0.9}px; border-bottom: 1px solid ${LINE} }
.brow:last-child { border-bottom: 0 }
.brow-h { display: flex; justify-content: space-between; font-size: ${d.ui * 0.85}px; margin-bottom: ${d.ui * 0.3}px }
.brow-h b { font-weight: 700 }
.track { height: ${d.ui * 0.5}px; background: ${PAPER_DIM}; border-radius: 999px; overflow: hidden }
.track i { display: block; height: 100%; background: ${DEEP}; border-radius: 999px }

.lead { background: ${CHALK}; border: ${e}px solid ${INK}; border-radius: ${d.ui * 1.15}px; overflow: hidden;
  margin-bottom: ${d.ui * 0.75}px }
.shot { height: ${d.ui * 8.4}px;
  background-size: cover; background-position: center 42%; background-color: ${PAPER_DIM} }
.lead-b { padding: ${d.ui * 0.8}px ${d.ui * 0.9}px; display: flex; flex-direction: column; gap: ${d.ui * 0.25}px }
.lead-r { display: flex; justify-content: space-between; align-items: baseline }
.lead-r b { font-size: ${d.ui}px; font-weight: 600 }
.price { font-weight: 700; font-size: ${d.ui}px }
.sub { font-size: ${d.ui * 0.78}px; color: ${SMOKE} }
.lead .status { display: inline-flex; align-items: center; gap: ${d.ui * 0.35}px; padding: 0; margin-top: ${d.ui * 0.2}px;
  font-size: ${d.ui * 0.78}px; font-weight: 600; color: ${SMOKE}; justify-content: flex-start }
.lead .status i { width: ${d.ui * 0.4}px; height: ${d.ui * 0.4}px; border-radius: 50%; background: ${SMOKE} }
.lead .status.bad { color: #B91C1C } .lead .status.bad i { background: #B91C1C }
.lead .status.good { color: #16A34A } .lead .status.good i { background: #16A34A }
.lead .status.info { color: ${DEEP} } .lead .status.info i { background: ${DEEP} }

.chead { display: flex; align-items: center; gap: ${d.ui * 0.7}px; padding-bottom: ${d.ui * 0.9}px;
  border-bottom: 1px solid ${LINE}; margin-bottom: ${d.ui * 0.9}px }
.av { width: ${d.ui * 2.4}px; height: ${d.ui * 2.4}px; border-radius: 50%; background: ${DEEP}; color: ${LIME};
  display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: ${d.ui * 0.85}px }
.chead b { display: block; font-size: ${d.ui}px; font-weight: 600 }
.chead span { font-size: ${d.ui * 0.78}px; color: ${SMOKE} }
.app.chat { display: flex; flex-direction: column }
.thread { display: flex; flex-direction: column; gap: ${d.ui * 0.6}px }
.bub { max-width: 78%; background: ${CHALK}; border: ${e}px solid ${INK}; border-radius: ${d.ui}px;
  padding: ${d.ui * 0.6}px ${d.ui * 0.8}px; align-self: flex-start }
.bub p { font-size: ${d.ui * 0.92}px; line-height: 1.4 }
.bub time { display: block; margin-top: ${d.ui * 0.2}px; font-size: ${d.ui * 0.68}px; color: ${SMOKE} }
.bub.mine { align-self: flex-end; background: ${LIME} }
.bub.mine time { color: rgba(0,0,0,.5) }
.composer { margin-top: auto; display: flex; align-items: center; justify-content: space-between;
  background: ${CHALK}; border: ${e}px solid ${INK}; border-radius: 999px;
  padding: ${d.ui * 0.45}px ${d.ui * 0.45}px ${d.ui * 0.45}px ${d.ui}px;
  font-size: ${d.ui * 0.9}px; color: ${SMOKE} }
.send { width: ${d.ui * 2}px; height: ${d.ui * 2}px; border-radius: 50%; background: ${LIME};
  border: ${e}px solid ${INK}; display: flex; align-items: center; justify-content: center }

.cal { background: ${CHALK}; border: ${e}px solid ${INK}; border-radius: ${d.ui * 1.15}px; padding: ${d.ui * 0.8}px;
  display: grid; grid-template-columns: repeat(7, 1fr); gap: ${d.ui * 0.3}px; margin-bottom: ${d.ui}px }
.dow { text-align: center; font-size: ${d.ui * 0.7}px; color: ${SMOKE}; font-weight: 600; padding-bottom: ${d.ui * 0.2}px }
.day { text-align: center; font-size: ${d.ui * 0.82}px; padding: ${d.ui * 0.35}px 0; border-radius: 50%; position: relative }
.day.sel { background: ${INK}; color: ${PAPER}; font-weight: 700 }
.day.dot::after { content: ''; position: absolute; left: 50%; bottom: ${d.ui * 0.06}px; transform: translateX(-50%);
  width: ${d.ui * 0.26}px; height: ${d.ui * 0.26}px; border-radius: 50%; background: ${DEEP} }
.ag { display: flex; gap: ${d.ui * 0.8}px; background: ${CHALK}; border: ${e}px solid ${INK};
  border-left: ${d.ui * 0.32}px solid ${LIME}; border-radius: ${d.ui * 0.9}px;
  padding: ${d.ui * 0.72}px ${d.ui * 0.9}px; margin-bottom: ${d.ui * 0.6}px }
.ag.b { border-left-color: ${DEEP} } .ag.c { border-left-color: ${INK} }
.ag-t { font-size: ${d.ui * 0.85}px; font-weight: 700; color: ${SMOKE}; width: ${d.ui * 3.2}px }
.ag-b b { display: block; font-size: ${d.ui * 0.95}px; font-weight: 600 }
.ag-b span { font-size: ${d.ui * 0.78}px; color: ${SMOKE} }

.nav.back h2::before { content: '‹  '; color: ${SMOKE} }
.hero { height: ${d.ui * 8.5}px; border-radius: ${d.ui * 1.15}px; margin-bottom: ${d.ui * 0.9}px;
  border: ${e}px solid ${INK};
  background: url(veranda-hero.jpg) center 42%/cover, ${PAPER_DIM} }
.lines .line { display: flex; justify-content: space-between; padding: ${d.ui * 0.62}px ${d.ui * 0.9}px;
  border-bottom: 1px solid ${LINE}; font-size: ${d.ui * 0.88}px }
.lines .line b { font-weight: 600 }
.lines .line.total { border-bottom: 0; background: ${PAPER}; font-weight: 700; font-size: ${d.ui * 1.02}px }
.cta { margin-top: ${d.ui}px; background: ${LIME}; border: ${e}px solid ${INK}; border-radius: 999px;
  display: flex; align-items: center; justify-content: center; gap: ${d.ui * 0.5}px; padding: ${d.ui * 0.8}px;
  font-weight: 700; font-size: ${d.ui * 0.98}px; color: ${INK} }
.hintrow { display: flex; align-items: center; justify-content: center; gap: ${d.ui * 0.4}px;
  margin-top: ${d.ui * 0.6}px; font-size: ${d.ui * 0.78}px; color: ${SMOKE} }

.floatwrap { position: absolute; right: ${d.dk * 18}px; bottom: ${d.dk * 96}px }
.floataction { display: flex; align-items: center; gap: ${d.ui * 0.45}px; background: ${LIME};
  border: ${e * 1.1}px solid ${INK}; border-radius: 999px;
  padding: ${d.ui * 0.34}px ${d.ui * 0.85}px ${d.ui * 0.34}px ${d.ui * 0.34}px;
  font-weight: 700; font-size: ${d.ui * 0.92}px; color: ${INK} }
.fchip { width: ${d.ui * 1.75}px; height: ${d.ui * 1.75}px; border-radius: 50%; background: ${INK};
  display: flex; align-items: center; justify-content: center }

.dockwrap { position: absolute; left: 0; right: 0; bottom: 0;
  padding: 0 ${d.dk * 16}px ${d.dk * 14}px; pointer-events: none }
.dock { position: relative; height: ${d.dk * 64}px; border-radius: ${d.dk * 32}px;
  background: ${DEEP}; display: flex; align-items: center }
.notch { position: absolute; inset: 0; border-radius: ${d.dk * 32}px; overflow: hidden }
.notch span { position: absolute; left: 50%; top: ${d.dk * -42}px; margin-left: ${d.dk * -29}px;
  width: ${d.dk * 58}px; height: ${d.dk * 58}px; border-radius: 50%; background: ${PAPER} }
.dtab { flex: 1; height: 100%; display: flex; align-items: center; justify-content: center; position: relative }
.halo { position: absolute; width: ${d.dk * 46}px; height: ${d.dk * 34}px;
  border-radius: ${d.dk * 17}px; background: rgba(231,255,164,.16) }
.fabslot { overflow: visible }
.fab { position: absolute; top: ${d.dk * -8}px; width: ${d.dk * 60}px; height: ${d.dk * 60}px;
  border-radius: 50%; background: ${LIME}; border: ${e * 1.1}px solid ${INK};
  display: flex; align-items: center; justify-content: center }
.fab svg { width: ${d.dk * 22}px; height: ${d.dk * 30}px }
`;
};

const page = (d, screen, locale) => {
  // Pull this locale's half out of every {en, nl} pair in the screen's table.
  const pick = (v) => (v && typeof v === 'object' && !Array.isArray(v) && 'en' in v ? v[locale] : v);
  const s = Object.fromEntries(Object.entries(screen.t || {}).map(([k, v]) => [k, pick(v)]));
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(d)}</style></head>
<body><div class="plate"></div><div class="wrap">
  <div class="brandrow">${mark(LIME)}<span>ZINEVU</span></div>
  <h1>${screen.headline[locale]}</h1>
  <p class="lede">${screen.sub[locale]}</p>
  <div class="stage"><div class="frame"><div class="screen">${screen.body(d, s)}</div></div></div>
</div></body></html>`;
};

// --- Devices ----------------------------------------------------------------
// CSS pixels are half the target, rendered at device-scale-factor 2.
const DEVICES = [
  {
    name: 'iphone-6.5', w: 621, h: 1344, scale: 2,
    pad: 42, gap: 18, markW: 26, brand: 13, h1: 50, sub: 17, subW: 470,
    frameW: 466, frameH: 1010, radius: 48, bezel: 9, ui: 16, plate: 330, dk: 1.05,
  },
  {
    name: 'ipad-13', w: 1032, h: 1376, scale: 2,
    pad: 64, gap: 22, markW: 34, brand: 17, h1: 66, sub: 23, subW: 720,
    frameW: 812, frameH: 1060, radius: 44, bezel: 13, ui: 22, plate: 380, dk: 1.3,
  },
];

const LOCALES = ['en', 'nl'];

// --- Render -----------------------------------------------------------------
mkdirSync(WORK, { recursive: true });
const FONTS = {
  'DMSans-Regular.ttf': '@expo-google-fonts/dm-sans/400Regular/DMSans_400Regular.ttf',
  'DMSans-Medium.ttf': '@expo-google-fonts/dm-sans/500Medium/DMSans_500Medium.ttf',
  'DMSans-SemiBold.ttf': '@expo-google-fonts/dm-sans/600SemiBold/DMSans_600SemiBold.ttf',
  'DMSans-Bold.ttf': '@expo-google-fonts/dm-sans/700Bold/DMSans_700Bold.ttf',
  'Bricolage-Bold.ttf': '@expo-google-fonts/bricolage-grotesque/700Bold/BricolageGrotesque_700Bold.ttf',
};
for (const [dest, src] of Object.entries(FONTS)) {
  const from = resolve(ROOT, 'node_modules', src);
  if (existsSync(from)) copyFileSync(from, resolve(WORK, dest));
  else console.warn(`! font missing: ${src} — falling back to system sans`);
}

// Real configurator renders — the lead cards and the offer hero show what the
// customer actually built, so the frames use the same product renders the
// configurator serves rather than an abstract stand-in.
for (const render of ['veranda-anthracite', 'veranda-cream', 'veranda-black', 'veranda-hero']) {
  copyFileSync(resolve(OUT, 'renders', `${render}.jpg`), resolve(WORK, `${render}.jpg`));
}

for (const device of DEVICES) {
  for (const locale of LOCALES) {
    const dir = resolve(OUT, device.name, locale);
    mkdirSync(dir, { recursive: true });
    for (const screen of SCREENS) {
      const html = resolve(WORK, `${device.name}-${locale}-${screen.file}.html`);
      const png = resolve(dir, `${screen.file}.png`);
      writeFileSync(html, page(device, screen, locale));
      execFileSync(CHROME, [
        '--headless', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
        `--force-device-scale-factor=${device.scale}`,
        `--window-size=${device.w},${device.h}`,
        `--screenshot=${png}`,
        `file://${html}`,
      ], { stdio: 'ignore' });
      console.log(`${device.name}/${locale}/${screen.file}.png  ${device.w * device.scale} × ${device.h * device.scale}`);
    }
  }
}
