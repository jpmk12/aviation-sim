#!/usr/bin/env node
/* ============================================================================
 * build.js  —  zero-dependency Node build (spec §10).
 *   reads  src/shell.html, src/vendor/three.min.js, src/aero.js, src/game.js
 *   emits  dist/flightschool.html  (one self-contained file, Three.js inlined)
 *          dist/index.html         (the launcher / dashboard)
 * No network access, no npm deps. Run: node build.js
 * ==========================================================================*/
'use strict';
var fs = require('fs');
var path = require('path');

var ROOT = __dirname;
var SRC = path.join(ROOT, 'src');
var DIST = path.join(ROOT, 'dist');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function script(code) { return '<script>\n' + code + '\n</script>'; }
// IMPORTANT: replace with a FUNCTION so the payload is inserted literally.
// A string replacement runs $-substitution ($&, $`, $') and minified Three.js
// contains those sequences, which would corrupt the inlined code.
function inject(src, marker, code) { return src.replace(marker, function () { return script(code); }); }

function buildGame() {
  var shell = read(path.join(SRC, 'shell.html'));
  var three = read(path.join(SRC, 'vendor', 'three.min.js'));
  var aero = read(path.join(SRC, 'aero.js'));
  var game = read(path.join(SRC, 'game.js'));

  var html = shell;
  html = inject(html, '<!--THREE-->', three);
  html = inject(html, '<!--AERO-->', aero);
  html = inject(html, '<!--GAME-->', game);

  var out = path.join(DIST, 'flightschool.html');
  fs.writeFileSync(out, html);
  return { out: out, bytes: Buffer.byteLength(html) };
}

// The launcher lists every game by title + icon (spec §10.1). New games just
// add an entry here; each is a sibling HTML file in dist/.
var GAMES = [
  { id: 'flightschool', title: 'Flight School', icon: '✈️', href: 'flightschool.html',
    tint: '#4f8fe6', blurb: 'Fly cargo to Grandma, the mountain, the island.' }
  // { id: 'spaceschool', title: 'Space School', icon: '🚀', href: 'spaceschool.html', tint: '#2b1b52', blurb: '...' }
];

function buildLauncher() {
  var cards = GAMES.map(function (g) {
    return '<a class="game" href="' + g.href + '" style="--tint:' + g.tint + '">' +
      '<div class="icon">' + g.icon + '</div>' +
      '<div class="title">' + g.title + '</div>' +
      '<div class="blurb">' + g.blurb + '</div></a>';
  }).join('\n');

  var html = [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">',
    '<meta name="apple-mobile-web-app-capable" content="yes"><title>Kids Flight Deck</title>',
    '<style>',
    '*{margin:0;padding:0;box-sizing:border-box}html,body{height:100%;font-family:-apple-system,system-ui,sans-serif;',
    'background:radial-gradient(120% 120% at 50% 0%,#7fc0ff,#3f6fd0);color:#fff;-webkit-user-select:none;user-select:none}',
    'body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5vh;padding:5vh 4vw}',
    'h1{font-size:clamp(28px,6vh,56px);font-weight:800;text-shadow:0 3px 0 rgba(0,0,0,.15)}',
    '.deck{display:flex;gap:4vw;flex-wrap:wrap;align-items:center;justify-content:center}',
    '.game{text-decoration:none;color:#233;background:#fff;border-radius:28px;width:34vw;max-width:340px;',
    'aspect-ratio:1/1.1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.4vh;',
    'box-shadow:0 12px 0 rgba(0,0,0,.18),0 18px 30px rgba(0,0,0,.25);border-top:12px solid var(--tint);transition:transform .1s}',
    '.game:active{transform:scale(.95) translateY(4px)}',
    '.icon{font-size:clamp(60px,15vh,130px);line-height:1}',
    '.title{font-size:clamp(20px,3.4vh,32px);font-weight:800}',
    '.blurb{font-size:clamp(12px,2vh,17px);opacity:.7;text-align:center;padding:0 12px}',
    '</style></head><body>',
    '<h1>✈️ Flight Deck 🚀</h1>',
    '<div class="deck">', cards, '</div>',
    '</body></html>'
  ].join('\n');

  var out = path.join(DIST, 'index.html');
  fs.writeFileSync(out, html);
  return { out: out, bytes: Buffer.byteLength(html) };
}

// GitHub Pages (serving "from a branch") can only publish the repo root or
// /docs, not dist/. Emit a tiny root index.html that forwards to the launcher
// so the clean site root (e.g. user.github.io/aviation-sim/) lands on the game,
// and a .nojekyll so Pages serves the files verbatim.
function buildRootEntry() {
  var html = [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Flight Deck</title>',
    '<meta http-equiv="refresh" content="0; url=./dist/index.html">',
    '<link rel="canonical" href="./dist/index.html">',
    '<style>html,body{height:100%;margin:0;font-family:-apple-system,system-ui,sans-serif;',
    'background:radial-gradient(120% 120% at 50% 0%,#7fc0ff,#3f6fd0);color:#fff;',
    'display:flex;align-items:center;justify-content:center}a{color:#fff}</style></head>',
    '<body><p>Loading the Flight Deck… <a href="./dist/index.html">tap here if it doesn’t open</a>.</p>',
    '<script>location.replace("./dist/index.html")</scr' + 'ipt></body></html>'
  ].join('\n');
  fs.writeFileSync(path.join(ROOT, 'index.html'), html);
  fs.writeFileSync(path.join(ROOT, '.nojekyll'), '');
  return { out: path.join(ROOT, 'index.html'), bytes: Buffer.byteLength(html) };
}

if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
var g = buildGame();
var l = buildLauncher();
var r = buildRootEntry();
console.log('built ' + path.relative(ROOT, g.out) + '  (' + (g.bytes / 1024 / 1024).toFixed(2) + ' MB)');
console.log('built ' + path.relative(ROOT, l.out) + '  (' + (l.bytes / 1024).toFixed(1) + ' KB)');
console.log('built ' + path.relative(ROOT, r.out) + '  (Pages root redirect -> dist/index.html)');
