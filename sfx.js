'use strict';
/* 효과음: 파일 없이 WebAudio로 합성해요. 첫 터치 뒤에 켜져요. */
let AC = null;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
addEventListener('pointerdown', () => audio(), { once: true });
function tone(f, d, type = 'square', v = .06, slide = 0, delay = 0) {
  const a = AC; if (!a) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + .02);
}
function noise(d, v = .05, delay = 0) {
  const a = AC; if (!a) return;
  const t = a.currentTime + delay, b = a.createBuffer(1, Math.max(1, a.sampleRate * d), a.sampleRate), ch = b.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
  const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
  s.buffer = b; g.gain.value = v; s.connect(f).connect(g).connect(a.destination); s.start(t);
}
let _lastHit = 0;
function sfx(k) {
  if (!S || !S.settings || !S.settings.sfx || !AC) return;
  const now = performance.now();
  switch (k) {
    case 'hit': if (now - _lastHit < 70) return; _lastHit = now; noise(.05, .03); break;
    case 'crit': tone(880, .08, 'square', .05, 400); noise(.07, .04); break;
    case 'ult': tone(220, .35, 'sawtooth', .06, 660); tone(440, .3, 'square', .03, 880, .05); break;
    case 'boom': noise(.35, .09); tone(90, .35, 'sine', .12, -50); break;
    case 'heal': tone(660, .15, 'sine', .05, 330); break;
    case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, .18, 'square', .05, 0, i * .09)); break;
    case 'lose': [392, 330, 262].forEach((f, i) => tone(f, .25, 'triangle', .06, 0, i * .14)); break;
    case 'click': tone(1200, .03, 'square', .025); break;
    case 'flip': tone(500 + Math.random() * 300, .06, 'triangle', .04, 300); break;
    case 'legend': [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, .3, 'sawtooth', .04, 0, i * .07)); noise(.5, .04, .1); break;
    case 'reward': tone(988, .08, 'square', .04); tone(1318, .14, 'square', .04, 0, .08); break;
    case 'lvup': [440, 554, 659, 880].forEach((f, i) => tone(f, .1, 'square', .04, 0, i * .05)); break;
    case 'bad': tone(180, .15, 'square', .05, -60); break;
  }
}
