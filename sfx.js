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
function sweep(d, v, f0, f1, delay = 0, q = 1.2) { // 휙 소리: 걸러 낸 잡음이 미끄러짐
  const a = AC; if (!a) return;
  const t = a.currentTime + delay, b = a.createBuffer(1, Math.max(1, a.sampleRate * d), a.sampleRate), ch = b.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + d);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + d * .3); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  src.buffer = b; src.connect(f).connect(g).connect(a.destination); src.start(t); src.stop(t + d + .02);
}
function thump(f, d, v, delay = 0) { tone(f, d, 'sine', v, -f * .6, delay); }
let _lastHit = 0, _lastSwing = 0;
function sfx(k) {
  if (!S || !S.settings || !S.settings.sfx || !AC) return;
  const now = performance.now();
  switch (k) {
    case 'hit': if (now - _lastHit < 45) return; _lastHit = now; thump(150 + Math.random() * 50, .07, .13); noise(.045, .035); break;
    case 'heavy': if (now - _lastHit < 40) return; _lastHit = now; thump(115, .18, .22); noise(.1, .07); tone(240, .06, 'square', .035, -120); break;
    case 'swing': if (now - _lastSwing < 60) return; _lastSwing = now; sweep(.11, .09, 700 + Math.random() * 300, 2600, 0, 1.4); break;
    case 'shot': if (now - _lastSwing < 50) return; _lastSwing = now; tone(1100 + Math.random() * 200, .06, 'square', .03, -800); noise(.03, .025); break;
    case 'heavyshot': tone(500, .14, 'sawtooth', .05, -380); thump(120, .14, .16); noise(.08, .05); break;
    case 'dash': sweep(.16, .08, 2400, 500, 0, .9); break;
    case 'kill': thump(90, .25, .2); noise(.2, .08); tone(660, .08, 'square', .03, -500, .02); break;
    case 'hurt': tone(170, .12, 'square', .05, -90); thump(80, .12, .12); break;
    case 'perfect': sweep(.25, .07, 400, 3000); [1318, 1760, 2093].forEach((f, i) => tone(f, .16, 'triangle', .05, 0, .04 + i * .05)); break;
    case 'charge': sweep(.9, .05, 200, 1600, 0, 2); tone(110, .9, 'sawtooth', .025, 220); break;
    case 'charge2': tone(220, .6, 'square', .035, 660); tone(330, .6, 'triangle', .04, 990, .05); sweep(.6, .06, 500, 4000, 0, 3); break;
    case 'reveal': tone(784, .12, 'triangle', .05); tone(1175, .25, 'triangle', .05, 0, .08); noise(.2, .03, .02); break;
    case 'counter': tone(1600, .12, 'triangle', .06, -400); thump(100, .25, .25); noise(.18, .08); sweep(.2, .08, 3000, 600); break;
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
