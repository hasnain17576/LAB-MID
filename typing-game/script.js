'use strict';
const $ = s => document.querySelector(s);
const CFG = {
  bubbles: {
    easy:   {speed: 45,  gap: 1500, max: 5, missLimit: 8, wrong: 1},
    medium: {speed: 75,  gap: 1100, max: 6, missLimit: 6, wrong: 2},
    hard:   {speed: 110, gap: 800,  max: 8, missLimit: 5, wrong: 3}
  },
  magnet: {
    easy:   {time: 60, limit: 0,    wrong: 2},
    medium: {time: 45, limit: 2500, wrong: 4},
    hard:   {time: 30, limit: 1500, wrong: 5}
  }
};
const KEYSETS = {home: [...'ASDFJKL'], top: [...'QWERTYUIOP'], bottom: [...'ZXCVBNM'], all: [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']};
const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
let diff = 'medium', mode = null, game = null;
const best = JSON.parse(localStorage.getItem('trBest') || '{}');
const saveBest = (m, s) => { if (s > (best[m] || 0)) { best[m] = s; try { localStorage.setItem('trBest', JSON.stringify(best)); } catch (e) {} } };
const cap = s => s[0].toUpperCase() + s.slice(1);
const hud = items => $('#hud').innerHTML = items.map(([k, v]) => `<div class="chip">${k}: <b>${v}</b></div>`).join('');
const flash = (el, c) => { el.classList.remove('good', 'bad'); void el.offsetWidth; el.classList.add(c); setTimeout(() => el.classList.remove(c), 250); };

function rules() {
  const b = CFG.bubbles[diff], m = CFG.magnet[diff];
  $('#rulesB').textContent = `${cap(diff)}: speed ${b.speed}px/s, up to ${b.max} bubbles, ${b.missLimit} misses allowed, wrong key −${b.wrong}`;
  $('#rulesM').textContent = `${cap(diff)}: ${m.time}s round, ${m.limit ? 'target expires in ' + m.limit / 1000 + 's' : 'no per-target limit'}, wrong key −${m.wrong}`;
}
document.querySelectorAll('.diff button').forEach(b => b.onclick = () => {
  diff = b.dataset.d;
  document.querySelectorAll('.diff button').forEach(x => x.classList.toggle('on', x === b));
  rules();
  if (mode) resetGame();   // difficulty change mid-game safely resets
});
rules();

/* ---------- Bubbles ---------- */
class Bubbles {
  constructor() { this.arena = $('#arena'); this.c = CFG.bubbles[diff]; this.raf = null; this.init(); }
  init() {
    this.score = 0; this.misses = 0; this.hits = 0; this.wrong = 0; this.combo = 0; this.maxCombo = 0;
    this.level = 1; this.list = []; this.acc = 0; this.running = false; this.arena.innerHTML = '';
    this.draw();
  }
  get speed() { return this.c.speed * (1 + 0.15 * (this.level - 1)); }
  get max() { return Math.min(this.c.max + (this.level - 1), 12); }
  draw() {
    hud([['Score', this.score], ['Misses', `${this.misses}/${this.c.missLimit}`], ['Level', this.level], ['Combo', this.combo],
         ['Correct', this.hits], ['Wrong', this.wrong], ['Difficulty', cap(diff)]]);
  }
  start() {
    if (this.running) return;
    this.running = true; this.last = performance.now(); this.acc = this.c.gap;
    this.raf = requestAnimationFrame(t => this.tick(t));
  }
  spawn() {
    const used = new Set(this.list.map(b => b.ch));
    const pool = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter(l => !used.has(l));
    const ch = pool[Math.floor(Math.random() * pool.length)];
    const el = document.createElement('div'); el.className = 'bubble'; el.textContent = ch;
    const w = this.arena.clientWidth - 60;
    const b = {ch, el, x: Math.random() * Math.max(w, 10), y: this.arena.clientHeight};
    el.onpointerdown = e => { e.preventDefault(); this.key(ch); };
    this.arena.appendChild(el); this.list.push(b);
  }
  tick(now) {
    if (!this.running) return;
    const dt = Math.min((now - this.last) / 1000, 0.1); this.last = now;
    this.acc += dt * 1000;
    if (this.acc >= this.c.gap && this.list.length < this.max) { this.spawn(); this.acc = 0; }
    for (const b of [...this.list]) {
      b.y -= this.speed * dt;
      b.el.style.transform = `translate(${b.x}px,${b.y}px)`;
      if (b.y < -4) {                       // reached top = miss
        this.remove(b); this.misses++; this.combo = 0; flash(this.arena, 'bad'); this.draw();
        if (this.misses >= this.c.missLimit) return this.end();
      }
    }
    this.raf = requestAnimationFrame(t => this.tick(t));
  }
  remove(b) { this.list = this.list.filter(x => x !== b); b.el.remove(); }
  key(k) {
    if (!this.running) return;
    const m = this.list.filter(b => b.ch === k).sort((a, b) => a.y - b.y)[0]; // closest to top first
    if (m) {
      this.list = this.list.filter(x => x !== m); m.el.classList.add('pop'); setTimeout(() => m.el.remove(), 200);
      this.hits++; this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += 10 + Math.min(this.combo, 10);
      const lv = 1 + Math.floor(this.score / 100);
      if (lv > this.level) this.level = lv;     // difficulty ramp: faster + more bubbles
      flash(this.arena, 'good');
    } else {
      this.wrong++; this.combo = 0; this.score = Math.max(0, this.score - this.c.wrong); flash(this.arena, 'bad');
    }
    this.draw();
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); this.raf = null; }
  end() {
    this.stop(); saveBest('bubbles', this.score);
    const tot = this.hits + this.wrong;
    showResults('Game Over 💥', [['Score', this.score], ['Best', best.bubbles || 0], ['Bubbles popped', this.hits], ['Misses', this.misses],
      ['Wrong keys', this.wrong], ['Accuracy', (tot ? Math.round(this.hits / tot * 100) : 0) + '%'], ['Best combo', this.maxCombo], ['Level reached', this.level]]);
  }
}

/* ---------- KeyMagnet ---------- */
class Magnet {
  constructor() { this.arena = $('#arena'); this.c = CFG.magnet[diff]; this.set = KEYSETS[$('#keyset').value]; this.timer = null; this.init(); }
  init() {
    this.score = 0; this.ok = 0; this.bad = 0; this.times = []; this.target = null; this.left = this.c.time; this.running = false;
    this.arena.className = 'arena magnet'; this.arena.innerHTML = '<div class="target">?</div><div class="fb"></div>';
    this.buildKb(); this.draw();
  }
  buildKb() {
    $('#kb').innerHTML = ROWS.map(r => `<div class="row">${[...r].map(k => `<div class="key ${this.set.includes(k) ? 'act' : ''}" data-k="${k}">${k}</div>`).join('')}</div>`).join('');
    $('#kb').querySelectorAll('.key').forEach(el => el.onpointerdown = e => { e.preventDefault(); this.key(el.dataset.k); });
  }
  get avg() { return this.times.length ? Math.round(this.times.reduce((a, b) => a + b) / this.times.length) : 0; }
  draw() {
    hud([['Score', this.score], ['Time', this.left.toFixed(1) + 's'], ['Correct', this.ok], ['Wrong', this.bad],
         ['Avg time', this.avg + 'ms'], ['Difficulty', cap(diff)]]);
  }
  next() {
    let k; do { k = this.set[Math.floor(Math.random() * this.set.length)]; } while (k === this.target && this.set.length > 1);
    this.target = k; this.t0 = performance.now();
    this.arena.querySelector('.target').textContent = k;
    $('#kb').querySelectorAll('.key').forEach(el => el.classList.toggle('tg', el.dataset.k === k));
  }
  fb(t, color) { const f = this.arena.querySelector('.fb'); f.textContent = t; f.style.color = color; }
  start() {
    if (this.running) return;
    this.running = true; this.endAt = performance.now() + this.left * 1000; this.next();
    this.timer = setInterval(() => {            // single timer drives clock + per-target limit
      const now = performance.now(); this.left = Math.max(0, (this.endAt - now) / 1000);
      if (this.c.limit && now - this.t0 > this.c.limit) { this.penalize('Too slow! ⏱'); this.next(); }
      this.draw(); if (this.left <= 0) this.end();
    }, 100);
  }
  penalize(msg) { this.bad++; this.score = Math.max(0, this.score - this.c.wrong); flash(this.arena, 'bad'); this.fb(msg, 'var(--bad)'); }
  key(k) {
    if (!this.running) return;
    const el = $(`#kb .key[data-k="${k}"]`);
    if (k === this.target) {
      const rt = performance.now() - this.t0; this.times.push(rt); this.ok++;
      this.score += 10 + Math.max(0, 10 - Math.floor(rt / 150));   // speed bonus
      flash(this.arena, 'good'); this.fb(`✔ ${Math.round(rt)}ms`, 'var(--ok)');
      if (el) { el.classList.add('ok'); setTimeout(() => el.classList.remove('ok'), 150); }
      this.next();
    } else {
      this.penalize(`✖ You pressed ${k}`);
      if (el) { el.classList.add('no'); setTimeout(() => el.classList.remove('no'), 200); }
    }
    this.draw();
  }
  stop() { this.running = false; clearInterval(this.timer); this.timer = null; }
  end() {
    this.stop(); saveBest('magnet', this.score);
    const tot = this.ok + this.bad;
    showResults("Time's Up ⏰", [['Score', this.score], ['Best', best.magnet || 0], ['Correct', this.ok], ['Incorrect', this.bad],
      ['Accuracy', (tot ? Math.round(this.ok / tot * 100) : 0) + '%'], ['Avg response', this.avg + 'ms'],
      ['Fastest', this.times.length ? Math.round(Math.min(...this.times)) + 'ms' : '-'], ['Key set', $('#keyset').selectedOptions[0].text.split(' ')[0]]]);
  }
}

/* ---------- Controller ---------- */
function showResults(title, rows) {
  $('#resT').textContent = title;
  $('#resBody').innerHTML = rows.map(([k, v]) => `<div>${k}<b>${v}</b></div>`).join('');
  $('#results').classList.remove('hidden');
}
function open(m) {
  mode = m; $('#home').classList.add('hidden'); $('#gameScreen').classList.remove('hidden');
  $('#modeName').textContent = m === 'bubbles' ? '🫧 Bubbles' : '🧲 KeyMagnet';
  $('#kb').classList.toggle('hidden', m !== 'magnet');
  resetGame();
}
function resetGame() {              // stop everything, rebuild fresh state, show ready overlay
  if (game) game.stop();
  game = mode === 'bubbles' ? new Bubbles() : new Magnet();
  $('#results').classList.add('hidden'); $('#ready').classList.remove('hidden');
  $('#readyT').textContent = mode === 'bubbles' ? 'Bubbles' : 'KeyMagnet';
  $('#readyP').textContent = mode === 'bubbles'
    ? `Type the letter on a bubble (or tap it). Don't let ${game.c.missLimit} escape!`
    : `Hit the highlighted key. ${game.c.time}s on the clock.`;
}
function startGame() { $('#ready').classList.add('hidden'); $('#results').classList.add('hidden'); game.start(); }
function restartGame() { resetGame(); startGame(); }    // full state reset, no reload
function goHome() { if (game) game.stop(); game = null; mode = null; $('#arena').innerHTML = ''; $('#gameScreen').classList.add('hidden'); $('#home').classList.remove('hidden'); }

$('#startB').onclick = () => { open('bubbles'); startGame(); };
$('#startM').onclick = () => { open('magnet'); startGame(); };
$('#bStart').onclick = $('#readyGo').onclick = startGame;
$('#bRestart').onclick = $('#resAgain').onclick = restartGame;
$('#bReset').onclick = resetGame;
$('#bHome').onclick = $('#resHome').onclick = goHome;
document.addEventListener('keydown', e => {
  if (!game || e.ctrlKey || e.metaKey || e.altKey || !/^[a-z]$/i.test(e.key)) return;
  if (document.activeElement && document.activeElement.tagName === 'SELECT') return;
  game.key(e.key.toUpperCase());
});
