// Generates every SVG the README embeds, for light and dark, into dist/:
// hero, social buttons, stack, stats card and repo cards (live stars).
// Runs daily in .github/workflows/profile.yml, which publishes dist/ to the `output` branch.
// Local run: GITHUB_TOKEN=$(gh auth token) node scripts/build.mjs dist
import fs from 'node:fs';
import path from 'node:path';
import * as si from 'simple-icons';
import { faLinkedin } from '@fortawesome/free-brands-svg-icons';

const USER = process.env.USERNAME || 'matiasbenary';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const OUT = path.resolve(process.argv[2] || 'dist');
const ROOT = path.resolve(import.meta.dirname, '..');

// ---------------------------------------------------------------- content

const HERO = {
  name: 'Matías Benary',
  titles: [
    'Senior Fullstack Engineer',
    'Developer Experience at NEAR Protocol',
    '#1 contributor to near/docs, last 12 months',
    'TypeScript · React · Node.js',
  ],
  tagline: 'Open to remote fullstack roles, LATAM to US/EU.',
};

const SOCIALS = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'x', label: 'X' },
  { id: 'substack', label: 'Newsletter' },
  { id: 'gmail', label: 'Email' },
];

const STACK = [
  { id: 'typescript', label: 'TypeScript' },
  { id: 'react', label: 'React' },
  { id: 'nextdotjs', label: 'Next.js' },
  { id: 'nodedotjs', label: 'Node.js' },
  { id: 'postgresql', label: 'PostgreSQL' },
  { id: 'rust', label: 'Rust' },
  { id: 'near', label: 'NEAR' },
];

// Descriptions are written for the README; stars and language come from the API.
const REPOS = [
  { name: 'near-stake', description: 'Non-custodial staking console, in production at near-staking.trezu.org.' },
  { name: 'near-connect-hooks', description: 'React hooks for NEAR wallet integration, published as a library with a live demo.' },
  { name: 'outlayer-mock', description: "Dependency-free mock of OutLayer's agent custody API, 104 tests in 8 suites." },
];

// ---------------------------------------------------------------- theme

const ACCENT = '#c6ff1a';
const THEMES = {
  light: { name: 'light', bg: '#ffffff', tile: '#fafafa', border: '#e5e5e5', grid: '#f0f0f0', text: '#0a0a0a', muted: '#666666', faint: '#a1a1a1', accent: ACCENT, ink: '#5c7a00' },
  dark: { name: 'dark', bg: '#0d1117', tile: '#161b22', border: '#30363d', grid: '#1c2128', text: '#e6edf3', muted: '#9198a1', faint: '#6e7681', accent: ACCENT, ink: ACCENT },
};

// ponytail: system fonts instead of embedded Geist; GitHub's own UI uses the same stack, so the SVGs blend in.
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

const BASE_CSS = `
.fade-up{opacity:0;animation:fade-up .7s cubic-bezier(.2,.7,.2,1) forwards}
@keyframes fade-up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.shimmer{animation:shimmer 6s ease-in-out infinite}
@keyframes shimmer{0%{transform:translateX(-160px)}55%,100%{transform:translateX(var(--end))}}
.pulse{animation:pulse 2s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
@media (prefers-reduced-motion: reduce){*{animation:none!important;opacity:1!important}}`;

// ---------------------------------------------------------------- helpers

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n));

const ICONS = Object.fromEntries(
  Object.values(si).filter((i) => i?.slug).map((i) => [i.slug, { w: 24, h: 24, d: i.path }]),
);
ICONS.linkedin = { w: faLinkedin.icon[0], h: faLinkedin.icon[1], d: faLinkedin.icon[4] };

function iconAt(id, { x, y, size, fill }) {
  const { w, h, d } = ICONS[id] ?? (() => { throw new Error(`Unknown icon: ${id}`); })();
  const s = size / Math.max(w, h);
  return `<path transform="translate(${(x + (size - w * s) / 2).toFixed(2)} ${(y + (size - h * s) / 2).toFixed(2)}) scale(${s.toFixed(4)})" d="${d}" fill="${fill}"/>`;
}

const arrow = ({ x, y, s = 14, stroke }) =>
  `<path d="M${x + s * 0.25} ${y + s * 0.75} L${x + s * 0.75} ${y + s * 0.25} M${x + s * 0.32} ${y + s * 0.25} H${x + s * 0.75} V${y + s * 0.68}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;

function star({ cx, cy, r, fill }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const rad = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`;
  });
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
}

function svgDoc({ width, height, title, css = '', defs = '', body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title">
<title id="title">${esc(title)}</title>
<style>${css}</style>
<defs>${defs}</defs>
${body}
</svg>
`;
}

// Card with a soft accent shimmer travelling along the top edge.
function frame({ t, width, height, rx = 12, delay = 0, id = 'card' }) {
  return {
    defs: `<linearGradient id="${id}-sh" x1="0" x2="1"><stop offset="0" stop-color="${t.accent}" stop-opacity="0"/><stop offset=".5" stop-color="${t.accent}" stop-opacity=".9"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></linearGradient>
<clipPath id="${id}-clip"><rect width="${width}" height="${height}" rx="${rx}"/></clipPath>`,
    body: `<rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="${rx}" fill="${t.bg}" stroke="${t.border}"/>
<g clip-path="url(#${id}-clip)"><rect class="shimmer" style="--end:${width + 160}px;animation-delay:${delay}s" width="160" height="1.5" fill="url(#${id}-sh)"/></g>`,
  };
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  console.log(`${(Buffer.byteLength(content) / 1024).toFixed(1).padStart(6)} KB  ${path.relative(process.cwd(), file)}`);
}

// ---------------------------------------------------------------- hero

// Typewriter over HERO.titles. textLength pins every glyph to `cw`, so the clip reveal
// is exact whatever monospace font the viewer has.
function typing(t, { x, y, size }) {
  const cw = size * 0.6;
  const TYPE = 0.065, DEL = 0.025, HOLD = 1.9, GAP = 0.35;
  let time = 0.6;
  const slots = HERO.titles.map((title) => {
    const n = [...title].length, start = time, holdEnd = start + n * TYPE + HOLD;
    time = holdEnd + n * DEL + GAP;
    const events = [];
    for (let k = 1; k <= n; k++) events.push([start + k * TYPE, k]);
    for (let k = 1; k <= n; k++) events.push([holdEnd + k * DEL, n - k]);
    return { title, n, events };
  });
  const total = time;
  const anim = (attr, events, f) => {
    const all = [[0, 0], ...events];
    return `<animate attributeName="${attr}" dur="${total.toFixed(2)}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${all.map(([s]) => (s / total).toFixed(5)).join(';')}" values="${all.map(([, k]) => f(k)).join(';')}"/>`;
  };
  const texts = slots.map(({ title, n, events }, i) => `
<clipPath id="type-${i}"><rect x="${x}" y="${y - size}" width="0" height="${size * 1.5}">${anim('width', events, (k) => (k * cw).toFixed(1))}</rect></clipPath>
<text x="${x}" y="${y}" class="type" textLength="${(n * cw).toFixed(1)}" lengthAdjust="spacing" clip-path="url(#type-${i})" xml:space="preserve">${esc(title)}</text>`).join('');
  const cursor = `<rect class="blink" x="${x}" y="${y - size + 2}" width="${(cw * 0.75).toFixed(1)}" height="${size + 3}" rx="1.5" fill="${t.ink}">${anim('x', slots.flatMap((s) => s.events), (k) => (x + k * cw).toFixed(1))}</rect>`;
  return texts + cursor;
}

function hero(t) {
  const W = 840, H = 300, px = 40, py = 58, ps = 184, tx = 264, fz = 20;
  const photo = fs.readFileSync(path.join(ROOT, "assets/photo.png")).toString("base64");
  const css = `${BASE_CSS}
.name{font:600 52px ${SANS};fill:${t.text};letter-spacing:-2px}
.prompt{font:400 ${fz}px ${MONO};fill:${t.faint}}
.type{font:400 ${fz}px ${MONO};fill:${t.text}}
.tagline{font:400 16px ${SANS};fill:${t.muted}}
.blink{animation:blink 1.1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
.beam-h{animation:beam-h 7s linear infinite}
@keyframes beam-h{from{transform:translateX(-140px)}to{transform:translateX(${W}px)}}
.beam-v{animation:beam-v 9s linear infinite 2.5s;transform:translateY(-120px)}
@keyframes beam-v{from{transform:translateY(-120px)}to{transform:translateY(${H}px)}}
.glow{animation:glow 6s ease-in-out infinite}
@keyframes glow{0%,100%{opacity:.55}50%{opacity:1}}`;
  const defs = `
<clipPath id="card"><rect width="${W}" height="${H}" rx="14"/></clipPath>
<clipPath id="photo"><rect x="${px}" y="${py}" width="${ps}" height="${ps}" rx="16"/></clipPath>
<pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="${t.grid}"/></pattern>
<radialGradient id="fade" cx="78%" cy="20%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<mask id="grid-mask"><rect width="${W}" height="${H}" fill="url(#fade)"/></mask>
<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${t.accent}" stop-opacity="${t.name === 'dark' ? 0.28 : 0.35}"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>
<linearGradient id="beam-h" x1="0" x2="1"><stop offset="0" stop-color="${t.ink}" stop-opacity="0"/><stop offset="1" stop-color="${t.ink}"/></linearGradient>
<linearGradient id="beam-v" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${t.ink}" stop-opacity="0"/><stop offset="1" stop-color="${t.ink}"/></linearGradient>`;
  const body = `
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="${t.bg}" stroke="${t.border}"/>
<g clip-path="url(#card)">
  <rect width="${W}" height="${H}" fill="url(#grid)" mask="url(#grid-mask)"/>
  <rect class="beam-h" y="47.5" width="140" height="1" fill="url(#beam-h)"/>
  <rect class="beam-v" x="791.5" width="1" height="120" fill="url(#beam-v)"/>
  <circle class="glow" cx="${px + ps / 2}" cy="${py + ps / 2}" r="170" fill="url(#glow)"/>
</g>
<g class="fade-up">
  <image href="data:image/png;base64,${photo}" x="${px}" y="${py}" width="${ps}" height="${ps}" clip-path="url(#photo)" preserveAspectRatio="xMidYMid slice"/>
  <rect x="${px + 0.5}" y="${py + 0.5}" width="${ps - 1}" height="${ps - 1}" rx="16" fill="none" stroke="${t.border}"/>
</g>
<g class="fade-up" style="animation-delay:.15s"><text x="${tx - 3}" y="126" class="name">${esc(HERO.name)}</text></g>
<g class="fade-up" style="animation-delay:.3s">
  <text x="${tx}" y="176" class="prompt">&gt;</text>
  ${typing(t, { x: tx + 2 * fz * 0.6, y: 176, size: fz })}
</g>
<g class="fade-up" style="animation-delay:.4s"><text x="${tx}" y="220" class="tagline">${esc(HERO.tagline)}</text></g>`;
  return svgDoc({ width: W, height: H, css, defs, body, title: `${HERO.name} (${USER}): ${HERO.titles.join(', ')}. ${HERO.tagline}` });
}

// ---------------------------------------------------------------- social + stack

function social(t, { id, label }, i) {
  const W = 152, H = 44;
  const css = `${BASE_CSS}
.label{font:500 14px ${SANS};fill:${t.text}}`;
  const body = `
<g class="fade-up" style="animation-delay:${(i * 0.06).toFixed(2)}s">
  <rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="10" fill="${t.bg}" stroke="${t.border}"/>
  ${iconAt(id, { x: 16, y: 14, size: 16, fill: t.text })}
  <text x="42" y="27" class="label">${esc(label)}</text>
  ${arrow({ x: W - 30, y: 15, stroke: t.faint })}
</g>`;
  return svgDoc({ width: W, height: H, css, body, title: label });
}

function stack(t) {
  const tw = 112, th = 96, gap = 8;
  const W = STACK.length * tw + (STACK.length - 1) * gap + 8, H = th + 8;
  const css = `${BASE_CSS}
.label{font:500 13px ${SANS};fill:${t.muted}}`;
  const body = STACK.map(({ id, label }, i) => {
    const x = 4 + i * (tw + gap);
    return `
<g class="fade-up" style="animation-delay:${(i * 0.07).toFixed(2)}s">
  <rect x="${x + 0.5}" y="4.5" width="${tw - 1}" height="${th - 1}" rx="12" fill="${t.tile}" stroke="${t.border}"/>
  ${iconAt(id, { x: x + tw / 2 - 14, y: 22, size: 28, fill: t.text })}
  <text x="${x + tw / 2}" y="80" text-anchor="middle" class="label">${esc(label)}</text>
</g>`;
  }).join('');
  return svgDoc({ width: W, height: H, css, body, title: `Stack: ${STACK.map((s) => s.label).join(', ')}` });
}

// ---------------------------------------------------------------- GitHub data

async function graphql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': `${USER}-profile` },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(`GitHub GraphQL failed: ${res.status} ${JSON.stringify(json.errors ?? json)}`);
  return json.data;
}

const QUERY = `query($login: String!, $after: String) {
  user(login: $login) {
    followers { totalCount }
    repositories(first: 100, after: $after, ownerAffiliations: OWNER, privacy: PUBLIC) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes { name stargazerCount primaryLanguage { name } }
    }
    contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { contributionCount } } } }
  }
}`;

async function fetchUser() {
  const repos = [];
  let after = null, first;
  do {
    const { user } = await graphql(QUERY, { login: USER, after });
    first ??= user;
    repos.push(...user.repositories.nodes);
    after = user.repositories.pageInfo.hasNextPage ? user.repositories.pageInfo.endCursor : null;
  } while (after);
  const cal = first.contributionsCollection.contributionCalendar;
  return {
    followers: first.followers.totalCount,
    publicRepos: first.repositories.totalCount,
    stars: repos.reduce((s, r) => s + r.stargazerCount, 0),
    contributions: cal.totalContributions,
    weeks: cal.weeks.map((w) => w.contributionDays.reduce((s, d) => s + d.contributionCount, 0)),
    repos: Object.fromEntries(repos.map((r) => [r.name, r])),
  };
}

// ---------------------------------------------------------------- stats + repo cards

// Catmull-Rom through the points, as cubic Béziers.
function smooth(pts) {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1.map((v) => v.toFixed(1)).join(' ')} ${c2.map((v) => v.toFixed(1)).join(' ')} ${p2.map((v) => v.toFixed(1)).join(' ')}`;
  }
  return d;
}

function stats(t, data, updated) {
  const W = 840, H = 248;
  const fr = frame({ t, width: W, height: H, id: 'stats' });
  const metrics = [[fmt(data.followers), 'Followers'], [fmt(data.stars), 'Stars'], [fmt(data.publicRepos), 'Public repos'], [fmt(data.contributions), 'Contributions']];
  const x0 = 32, x1 = W - 32, y0 = 172, y1 = 220;
  const max = Math.max(1, ...data.weeks);
  const step = (x1 - x0) / Math.max(1, data.weeks.length - 1);
  const pts = data.weeks.map((v, i) => [x0 + i * step, y1 - (v / max) * (y1 - y0)]);
  const line = smooth(pts);
  const [bx, by] = pts[data.weeks.indexOf(max)];
  const css = `${BASE_CSS}
.eyebrow{font:400 11.5px ${MONO};fill:${t.faint};letter-spacing:1px}
.value{font:600 36px ${SANS};fill:${t.text};letter-spacing:-1.2px}
.label{font:400 13px ${SANS};fill:${t.muted}}
.best{font:400 11px ${MONO};fill:${t.muted}}
.line{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 2.4s .5s cubic-bezier(.4,0,.2,1) forwards}
@keyframes draw{to{stroke-dashoffset:0}}
.area{opacity:0;animation:appear 1.2s 1.6s ease forwards}
.marker{opacity:0;animation:appear .6s 2.6s ease forwards}
@keyframes appear{to{opacity:1}}
@media (prefers-reduced-motion: reduce){.line{stroke-dashoffset:0}}`;
  const defs = `${fr.defs}
<linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${t.accent}" stop-opacity=".35"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></linearGradient>`;
  const body = `${fr.body}
<text x="32" y="40" class="eyebrow">GITHUB ACTIVITY</text>
<text x="${W - 32}" y="40" text-anchor="end" class="eyebrow">LAST 12 MONTHS · UPDATED ${esc(updated.toUpperCase())}</text>
${metrics.map(([v, l], i) => `<g class="fade-up" style="animation-delay:${(0.1 + i * 0.08).toFixed(2)}s"><text x="${32 + i * 200}" y="100" class="value">${esc(v)}</text><text x="${32 + i * 200}" y="124" class="label">${esc(l)}</text></g>`).join('\n')}
<line x1="${x0}" y1="${y1 + 0.5}" x2="${x1}" y2="${y1 + 0.5}" stroke="${t.border}" stroke-dasharray="2 4"/>
<path class="area" d="${line} L${x1} ${y1} L${x0} ${y1} Z" fill="url(#area)"/>
<path class="line" d="${line}" pathLength="1" fill="none" stroke="${t.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<g class="marker">
  <circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="7" fill="${t.accent}" opacity=".25" class="pulse"/>
  <circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="3.5" fill="${t.ink}"/>
  <text x="${Math.min(Math.max(bx, x0 + 50), x1 - 50).toFixed(1)}" y="${(by - 12).toFixed(1)}" text-anchor="middle" class="best">best week: ${max}</text>
</g>`;
  return svgDoc({ width: W, height: H, css, defs, body, title: `GitHub activity: ${metrics.map(([v, l]) => `${v} ${l.toLowerCase()}`).join(', ')} in the last 12 months.` });
}

function repoCard(t, repo, description, i) {
  const W = 840, H = 116;
  const fr = frame({ t, width: W, height: H, delay: i * 1.5 });
  const meta = [fmt(repo.stargazerCount), repo.primaryLanguage?.name].filter(Boolean).join(' · ');
  const css = `${BASE_CSS}
.title{font:600 17px ${SANS};fill:${t.text};letter-spacing:-.2px}
.desc{font:400 14px ${SANS};fill:${t.muted}}
.meta{font:400 12.5px ${MONO};fill:${t.muted}}`;
  const body = `${fr.body}
<g class="fade-up">
  ${iconAt('github', { x: 24, y: 28, size: 18, fill: t.text })}
  <text x="52" y="43" class="title">${esc(repo.name)}</text>
  ${arrow({ x: W - 38, y: 28, s: 16, stroke: t.faint })}
</g>
<g class="fade-up" style="animation-delay:.1s"><text x="24" y="68" class="desc">${esc(description)}</text></g>
<g class="fade-up" style="animation-delay:.2s">${star({ cx: 30, cy: H - 28.5, r: 6, fill: t.ink })}<text x="42" y="${H - 24}" class="meta">${esc(meta)}</text></g>`;
  return svgDoc({ width: W, height: H, css, defs: fr.defs, body, title: `${repo.name}: ${description}` });
}

// ---------------------------------------------------------------- main

if (!TOKEN) {
  console.error('Missing GITHUB_TOKEN (or GH_TOKEN).');
  process.exit(1);
}
const data = await fetchUser();
const updated = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
for (const t of Object.values(THEMES)) {
  write(path.join(OUT, `hero-${t.name}.svg`), hero(t));
  write(path.join(OUT, `stack-${t.name}.svg`), stack(t));
  write(path.join(OUT, `stats-${t.name}.svg`), stats(t, data, updated));
  SOCIALS.forEach((s, i) => write(path.join(OUT, `social-${s.id}-${t.name}.svg`), social(t, s, i)));
  REPOS.forEach(({ name, description }, i) => {
    const repo = data.repos[name];
    if (!repo) throw new Error(`Repo ${USER}/${name} not found or not public.`);
    write(path.join(OUT, `repo-${name}-${t.name}.svg`), repoCard(t, repo, description, i));
  });
}
console.log(`followers=${data.followers} stars=${data.stars} repos=${data.publicRepos} contributions=${data.contributions} weeks=${data.weeks.length}`);
