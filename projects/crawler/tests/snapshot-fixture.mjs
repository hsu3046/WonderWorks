// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
// All fixture text and artwork are original AIB test material.
export const fixtureUrl = 'https://fixture.example.com/story';
export const fixtureEntryUrl = 'https://entry.fixture.example.com/start';
export const fixtureHTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Field Atlas · AIB</title><link rel="stylesheet" href="/style.css"></head><body>
<header id="mast">FIELD ATLAS <nav><a href="/journal">Journal</a> / <a href="/about">About</a></nav></header>
<main><section id="hero"><div><p class="eyebrow">AIB FIELD NOTES / 08</p><h1 id="headline"><span>L</span><span>i</span><span>v</span><span>i</span><span>n</span><span>g</span> between<br><em>the lines.</em></h1><p id="meal">A curious little creature discovers a garden of words. The page keeps its shape as a story becomes a meal.</p><p id="hydrated"></p></div><img id="art" src="https://assets.fixture.example.com/cover.svg" alt="A golden sun over green hills"></section>
<section id="lower"><p class="eyebrow">THE SECOND CHAPTER</p><h2>Follow the quiet path.</h2><p id="lower-meal">Moonlight gathers beside the river. These lower words remain reachable after the original page scrolls.</p><blockquote>Every page has a landscape of its own.</blockquote></section></main>
<footer>© 2026 AIB Inc. / Original fixture</footer>
<p style="opacity:0"><span>Invisible words must never become meals.</span></p>
<iframe src="http://127.0.0.1:9/private"></iframe>
<script>document.querySelector('#hydrated').textContent='Rendered by JavaScript, preserved as quiet text.';fetch('http://127.0.0.1:9/private').catch(()=>{});</script>
</body></html>`;
export const fixtureCSS = `@font-face{font-family:CaptureTest;src:url('https://assets.fixture.example.com/type.ttf') format('truetype');font-display:swap}
*{box-sizing:border-box}body{margin:0;background:#f7f1e5;color:#203d33;font:18px CaptureTest,Georgia,serif}header{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;padding:20px 36px;background:#203d33;color:#f7f1e5;font:12px system-ui;letter-spacing:2px}a{color:inherit}main{padding:48px 44px 0;max-width:1120px;margin:auto}#hero{display:grid;grid-template-columns:1.1fr 1fr;gap:44px;align-items:center}.eyebrow{font:10px system-ui;letter-spacing:2px;color:#a75c3c}h1{font-size:58px;line-height:1.06;font-weight:400;letter-spacing:-2px;margin:28px 0}h1 em{color:#a75c3c}p{line-height:1.65}#art{width:100%;height:370px;object-fit:cover;border-radius:160px 160px 8px 8px}#hydrated{font-size:13px}#lower{margin-top:64px;padding:40px 0 170px;border-top:1px solid #d5c9b1}h2{font-size:40px;font-weight:400}blockquote{border-left:2px solid #a75c3c;padding-left:24px;margin:40px 0;font-style:italic}footer{padding:30px 44px;background:#e4d9c2;font-size:12px}iframe{display:none}@media(max-width:640px){main{padding:24px}#hero{grid-template-columns:1fr;gap:16px}h1{font-size:42px}header{padding:16px;font-size:10px}#art{height:280px}#lower{padding-bottom:80px}}
`;
export const fixtureSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect width="500" height="500" fill="#e9c9a0"/><circle cx="340" cy="140" r="68" fill="#d98a3c"/><path d="M0 340Q130 170 290 350T500 270V500H0Z" fill="#748269"/><path d="M0 430Q250 200 500 410V500H0Z" fill="#314f40"/></svg>';
export function fixtureResource(url, font) {
  const parsed = new URL(url);
  if (url === fixtureEntryUrl) return { redirect: fixtureUrl };
  if (parsed.hostname === 'fixture.example.com' && parsed.pathname === '/story') return { body: Buffer.from(fixtureHTML), type: 'text/html' };
  if (parsed.pathname === '/style.css') return { body: Buffer.from(fixtureCSS), type: 'text/css' };
  if (parsed.pathname === '/cover.svg') return { redirect: 'https://assets.fixture.example.com/final-cover.svg' };
  if (parsed.pathname === '/final-cover.svg') return { body: Buffer.from(fixtureSVG), type: 'image/svg+xml' };
  if (parsed.pathname === '/type.ttf' && font) return { redirect: 'https://assets.fixture.example.com/final-type.ttf', cors: '*' };
  if (parsed.pathname === '/final-type.ttf' && font) return { body: font, type: 'font/ttf', cors: '*' };
  throw new Error('Fixture resource not found');
}
