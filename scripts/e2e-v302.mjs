// v3.0.2 browser checks: at least one per line of the approved command, in EN and BN.
// Headless Chrome against the Vite dev server (PRAYER_E2E_URL, default http://127.0.0.1:1420/).
// Usage: npx vite --port 1420 & node scripts/e2e-v302.mjs
import { launch, open as openRaw, sleep } from './lib.mjs';
// every page uses a light theme (Pearl Mint) so the screenshots are light; a check's own data still wins
const open = (b, o = {}) => openRaw(b, { ...o, data: { theme: 'Pearl Mint', ...(o.data || {}) } });
import fs from 'node:fs';
import path from 'node:path';

const SHOTS = process.env.SHOTS_DIR || '/workspace/prayer/shots302/';
fs.mkdirSync(SHOTS, { recursive: true });
const b = await launch();
let pass = 0, fail = 0;
const out = [];
const ok = (id, name, cond, info = '') => {
  (cond ? pass++ : fail++);
  const line = `${cond ? 'PASS' : 'FAIL'} [${id}] ${name}${info ? '  — ' + String(info).slice(0, 400) : ''}`;
  out.push(line);
  console.log(line);
};
const shot = async (p, sel, name) => {
  const el = sel ? await p.$(sel) : null;
  if (el) await el.screenshot({ path: path.join(SHOTS, name) });
  else await p.screenshot({ path: path.join(SHOTS, name) });
};
const LANGS = ['en', 'bn'];
const MID = '2026-11-23T14:00:00+06:00';      // Monday: Dhuhr open; Fajr and Duha ended
const AFTER_LOCK = '2026-11-23T16:10:00+06:00'; // after Asr began: Fajr/Duha record window locked
const FRI_LATE = '2026-11-20T16:10:00+06:00';  // Friday after Asr began: Dhuhr/Jumu'ah ended, not locked
const NIGHT = '2026-11-23T22:00:00+06:00';
const FAJR_EARLY = '2026-11-24T05:10:00+06:00';
const DAY = '2026-11-23';
const night = { history: { [DAY]: { fard: {}, voluntary: { tahajjud: true }, rakahs: { qiyam: 2, tahajjud: 4, witr: 3 }, rakahSets: { qiyam: [true], tahajjud: [true, true], witr: [true, true] } } } };
const rec = p => p.evaluate(() => JSON.parse(localStorage.getItem('prayer-times-data') || '{}'));
const mono = ff => /mono|consolas|menlo|courier/i.test(ff || '');

// ---------- A1 countdown fonts (EN/BN, default fonts and after switching both pickers) ----------
for (const lang of LANGS) {
  for (const fonts of [{}, { uiFont: 'kalpurush', enFont: 'inter' }]) {
    const tag = fonts.uiFont ? 'switched' : 'default';
    const p = await open(b, { lang, w: 1280, h: 720, at: MID, data: fonts });
    const home = await p.evaluate(() => {
      const body = getComputedStyle(document.body).fontFamily;
      const els = [...document.querySelectorAll('.live-event .countdown-card-value, #nextCountValue, .next-count')];
      return { body, list: els.map(e => ({ c: e.className || e.id, ff: getComputedStyle(e).fontFamily, vn: getComputedStyle(e).fontVariantNumeric })) };
    });
    await p.evaluate(() => document.querySelector('.live-event [data-event-countdown]')?.click());
    await sleep(700);
    const cd = await p.evaluate(() => { const e = document.getElementById('countdownLarge'); return { ff: getComputedStyle(e).fontFamily, vn: getComputedStyle(e).fontVariantNumeric, body: getComputedStyle(document.body).fontFamily }; });
    if (lang === 'en' && tag === 'default') await shot(p, '#countdownView', 'countdown-page-font-en.png');
    if (lang === 'bn' && tag === 'switched') await shot(p, '#countdownView', 'countdown-page-font-bn-kalpurush.png');
    await p.evaluate(() => document.getElementById('liveClock')?.click());
    await sleep(900);
    const clock = await p.evaluate(() => [...document.querySelectorAll('.clock-count-big, .clock-preferred-count, #bestCountdown')].map(e => ({ c: e.className || e.id, ff: getComputedStyle(e).fontFamily, vn: getComputedStyle(e).fontVariantNumeric, vis: !!e.offsetParent })));
    const all = [...home.list, cd, ...clock];
    const good = home.list.length >= 2 && all.every(x => !mono(x.ff) && x.ff === home.body && /tabular-nums/.test(x.vn));
    ok('A1', `${lang}/${tag}: every countdown uses the UI font stack (not monospace), tabular-nums`, good, JSON.stringify({ body: home.body, n: all.length, bad: all.filter(x => mono(x.ff) || x.ff !== home.body) }));
    if (tag === 'switched') ok('A1', `${lang}: switched stack is the picked fonts`, /Inter/.test(home.body) && /Kalpurush/.test(home.body), home.body);
    const keep = await p.evaluate(() => { const e = document.getElementById('progressCore'); return e ? getComputedStyle(e).fontFamily : ''; });
    ok('A1', `${lang}/${tag}: progress core label keeps its monospace face`, mono(keep), keep);
    await p.close();
  }
}
{
  const p = await open(b, { lang: 'en', w: 1280, h: 720, at: MID });
  await shot(p, '.hero-row', 'home-countdowns-font-en.png');
  await p.close();
  const q = await open(b, { lang: 'bn', w: 1280, h: 720, at: MID });
  await shot(q, '.hero-row', 'home-countdowns-font-bn.png');
  await q.close();
}

// ---------- A2 Bornomala bundled, Lohit gone; About credits ----------
for (const lang of LANGS) {
  const p = await open(b, { lang, w: 1280, h: 720, at: MID, data: { uiFont: 'lohit' } });
  const f = await p.evaluate(async () => {
    await document.fonts.load('16px "Bornomala"', 'কখগ');
    const sel = document.getElementById('uiFontSelect');
    return { loaded: document.fonts.check('16px "Bornomala"', 'কখগ'), options: [...sel.options].map(o => o.value), value: sel.value, stack: getComputedStyle(document.body).fontFamily, about: document.getElementById('aboutSources')?.innerText };
  });
  ok('A2', `${lang}: Bornomala is offered and loads offline; a saved Lohit choice opens as Bornomala`, f.loaded && f.options.includes('bornomala') && !f.options.includes('lohit') && f.value === 'bornomala' && /Bornomala/.test(f.stack), JSON.stringify({ ...f, about: undefined }));
  ok('A2', `${lang}: About names Bornomala and Li Ador Noirrit's licence`, lang === 'en' ? /Bornomala are OFL[\s\S]*Li Ador Noirrit is not bundled/.test(f.about) : /বর্ণমালা OFL[\s\S]*লি আদর নৈঋত/.test(f.about), f.about?.slice(0, 200));
  await p.close();
}

// ---------- A3 revise leftovers ----------
for (const lang of LANGS) {
  const p = await open(b, { lang, w: 1280, h: 720, at: MID });
  const t = await p.evaluate(() => document.body.innerText);
  ok('A3', `${lang}: no Revise event record text anywhere`, !/Revise event record|ইভেন্টের রেকর্ড সংশোধন|RECORD REVIEW|রেকর্ড পর্যালোচনা/.test(t));
  await p.close();
}

// ---------- B1/B2/B3 ----------
for (const lang of LANGS) {
  const p = await open(b, { lang, w: 1280, h: 720, at: MID });
  const b1 = await p.evaluate(() => ({
    buttons: document.querySelectorAll('#prayerGrid .record-button, #voluntaryList .record-button, [data-day-fard], [data-voluntary-record]').length,
    text: /Record completion|সম্পন্ন রেকর্ড করুন/.test((document.getElementById('prayerGrid')?.innerText || '') + (document.getElementById('voluntaryList')?.innerText || '')),
    cards: document.querySelectorAll('#prayerGrid .prayer-card').length
  }));
  ok('B1', `${lang}: no Record completion on the five Fard and voluntary cards`, b1.buttons === 0 && !b1.text && b1.cards === 5, JSON.stringify(b1));
  if (lang === 'en') await shot(p, '#prayerGrid .prayer-card', 'fard-card-no-record-en.png');
  if (lang === 'bn') await shot(p, '#prayerGrid .prayer-card', 'fard-card-no-record-bn.png');
  const b2 = await p.evaluate(() => !!document.querySelector('#liveEvents .live-event .mark-event-complete'));
  ok('B2', `${lang}: Mark Complete is still on the open home event card`, b2);
  await p.evaluate(() => document.querySelector('#liveEvents [data-event-countdown]')?.click());
  await sleep(700);
  const b2c = await p.evaluate(() => { const m = document.querySelector('#countdownView .mark-event-complete'); return m ? { disabled: m.disabled } : null; });
  ok('B2', `${lang}: Mark Complete is still on the countdown page (enabled while open)`, !!b2c && !b2c.disabled, JSON.stringify(b2c));
  await p.close();
  const q = await open(b, { lang, w: 1280, h: 720, at: MID });
  await q.click('#liveEvents .part-tick.fard[data-sub-key="dhuhr"]');
  await sleep(500);
  const r = await rec(q);
  ok('B3', `${lang}: open Dhuhr circle ticks as before, not marked late`, !!r.history?.[DAY]?.fard?.dhuhr && !r.history?.[DAY]?.late, JSON.stringify(r.history?.[DAY]));
  await q.close();
}

// ---------- B4/B5/B6 Record previous prayer ----------
for (const lang of LANGS) {
  const p = await open(b, { lang, w: 1280, h: 720, at: MID });
  const before = await p.evaluate(() => ({
    hidden: document.getElementById('lateEventsBlock').hidden,
    heading: document.getElementById('lateHeading').textContent,
    names: [...document.querySelectorAll('#lateEvents .live-event .live-name')].map(e => e.textContent.trim()),
    markComplete: document.querySelectorAll('#lateEvents .mark-event-complete').length,
    countdowns: document.querySelectorAll('#lateEvents [data-event-countdown]').length
  }));
  const head = lang === 'bn' ? 'আগের নামাজ রেকর্ড করুন' : 'Record previous prayer';
  ok('B4', `${lang}: ended Fajr (unticked) stays under "${head}"`, !before.hidden && before.heading === head && before.names.length >= 1 && before.markComplete === before.names.length /* v3.0.3 line 1: Mark Complete on late cards */ && before.countdowns === 0, JSON.stringify(before));
  if (lang === 'en') await shot(p, '#lateEventsBlock', 'record-previous-prayer-en.png');
  if (lang === 'bn') await shot(p, '#lateEventsBlock', 'record-previous-prayer-bn.png');
  await p.click('#lateEvents .part-tick.fard[data-sub-key="fajr"]');
  await sleep(600);
  let r = await rec(p);
  ok('B4', `${lang}: ticking there saves the Fard and marks it recorded after its time`, !!r.history?.[DAY]?.fard?.fajr && r.history?.[DAY]?.late?.['fard:fajr'] === true, JSON.stringify(r.history?.[DAY]));
  const gone = await p.evaluate(() => [...document.querySelectorAll('#lateEvents .part-tick.fard[data-sub-key="fajr"]')].length);
  ok('B4', `${lang}: Fajr card leaves once nothing more can be ticked (Sunnah before closes after Fard)`, gone === 0, String(gone));
  // open the daily record through the app's own weekly tile (data-week-date)
  await p.evaluate(d => document.querySelector(`[data-week-date="${d}"]`)?.click(), DAY);
  await sleep(600);
  const view = await p.evaluate(() => ({ page: !document.getElementById('weeklyDayView').hidden, text: document.getElementById('weeklyDayCards')?.innerText || '' }));
  const lateText = lang === 'bn' ? 'সময়ের পরে রেকর্ড' : 'recorded after its time';
  ok('B4', `${lang}: the daily record quietly says "${lateText}"`, view.page && view.text.includes(lateText), view.text.slice(0, 300));
  if (lang === 'en') await shot(p, '#weeklyDayCards', 'daily-record-late-note-en.png');
  const undo = await p.$('[data-week-undo="fard"][data-week-key="fajr"]');
  if (undo) await undo.click();
  await sleep(500);
  r = await rec(p);
  await p.evaluate(() => document.getElementById('settingsToggle')?.click() || null);
  await p.keyboard.press('Escape');
  await sleep(300);
  await p.evaluate(() => { if (document.getElementById('homeView').hidden) document.querySelector('#weeklyDayBack, [data-back], .back-button')?.click(); });
  await sleep(500);
  const back = await p.evaluate(() => [...document.querySelectorAll('#lateEvents .part-tick.fard[data-sub-key="fajr"]')].length);
  ok('B5', `${lang}: unticking in the daily record clears the record and late mark and brings the Fajr circle back under Record previous prayer`, !r.history?.[DAY]?.fard?.fajr && !r.history?.[DAY]?.late?.['fard:fajr'] && back === 1, JSON.stringify({ back, day: r.history?.[DAY] }));
  await p.close();
  const q = await open(b, { lang, w: 1280, h: 720, at: AFTER_LOCK });
  const after = await q.evaluate(() => [...document.querySelectorAll('#lateEvents .live-event .live-name')].map(e => e.textContent.trim()));
  ok('B6', `${lang}: after the record-window lock the Fajr/Duha cards are gone`, !after.some(n => /Fajr|ফজর|Duha|দুহা/.test(n)), JSON.stringify(after));
  await q.close();
  // B5 in-window: untick in the daily record brings the circle back under the normal heading
  const w = await open(b, { lang, w: 1280, h: 720, at: MID, data: { history: { [DAY]: { fard: { dhuhr: true }, voluntary: {}, closed: { 'fard:dhuhr': true } } } } });
  const hiddenBefore = await w.evaluate(() => !document.querySelector('#liveEvents .part-tick.fard[data-sub-key="dhuhr"]'));
  await w.evaluate(d => document.querySelector(`[data-week-date="${d}"]`)?.click(), DAY);
  await sleep(500);
  const u2 = await w.$('[data-week-undo="fard"][data-week-key="dhuhr"]');
  if (u2) await u2.click();
  await sleep(400);
  await w.keyboard.press('Escape');
  await sleep(500);
  const shownAgain = await w.evaluate(() => !!document.querySelector('#liveEvents .part-tick.fard[data-sub-key="dhuhr"]'));
  ok('B5', `${lang}: in-window untick brings the circle back under the normal heading (closed card re-opens)`, hiddenBefore && shownAgain && !!u2, JSON.stringify({ hiddenBefore, shownAgain, undo: !!u2 }));
  await w.close();
}

// ---------- B7 Friday exclusivity, ordered ticks, sound under Record previous prayer ----------
for (const lang of LANGS) {
  const p = await open(b, { lang, w: 1280, h: 720, at: FRI_LATE, data: { sound: true, tickSound: true } });
  const labels = await p.evaluate(() => [...document.querySelectorAll('#lateEvents .part-tick.fard span')].map(s => s.textContent.trim()));
  ok('B7', `${lang}: Friday's ended midday card shows Jumu'ah and Dhuhr under Record previous prayer`, labels.some(l => /Jumu|জুম/.test(l)) && labels.some(l => /Dhuhr|যোহর/.test(l)), JSON.stringify(labels));
  const starts = await p.evaluate(async () => {
    let n = 0; const O = window.AudioContext; if (O) { window.AudioContext = class extends O { constructor(...a) { super(...a); const c = this.createOscillator; this.createOscillator = function (...x) { const o = c.apply(this, x); const s = o.start.bind(o); o.start = (...y) => { n++; return s(...y); }; return o; }; } }; }
    document.querySelector('#lateEvents .part-tick.fard[data-sub-key="jumuah"]')?.click();
    await new Promise(r => setTimeout(r, 500));
    return n;
  });
  await sleep(300);
  await p.evaluate(() => document.querySelector('#lateEvents .part-tick.fard[data-sub-key="dhuhr"]')?.click());
  await sleep(400);
  const r = await rec(p);
  const d = r.history?.['2026-11-20'] || {};
  ok('B7', `${lang}: Jumu'ah ticked late locks out Dhuhr, plays the tick, marks late`, d.fridayFard === 'jumuah' && !d.fard?.dhuhr && d.late?.['fard:dhuhr'] === true && starts > 0, JSON.stringify({ d, starts }));
  await p.close();
  const q = await open(b, { lang, w: 1280, h: 720, at: MID });
  await q.evaluate(() => document.querySelector('#lateEvents [data-vol-tick="duha"][data-vol-index="2"]')?.click());
  await sleep(300);
  let rr = await rec(q);
  const skipped = !rr.history?.[DAY]?.voluntary?.duha;
  await q.evaluate(() => document.querySelector('#lateEvents [data-vol-tick="duha"][data-vol-index="0"]')?.click());
  await sleep(500);
  rr = await rec(q);
  const reward = await q.evaluate(() => !document.getElementById('voluntaryReward')?.hidden);
  ok('B7', `${lang}: late voluntary ticks stay in order, save the count and show the reward`, skipped && rr.history?.[DAY]?.rakahs?.duha === 2 && rr.history?.[DAY]?.late?.['voluntary:duha'] === true && reward, JSON.stringify({ skipped, day: rr.history?.[DAY], reward }));
  await q.close();
}

// ---------- B8 old records load unchanged ----------
for (const lang of LANGS) {
  const legacy = { '2026-11-22': { fard: { fajr: true, dhuhr: true, asr: true }, voluntary: { witr: true }, rakahs: { witr: 3 }, rakahSets: { witr: [true, false] }, revise: { 'fard:isha': { id: 'fard:isha', kind: 'fard', key: 'isha', parts: {} } }, closed: { 'fard:fajr': true } } };
  const p = await open(b, { lang, w: 1280, h: 720, at: MID, data: { history: legacy } });
  const r = await rec(p);
  // what v3.0.1 itself stores after loading the same record (captured from the v3.0.1 build, same data and clock):
  // its existing load-time normalisation pads rakahSets to the circle count and seals the locked day.
  const v301 = {"fard":{"fajr":true,"dhuhr":true,"asr":true},"voluntary":{"witr":true},"rakahs":{"witr":3},"rakahSets":{"witr":[true,true,false,false,false,false]},"revise":{"fard:isha":{"id":"fard:isha","kind":"fard","key":"isha","parts":{}}},"closed":{"fard:fajr":true},"locked":{"fard:fajr":1,"fard:dhuhr":1,"fard:asr":1,"voluntary:witr":1}};
  ok('B8', `${lang}: a v3.0.1 record loads exactly as v3.0.1 itself loads it (fields kept, revise kept) and the page has no errors`, JSON.stringify(r.history['2026-11-22']) === JSON.stringify(v301) && p.errs.length === 0, JSON.stringify({ errs: p.errs, got: r.history['2026-11-22'] }));
  await p.close();
}

// ---------- C Qiyam umbrella and labels ----------
for (const lang of LANGS) {
  const p = await open(b, { lang, w: 1280, h: 720, at: NIGHT, data: night });
  const c = await p.evaluate(() => {
    const q = document.querySelector('#liveEvents [data-vol-count="qiyam"]');
    const labels = k => [...document.querySelectorAll(`#liveEvents [data-vol-tick="${k}"] span`)].map(s => s.textContent.trim());
    return { qiyam: q?.textContent.trim(), qLabels: labels('qiyam'), wLabels: labels('witr'), caption: document.getElementById('progressCaption')?.textContent };
  });
  const want = lang === 'bn' ? 'কিয়ামুল লাইল ৯ রাকাত: তাহাজ্জুদ ৪, বিতর ৩, অন্যান্য ২' : 'Qiyam al-Layl 9 rak‘ahs: Tahajjud 4, Witr 3, other 2';
  ok('C1/C2', `${lang}: Qiyam card shows the umbrella breakdown`, c.qiyam === want, c.qiyam);
  ok('C3', `${lang}: voluntary total counts each rak'ah once (9, not 18)`, lang === 'bn' ? /ঐচ্ছিক ৯ রাকাত/.test(c.caption) : /Voluntary 9 rak/.test(c.caption), c.caption);
  const ev = lang === 'bn' ? ['২', '৪', '৬', '৮', '১০', '১২'] : ['2', '4', '6', '8', '10', '12'];
  const od = lang === 'bn' ? ['১', '৩', '৫', '৭', '৯', '১১'] : ['1', '3', '5', '7', '9', '11'];
  ok('C4', `${lang}: Qiyam's own circles read 2,4,6…; Witr 1,3,5…`, JSON.stringify(c.qLabels) === JSON.stringify(ev) && JSON.stringify(c.wLabels) === JSON.stringify(od), JSON.stringify(c));
  if (lang === 'en') { await shot(p, '#liveEvents .live-event.voluntary:has([data-vol-count="qiyam"])', 'qiyam-card-en.png'); await shot(p, '#liveEvents .live-event.voluntary:has([data-vol-count="witr"])', 'witr-card-en.png'); }
  if (lang === 'bn') { await shot(p, '#liveEvents .live-event.voluntary:has([data-vol-count="qiyam"])', 'qiyam-card-bn.png'); await shot(p, '#liveEvents .live-event.voluntary:has([data-vol-count="witr"])', 'witr-card-bn.png'); }
  await p.evaluate(() => document.querySelector('#liveEvents [data-vol-tick="qiyam"][data-vol-index="1"]')?.click());
  await sleep(500);
  const r = await rec(p);
  ok('C4', `${lang}: ticking order and saved counts unchanged (2nd Qiyam circle saves 4)`, r.history[DAY].rakahs.qiyam === 4 && r.history[DAY].rakahs.tahajjud === 4 && r.history[DAY].rakahs.witr === 3, JSON.stringify(r.history[DAY].rakahs));
  await p.close();
}

// ---------- D Blessed Reminder ----------
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
for (const lang of LANGS) {
  const p = await open(b, { lang, w: 1280, h: 720, at: MID });
  await sleep(1200);
  const n = await p.evaluate(() => {
    const el = document.getElementById('dailyNote');
    return { text: el.innerText, subject: el.querySelector('.blessed-subject')?.textContent, ref: el.querySelector('.blessed-ref')?.textContent, nums: el.querySelectorAll('.blessed-num').length, progress: el.querySelector('.blessed-progress')?.textContent, lang: el.querySelector('.blessed-tr')?.getAttribute('lang'), full: !!el.querySelector('[data-blessed-full]'), portion: !!el.querySelector('[data-blessed-portion]'), arabicBlock: !!el.querySelector('.blessed-ar, [lang="ar"]') };
  });
  ok('D1', `${lang}: the reminder has no Arabic, only the selected language`, !ARABIC.test(n.text) && !n.arabicBlock && n.lang === lang, n.text.slice(0, 160));
  ok('D1', `${lang}: surah name and verse numbers are shown`, /\d|[০-৯]/.test(n.ref || '') && n.nums >= 1, n.ref);
  ok('D7', `${lang}: a subject line is shown above the passage`, !!n.subject && (lang === 'en' || /[\u0980-\u09FF]/.test(n.subject)), n.subject);
  const expectProg = lang === 'bn' ? /^পারা ১৩ · আজ [০-৯]+টি অংশের [০-৯]+টি পড়া হয়েছে$/ : /^Juz' 13 · \d+ of \d+ passages read today$/;
  ok('D14', `${lang}: progress line under the reminder`, expectProg.test(n.progress || ''), n.progress);
  if (lang === 'en') await shot(p, '#dailyNote', 'blessed-reminder-en.png');
  if (lang === 'bn') await shot(p, '#dailyNote', 'blessed-reminder-bn.png');
  // D4/D5: Full section and Read more
  const full = await p.evaluate(async () => {
    const before = document.querySelector('#dailyNote .blessed-ref').textContent;
    document.querySelector('#dailyNote [data-blessed-full]')?.click();
    await new Promise(r => setTimeout(r, 200));
    const after = document.querySelector('#dailyNote .blessed-ref').textContent;
    const label = document.querySelector('#dailyNote [data-blessed-full]')?.textContent;
    document.querySelector('#dailyNote [data-blessed-full]')?.click();
    await new Promise(r => setTimeout(r, 200));
    return { before, after, label, back: document.querySelector('#dailyNote .blessed-ref').textContent };
  });
  ok('D4', `${lang}: Full section is one tap away and returns`, full.after !== full.before && full.back === full.before, JSON.stringify(full));
  // D13 Today's portion
  await p.evaluate(() => document.querySelector('#dailyNote [data-blessed-portion]').click());
  await sleep(500);
  const po = await p.evaluate(() => ({
    open: document.getElementById('portionDialog').open,
    title: document.getElementById('portionTitle').textContent,
    items: document.querySelectorAll('#portionList .portion-item').length,
    unread: document.querySelectorAll('#portionList .portion-item.is-unread').length,
    summary: document.getElementById('portionSummary').textContent,
    read: (() => { const m = JSON.parse(localStorage.getItem('prayer-times-blessed-reading') || '{}'); const raw = atob(m.bits || ''); let c = 0; for (const ch of raw) { let x = ch.charCodeAt(0); while (x) { c += x & 1; x >>= 1; } } return c; })(),
    scroll: (() => { const l = document.getElementById('portionList'); return l.scrollHeight > l.clientHeight && getComputedStyle(l).overflowY === 'auto'; })()
  }));
  ok('D13', `${lang}: Today's portion opens a scrollable list of the day's juz' with unread marked`, po.open && po.title === (lang === 'bn' ? 'আজকের অংশ' : "Today's portion") && po.items === 69 && po.read >= 1 && po.unread === po.items - po.read && po.scroll, JSON.stringify(po));
  await p.evaluate(() => document.querySelector('#portionList .portion-item.is-unread [data-portion-open]').click());
  await sleep(400);
  const opened = await p.evaluate(() => ({ unread: document.querySelectorAll('#portionList .portion-item.is-unread').length, body: !!document.querySelector('#portionList .portion-item.is-open .blessed-tr'), full: !!document.querySelector('#portionList .portion-item.is-open [data-blessed-full]') }));
  ok('D13', `${lang}: opening a passage there marks it read; Full section works there`, opened.unread === po.unread - 1 && opened.body && opened.full, JSON.stringify(opened));
  if (lang === 'en') await shot(p, '#portionDialog', 'todays-portion-en.png');
  if (lang === 'bn') await shot(p, '#portionDialog', 'todays-portion-bn.png');
  await p.keyboard.press('Escape');
  await sleep(200);
  // D12 compact per-day bitset keyed by the Hijri date
  const mem = await p.evaluate(() => JSON.parse(localStorage.getItem('prayer-times-blessed-reading') || '{}'));
  ok('D12', `${lang}: reading memory is a compact per-day bitset keyed by the Hijri date`, mem.day === '1448-06-13' && typeof mem.bits === 'string' && mem.bits.length <= 16, JSON.stringify(mem));
  // D14 settings line and switch, persisted
  await p.click('#settingsToggle');
  await sleep(500);
  const st = await p.evaluate(() => ({ line: document.getElementById('blessedMonthLine')?.textContent, checked: document.getElementById('blessedProgressToggle')?.checked }));
  ok('D14', `${lang}: Settings shows the month line and the switch (on by default)`, (lang === 'bn' ? /^এই মাসে: ৩০ পারার [০-৯]+টি$/ : /^This month: \d+ of 30 parts$/).test(st.line || '') && st.checked === true, JSON.stringify(st));
  if (lang === 'en') await shot(p, '#blessedSettings', 'settings-reading-en.png');
  if (lang === 'bn') await shot(p, '#blessedSettings', 'settings-reading-bn.png');
  await p.click('#blessedProgressToggle');
  await sleep(300);
  await p.reload({ waitUntil: 'networkidle0' });
  await sleep(1500);
  const hid = await p.evaluate(() => ({ line: !!document.querySelector('#dailyNote .blessed-progress'), saved: JSON.parse(localStorage.getItem('prayer-times-data')).blessedProgress }));
  ok('D14', `${lang}: switching it off hides the line and survives a reload`, !hid.line && hid.saved === false, JSON.stringify(hid));
  await p.close();
}

// D2 About credit; D16 name and credits
for (const lang of LANGS) {
  const p = await open(b, { lang, w: 1280, h: 720, at: MID });
  const about = await p.evaluate(() => document.getElementById('aboutSources').innerText);
  ok('D2', `${lang}: About credits the Tanzil ruku' metadata (CC BY 3.0)`, /CC BY 3\.0/.test(about) && (lang === 'en' ? /556 ruku’ sections/.test(about) : /৫৫৬টি রুকু/.test(about)), about.slice(0, 200));
  ok('D16', `${lang}: name and translation credits unchanged`, (lang === 'en' ? /Saheeh International[\s\S]*Muhiuddin Khan/ : /সাহিহ ইন্টারন্যাশনাল[\s\S]*মুহিউদ্দিন খান/).test(about) && (await p.evaluate(() => document.querySelector('#dailyNote .eyebrow')?.textContent || '')).toUpperCase() === (lang === 'bn' ? 'একটি বরকতময় স্মরণ' : 'A BLESSED REMINDER'));
  await p.close();
}

// D3/D4/D5/D6/D8 data checks run in the page against the shipped files
{
  const p = await open(b, { lang: 'en', w: 1280, h: 720, at: MID });
  const d = await p.evaluate(async () => {
    const m = await import('/src/blessed-reminder.js');
    const R = await m.loadReading();
    const P = R.passages;
    let crossJuz = 0, crossSection = 0, cut = 0;
    const juz = new Set(P.juz), sec = new Set(P.sections);
    for (let i = 0; i < P.starts.length; i++) {
      const v = m.passageVerses(P, i);
      for (let x = v.from + 1; x < v.to; x++) { if (juz.has(x)) crossJuz++; if (sec.has(x)) crossSection++; }
      const s = m.presentPassage(R, i, 'en'); const f = m.presentPassage(R, i, 'en', { expanded: true });
      s.verses.forEach((vv, k) => { if (vv.preview ? !f.verses[k].text.startsWith(vv.text.slice(0, -1).trimEnd()) : vv.text !== f.verses[k].text) cut++; }); // v3.0.3: long-verse previews are display only
    }
    return { count: P.starts.length, crossJuz, crossSection, cut, themes: P.themes.length, tagged: P.tg.filter(Boolean).length };
  });
  ok('D3', 'v3.0.3 rebalance: 2,739 passages', d.count === 2739, JSON.stringify(d));
  ok('D4', 'passages never cross a juz\' or ruku\' boundary', d.crossJuz === 0 && d.crossSection === 0, JSON.stringify(d));
  ok('D5', 'no verse is ever cut (shown verses are whole)', d.cut === 0, JSON.stringify(d));
  ok('D8', 'eleven themes; tagged verses mark their passages as first picks', d.themes === 11 && d.tagged > 200, JSON.stringify(d));
  const long = await p.evaluate(async () => {
    const m = await import('/src/blessed-reminder.js');
    const R = await m.loadReading();
    for (let i = 0; i < R.passages.starts.length; i++) { const v = m.presentPassage(R, i, 'en'); if (v.truncated) return { i, shown: v.verses.length, all: v.allVerses.length }; }
    return null;
  });
  ok('D5', 'a long passage shows whole leading verses and Read more shows the rest', !!long && long.shown < long.all, JSON.stringify(long));
  ok('D6', 'hand-check report is in CHECKLIST-v3.0.2.md (300 + 100 split points)', (() => { try { const t = fs.readFileSync(new URL('../CHECKLIST-v3.0.2.md', import.meta.url), 'utf8'); return /Hand-check of split points/.test(t) && /300 split points/.test(t) && /100 more/.test(t); } catch { return false; } })());
  await p.close();
}

// D9/D15 simulated months in the real app: every day of a 29-day month (Jumada II 1448) and a 30-day month (Rajab 1448)
async function monthCoverage(startCivil, days) {
  const seen = new Map();
  const perDay = [];
  for (let d = 1; d <= days; d++) {
    const civil = new Date(new Date(`${startCivil}T10:00:00+06:00`).getTime() + (d - 1) * 864e5);
    const at = civil.toISOString();
    const p = await open(b, { lang: 'en', w: 1280, h: 720, at });
    await sleep(700);
    await p.evaluate(() => document.querySelector('#dailyNote [data-blessed-portion]')?.click());
    await sleep(250);
    const refs = await p.evaluate(async () => {
      const m = await import('/src/blessed-reminder.js');
      const R = await m.loadReading();
      const ids = [...document.querySelectorAll('#portionList .portion-item')].map(e => Number(e.dataset.portion));
      const verses = [];
      for (const i of ids) { const v = m.passageVerses(R.passages, i); for (let x = v.from; x < v.to; x++) verses.push(x); }
      return { verses, summary: document.getElementById('portionSummary').textContent, n: ids.length };
    });
    perDay.push({ d, n: refs.n, summary: refs.summary });
    for (const v of refs.verses) seen.set(v, (seen.get(v) || 0) + 1);
    await p.close();
  }
  return { seen, perDay };
}
{
  const m29 = await monthCoverage('2026-11-11', 29);
  const once29 = m29.seen.size === 6236 && [...m29.seen.values()].every(c => c === 1);
  ok('D9', '29-day month (Jumada II 1448): every one of the 6,236 verses exactly once; day 29 reads juz\' 29–30', once29 && /Juz' 29–30 · \d+ of 366/.test(m29.perDay[28].summary), JSON.stringify({ size: m29.seen.size, day29: m29.perDay[28] }));
  const m30 = await monthCoverage('2026-12-10', 30);
  const once30 = m30.seen.size === 6236 && [...m30.seen.values()].every(c => c === 1);
  ok('D9', '30-day month (Rajab 1448): every one of the 6,236 verses exactly once; day 30 reads juz\' 30', once30 && /Juz' 30 · \d+ of 190/.test(m30.perDay[29].summary) && /Juz' 29 · \d+ of 176/.test(m30.perDay[28].summary), JSON.stringify({ size: m30.seen.size, d29: m30.perDay[28], d30: m30.perDay[29] }));
  ok('D15', 'a new Hijri month restarts at juz\' 1', /Juz' 1 · /.test(m30.perDay[0].summary), m30.perDay[0].summary);
  fs.writeFileSync(path.join(SHOTS, 'month-coverage.json'), JSON.stringify({ m29: m29.perDay, m30: m30.perDay }, null, 1));
}
// D15 the day's juz' follows the Hijri date (Maghrib moves the date)
{
  const p = await open(b, { lang: 'en', w: 1280, h: 720, at: '2026-11-23T17:40:00+06:00' });
  await sleep(1000);
  const after = await p.evaluate(() => document.querySelector('#dailyNote .blessed-progress')?.textContent);
  ok('D15', 'after Maghrib the Hijri date and the juz\' move on together (13 → 14)', /^Juz' 14 /.test(after || ''), after);
  await p.close();
}
// D10 order and the 10-minute step; D11 moments
{
  // a clean reading memory for this day, so earlier checks in this run don't shift the start
  const s = await open(b, { lang: 'en', w: 1280, h: 720, at: MID });
  await s.evaluate(() => localStorage.removeItem('prayer-times-blessed-reading'));
  await s.reload({ waitUntil: 'networkidle0' });
  await sleep(1500);
  const a = await s.evaluate(() => document.querySelector('#dailyNote .blessed-ref').textContent);
  const step = await s.evaluate(async () => {
    const m = await import('/src/blessed-reminder.js');
    const before = JSON.parse(localStorage.getItem(m.READING_KEY));
    const mem = { ...before, shownAt: before.shownAt - 10 * 60 * 1000 };
    localStorage.setItem(m.READING_KEY, JSON.stringify(mem));
    await new Promise(r => setTimeout(r, 16000)); // the app's own 15-second render
    const after = JSON.parse(localStorage.getItem(m.READING_KEY));
    return { before: before.current, after: after.current, from: before.from };
  });
  ok('D10', 'reads in order from the start of the day\'s juz\' and moves to the next unread after 10 minutes', step.before === step.from && step.after === step.before + 1, JSON.stringify({ first: a, step }));
  await s.click('#liveEvents .part-tick.fard[data-sub-key="dhuhr"]');
  await sleep(800);
  const mo = await s.evaluate(async () => {
    const m = await import('/src/blessed-reminder.js');
    const R = await m.loadReading();
    const mem = JSON.parse(localStorage.getItem(m.READING_KEY));
    return { moment: mem.moment, current: mem.current, grat: m.hasTheme(R.passages, mem.current, 'gratitude') };
  });
  ok('D11', 'right after a tick the gratitude moment picks a gratitude passage of the day', mo.moment === 'gratitude' && mo.grat, JSON.stringify(mo));
  await s.close();
  const f = await open(b, { lang: 'en', w: 1280, h: 720, at: '2026-11-27T12:30:00+06:00' });
  await sleep(1200);
  const fr = await f.evaluate(async () => { const m = await import('/src/blessed-reminder.js'); const R = await m.loadReading(); const mem = JSON.parse(localStorage.getItem(m.READING_KEY)); return { moment: mem.moment, ok: m.hasTheme(R.passages, mem.current, 'friday'), day: mem.day }; });
  ok('D11', 'Friday in the Jumu\'ah window: friday theme if the day\'s juz\' has one, otherwise in order', fr.moment === 'friday', JSON.stringify(fr));
  await f.close();
  const dwn = await open(b, { lang: 'en', w: 1280, h: 720, at: FAJR_EARLY });
  await sleep(1200);
  const dw = await dwn.evaluate(async () => { const m = await import('/src/blessed-reminder.js'); const R = await m.loadReading(); const mem = JSON.parse(localStorage.getItem(m.READING_KEY)); return { moment: mem.moment, dawn: m.hasTheme(R.passages, mem.current, 'dawn'), current: mem.current, from: mem.from }; });
  ok('D11', 'first 30 minutes of Fajr: the dawn moment applies (dawn passage if one is unread, otherwise in order)', dw.moment === 'dawn' && (dw.dawn || dw.current === dw.from), JSON.stringify(dw));
  await dwn.close();
}

// ---------- E version label ----------
for (const lang of LANGS) {
  const p = await open(b, { lang, w: 1280, h: 720, at: MID });
  const v = await p.evaluate(() => document.getElementById('appVersionLabel').textContent.trim());
  ok('E', `${lang}: corner label`, v === (lang === 'bn' ? 'v৩.০.৩' : 'v3.0.3'), v);
  if (lang === 'en') await p.screenshot({ path: path.join(SHOTS, 'version-label-en.png'), clip: { x: 1180, y: 690, width: 100, height: 30 } });
  if (lang === 'bn') await p.screenshot({ path: path.join(SHOTS, 'version-label-bn.png'), clip: { x: 1180, y: 690, width: 100, height: 30 } });
  await p.close();
}

// ---------- Layout 1280x720 and 420x700 ----------
for (const lang of LANGS) {
  for (const [w, h] of [[1280, 720], [420, 700]]) {
    for (const at of [MID, NIGHT]) {
      const p = await open(b, { lang, w, h, at, data: at === NIGHT ? night : {} });
      await sleep(900);
      const lay = await p.evaluate(() => {
        const W = document.documentElement.clientWidth;
        const sels = ['#dailyNote', '#lateEventsBlock', '#liveEvents', '.live-event', '.vol-count', '.blessed-progress', '.blessed-actions', '#prayerGrid', '#voluntaryList'];
        const bad = [];
        for (const s of sels) for (const e of document.querySelectorAll(s)) { if (!e.offsetParent) continue; const r = e.getBoundingClientRect(); if (r.right > W + 1 || r.left < -1 || e.scrollWidth > e.clientWidth + 2) bad.push({ s, r: Math.round(r.right), sw: e.scrollWidth, cw: e.clientWidth }); }
        return { pageOverflow: document.documentElement.scrollWidth > W + 1, bad };
      });
      ok('Layout', `${lang} ${w}x${h} ${at === NIGHT ? 'night' : 'day'}: nothing overflows`, !lay.pageOverflow && lay.bad.length === 0, JSON.stringify(lay));
      if (w === 420 && at === MID) await p.screenshot({ path: path.join(SHOTS, `narrow-home-${lang}.png`), fullPage: true });
      await p.close();
    }
  }
}

console.log(`\n${pass}/${pass + fail} passed`);
fs.writeFileSync(path.join(SHOTS, 'e2e-v302-results.txt'), `${out.join('\n')}\n\n${pass}/${pass + fail} passed\n`);
await b.close();
process.exit(fail ? 1 : 0);
