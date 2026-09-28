# İTÜ Ödül Akışı — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `?src=itu` ile gelen oyuncuya Osman'ın çizdiği akışı yaşatmak: zamanlı giriş sekansı → "45 sn dayan, ödülü al" + BAŞLA → oyun → tıkla-aç gizemli kutu → "hak kazandın" ödül ekranı + TOPLA + FOMO öğeleri.

**Architecture:** Temaya `flow: 'reward'` bayrağı eklenir; bayrak yoksa mevcut (klasik) akış birebir aynı kalır. Akışın zamanlama ve durum mantığı saf fonksiyonlar olarak `js/flow.js`'te durur (Node'da test edilir). DOM tarafı `js/reward-ui.js`'te, görsel stil `reward.css`'te, FOMO içeriği `js/reward-content.js`'te tutulur. `main.js` yalnızca hangi akışın çalışacağını seçer ve bağlar.

**Tech Stack:** Vanilla ES modules, CSS animasyonları (canvas/kütüphane yok), `node --test`, E2E için `playwright-core` + sistem Chrome'u.

**Spec:** Osman'ın el çizimi akış (sohbette paylaşılan görsel). Aşağıdaki "Spec özeti" bu planın referansıdır.

## Spec özeti (çizimden)

| # | Ekran | Geçiş |
|---|---|---|
| 1 | "?" + etrafında dalgalı kıvrımlar | zamanlı |
| 2 | Kıvrımlar sarmal olarak içe daralıyor | zamanlı |
| 3 | Karalama / çizgi silme geçişi | zamanlı |
| 4 | Tam ekran "İTÜ" | zamanlı |
| 5 | "İTÜ'lü gibi 45 sn'de döneme **ÖDÜLLE** başla" ("ÖDÜLLE" parıltılı) | zamanlı |
| 6 | Küçük "İTÜ'lü gibi", "45 sn dayan", "ÖDÜLÜ AL", **BAŞLA** butonu | tıkla → oyun |
| 7 | Oyun | oyun biter |
| 8 | Gizemli kutu (Brawl Stars tarzı), tıklayınca efektli açılış | tıkla |
| 9 | "İTÜ'de, Kadıköy'de, Beşiktaş'ta tüm restoranları, tüm menü ve fiyatları ve tüm arkadaşlarını görmeye hak kazandın" + **TOPLA** | TOPLA → mağaza |
| 9+ | FOMO: güzel profil fotoğrafları, Bıyıklı Şef (Mustachio), sohbet ekranı önizlemesi | — |

## Varsayımlar (Osman'la teyit edilecek)

Plan bu varsayımlarla yazıldı; biri değişirse yalnızca belirtilen task etkilenir.

1. **Sadece İTÜ temasında** (`flow: 'reward'`). Varsayılan akış değişmez. → Task 1
2. **1–3. ekranlar tek sürekli animasyon**; süreler: soru 1100 ms, sarmal 900 ms, karalama 600 ms, İTÜ 1000 ms, vaat 1800 ms (toplam ≈ 5.4 sn). Ekrana dokunmak girişi atlar ve 6. ekrana geçer. → Task 1, 3
3. **Tekrar gelen ziyaretçi** (girişi bir kez görmüş) ve **azaltılmış hareket** tercihi olanlar doğrudan 6. ekrana gelir. → Task 1, 3
4. **Kutu her bitişte verilir** (süre dolsa da ekip dağılsa da). Pazarlama hedefi indirme. → Task 4
5. **Ödül ekranı, İTÜ akışında mevcut bitiş ekranının yerini alır.** Skor tek satır olarak kalır, "Tekrar oyna / Paylaş" altta durur. → Task 5
6. **TOPLA = mağaza linki.** Masaüstünde mağaza linki yok; TOPLA gizlenir, yerine uygulama QR'ı gösterilir. → Task 5
7. **Profil fotoğrafları için asset gelene kadar** çizim/emoji avatarlar kullanılır. Veri `reward-content.js`'te tek listede durur; gerçek görsellerle değiştirmek tek satır iş. → Task 5
8. **Sohbet önizlemesi "örnek" olarak etiketlenir.** Uydurma mesajlar gerçek kullanıcı mesajı gibi sunulmaz. Sayı/istatistik ("2.3K arkadaş" vb.) uydurulmaz. → Task 5

## Global Constraints

- Klasik akış (tema yok veya `flow` yok) piksel piksel aynı kalmalı; mevcut 32 test geçmeli.
- Yeni metinler TR ve EN olarak `THEMES.itu.strings` içinde; `makeT` geri düşüşü (theme → base → tr → key) değişmez.
- Ekranlar 320×568'den 1920×1080'e ve yatay telefonlara (568×320, 667×375, 844×390) kadar kesilmeden görünmeli; sığmıyorsa `.scrollable` ile kaydırılabilir olmalı.
- `prefers-reduced-motion: reduce` → animasyon yok (mevcut global kural zaten tüm animasyonları kapatıyor).
- Commit mesajları Türkçe, `feat:`/`fix:`/`test:` önekli; sonunda `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Harici kütüphane yok (E2E devDependency hariç). Yeni asset yok (Mustachio = `assets/chef-head.webp`).

## Review Focus

1. **Tekrar gelen ziyaretçi / sayfa yenileme** → giriş tekrar oynamaz, doğrudan BAŞLA ekranı. (Task 1: `introPlan` testi; Task 6: E2E ikinci ziyaret)
2. **Kutuya çift/hızlı dokunma** → kutu yalnızca bir kez açılır, ödül ekranı bir kez gösterilir. (Task 1: `createBoxState` testi)
3. **Masaüstü (mağaza linki yok)** → TOPLA gizli, QR görünür; mobilde tersi. (Task 6: E2E iki platform)
4. **Kısa/yatay ekranlar** → BAŞLA ve TOPLA butonları her boyutta erişilebilir. (Task 6: E2E boyut taraması)
5. **Giriş sırasında dokunma** → zamanlayıcılar iptal olur, ekran 6'da kalır, sonradan geç gelen zamanlayıcı ekranı değiştirmez. (Task 1: `createSequencer` testi)

---

## Dosya Yapısı

| Dosya | Durum | Sorumluluk |
|---|---|---|
| `js/flow.js` | Yeni | Saf mantık: akış seçimi, giriş adımları, sıralayıcı, kutu durumu, ödül metin anahtarları |
| `js/reward-content.js` | Yeni | FOMO verisi: avatar listesi, sohbet önizleme satırları (anahtar bazlı) |
| `js/reward-ui.js` | Yeni | DOM: girişi oynat, kutuyu aç, ödül ekranını doldur |
| `reward.css` | Yeni | Giriş/kutu/ödül ekranı stilleri ve animasyonları |
| `test/flow.test.mjs` | Yeni | `flow.js` birim testleri + İTÜ metin kapsamı |
| `test/e2e/reward-flow.e2e.mjs` | Yeni | Tarayıcıda uçtan uca akış + boyut taraması |
| `js/themes.js` | Değişir | `itu.flow = 'reward'` + TR/EN ödül metinleri |
| `index.html` | Değişir | `#intro`, `#box`, `#reward` bölümleri; `reward.css` linki; tekrar/paylaş butonlarına `data-action` |
| `js/main.js` | Değişir | Akışa göre başlangıç ve `onEnd` dallanması; `data-action` bağlama; masaüstü QR |
| `package.json` | Değişir | `e2e` scripti, `playwright-core` devDependency |

**Ön koşul:** Çalışma ağacındaki commit'lenmemiş rozet düzeltmesi (`js/main.js`, `js/themes.js`, `styles.css`, `test/themes.test.mjs`) Task 1'den önce ayrı commit olarak alınır:

```bash
git add js/main.js js/themes.js styles.css test/themes.test.mjs
git commit -m "fix: tur rozeti tek satırda kalsın, İTÜ rozet metni kısaldı

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Akış mantığı (`js/flow.js`)

**Files:**
- Create: `js/flow.js`
- Create: `test/flow.test.mjs`
- Modify: `js/themes.js:8` (`itu` nesnesine `flow: 'reward'`)

**Interfaces:**
- Produces:
  - `pickFlow(theme: object|null): 'classic'|'reward'`
  - `INTRO_STEPS: ReadonlyArray<{ id: string, ms: number }>`; son adım `{ id: 'ready', ms: 0 }` (terminal)
  - `introPlan({ seen: boolean, reducedMotion: boolean }): Array<{ id, ms }>`
  - `createSequencer({ steps, onStep, schedule?, cancel? }): { start(): void, skip(): void, current(): string|null }`
  - `createBoxState(): { state(): 'closed'|'opening'|'open', tap(): boolean, opened(): boolean }`
  - `REWARD_KEYS: ReadonlyArray<string>` (Task 2 bu listeyi doldurur ve test eder)

- [ ] **Step 1: Failing testleri yaz**

`test/flow.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickFlow, INTRO_STEPS, introPlan, createSequencer, createBoxState } from '../js/flow.js';
import { pickTheme } from '../js/themes.js';

// Manual clock: schedule() queues callbacks, tick() runs the next one.
function fakeClock() {
  const queue = [];
  let id = 0;
  return {
    schedule: (fn, ms) => { queue.push({ id: ++id, fn, ms }); return id; },
    cancel: (handle) => { const i = queue.findIndex((q) => q.id === handle); if (i >= 0) queue.splice(i, 1); },
    tick: () => { const next = queue.shift(); if (next) next.fn(); return next; },
    pending: () => queue.length,
  };
}

test('pickFlow uses the reward flow only for themes that opt in', () => {
  assert.equal(pickFlow(null), 'classic');
  assert.equal(pickFlow({ id: 'x' }), 'classic');
  assert.equal(pickFlow(pickTheme('itu')), 'reward');
});

test('intro ends on a terminal ready step that waits for a click', () => {
  const last = INTRO_STEPS[INTRO_STEPS.length - 1];
  assert.deepEqual(last, { id: 'ready', ms: 0 });
  assert.deepEqual(INTRO_STEPS.map((s) => s.id), ['mystery', 'swirl', 'scribble', 'brand', 'promise', 'ready']);
  INTRO_STEPS.slice(0, -1).forEach((s) => assert.ok(s.ms > 0, `${s.id} needs a duration`));
});

test('introPlan skips straight to ready for returning visitors and reduced motion', () => {
  assert.equal(introPlan({ seen: false, reducedMotion: false }).length, INTRO_STEPS.length);
  assert.deepEqual(introPlan({ seen: true, reducedMotion: false }).map((s) => s.id), ['ready']);
  assert.deepEqual(introPlan({ seen: false, reducedMotion: true }).map((s) => s.id), ['ready']);
});

test('sequencer walks every step in order and stops at the terminal step', () => {
  const clock = fakeClock();
  const seen = [];
  const seq = createSequencer({ steps: INTRO_STEPS, onStep: (id) => seen.push(id), ...clock });
  seq.start();
  while (clock.tick());
  assert.deepEqual(seen, INTRO_STEPS.map((s) => s.id));
  assert.equal(seq.current(), 'ready');
  assert.equal(clock.pending(), 0);
});

test('skip jumps to ready once and cancels pending timers', () => {
  const clock = fakeClock();
  const seen = [];
  const seq = createSequencer({ steps: INTRO_STEPS, onStep: (id) => seen.push(id), ...clock });
  seq.start();
  seq.skip();
  seq.skip();
  assert.deepEqual(seen, ['mystery', 'ready']);
  assert.equal(clock.pending(), 0);
});

test('skip after the intro finished does nothing', () => {
  const clock = fakeClock();
  const seen = [];
  const seq = createSequencer({ steps: introPlan({ seen: true, reducedMotion: false }), onStep: (id) => seen.push(id), ...clock });
  seq.start();
  seq.skip();
  assert.deepEqual(seen, ['ready']);
});

test('box opens exactly once no matter how often it is tapped', () => {
  const box = createBoxState();
  assert.equal(box.state(), 'closed');
  assert.equal(box.tap(), true);
  assert.equal(box.tap(), false);
  assert.equal(box.state(), 'opening');
  assert.equal(box.opened(), true);
  assert.equal(box.opened(), false);
  assert.equal(box.tap(), false);
  assert.equal(box.state(), 'open');
});
```

- [ ] **Step 2: Testlerin kırıldığını gör**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../js/flow.js'`

- [ ] **Step 3: Minimal implementasyon**

`js/flow.js`:

```js
// Reward flow (Osman's sketch): timed intro → "45 sn dayan, ödülü al" → game →
// mystery box → reward screen. Pure logic so it is unit-tested in Node; DOM
// lives in reward-ui.js.

export const INTRO_STEPS = Object.freeze([
  { id: 'mystery', ms: 1100 },
  { id: 'swirl', ms: 900 },
  { id: 'scribble', ms: 600 },
  { id: 'brand', ms: 1000 },
  { id: 'promise', ms: 1800 },
  { id: 'ready', ms: 0 }, // terminal: waits for the BAŞLA click
]);

export const REWARD_KEYS = Object.freeze([]); // filled in Task 2

export function pickFlow(theme) {
  return theme?.flow === 'reward' ? 'reward' : 'classic';
}

export function introPlan({ seen, reducedMotion }) {
  return seen || reducedMotion ? INTRO_STEPS.slice(-1) : [...INTRO_STEPS];
}

export function createSequencer({ steps, onStep, schedule = setTimeout, cancel = clearTimeout }) {
  let index = -1;
  let timer = null;
  const last = steps.length - 1;
  const go = (i) => {
    index = i;
    timer = null;
    onStep(steps[i].id);
    if (i < last) timer = schedule(() => go(i + 1), steps[i].ms);
  };
  return {
    start: () => go(0),
    skip: () => {
      if (index === last) return;
      if (timer !== null) cancel(timer);
      go(last);
    },
    current: () => (index >= 0 ? steps[index].id : null),
  };
}

export function createBoxState() {
  let state = 'closed';
  return {
    state: () => state,
    tap: () => {
      if (state !== 'closed') return false;
      state = 'opening';
      return true;
    },
    opened: () => {
      if (state !== 'opening') return false;
      state = 'open';
      return true;
    },
  };
}
```

`js/themes.js` — `itu` nesnesinin ilk satırına:

```js
  itu: {
    flow: 'reward', // Osman's intro → box → reward flow (see js/flow.js)
    scene: { sky: 'stadium', ground: 'stadium', bees: 6 },
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npm test`
Expected: PASS (32 + 7 = 39 test)

- [ ] **Step 5: Commit**

```bash
git add js/flow.js test/flow.test.mjs js/themes.js
git commit -m "feat: ödül akışı mantığı — giriş sıralayıcı ve kutu durumu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: İTÜ ödül metinleri (TR/EN)

**Files:**
- Modify: `js/flow.js` (`REWARD_KEYS`)
- Modify: `js/themes.js` (`itu.strings.tr`, `itu.strings.en`)
- Test: `test/flow.test.mjs`

**Interfaces:**
- Consumes: `REWARD_KEYS` (Task 1)
- Produces: şu anahtarlar (Task 3–5 HTML'de `data-i18n` ile kullanır):
  `introBrand, introLead, introPromise, introHot, introTail, readyMain, readyHot, readyPlay, boxTitle, boxHint, boxOpen, rewardTitle, rewardCollect, rewardFriends, rewardChatTitle, rewardChatNote, rewardChat, rewardScore`

- [ ] **Step 1: Failing test**

`test/flow.test.mjs` sonuna:

```js
import { makeT } from '../js/i18n.js';
import { REWARD_KEYS } from '../js/flow.js';

test('every reward-flow string exists in Turkish and English for İTÜ', () => {
  assert.ok(REWARD_KEYS.length > 0);
  ['tr', 'en'].forEach((locale) => {
    const t = makeT(locale, pickTheme('itu').strings);
    REWARD_KEYS.forEach((key) => {
      const value = t(key);
      assert.notEqual(value, key, `${locale}.${key} missing`);
      assert.ok(Array.isArray(value) ? value.length : String(value).trim(), `${locale}.${key} empty`);
    });
  });
});

test('English reward copy is not silently the Turkish text', () => {
  const tr = makeT('tr', pickTheme('itu').strings);
  const en = makeT('en', pickTheme('itu').strings);
  REWARD_KEYS.filter((k) => k !== 'introBrand').forEach((key) => {
    assert.notDeepEqual(en(key), tr(key), `en.${key} falls back to Turkish`);
  });
});
```

(`import` satırlarını dosyanın başındaki importların yanına taşı.)

- [ ] **Step 2: Kırıldığını gör**

Run: `npm test`
Expected: FAIL — `REWARD_KEYS.length > 0` assertion

- [ ] **Step 3: Anahtarları ve metinleri ekle**

`js/flow.js`:

```js
export const REWARD_KEYS = Object.freeze([
  'introBrand', 'introLead', 'introPromise', 'introHot', 'introTail',
  'readyMain', 'readyHot', 'readyPlay',
  'boxTitle', 'boxHint', 'boxOpen',
  'rewardTitle', 'rewardCollect', 'rewardFriends', 'rewardChatTitle', 'rewardChatNote', 'rewardChat', 'rewardScore',
]);
```

`js/themes.js` → `itu.strings.tr` içine:

```js
        introBrand: 'İTÜ',
        introLead: 'İTÜ\'lü gibi',
        introPromise: '45 sn\'de döneme',
        introHot: 'ÖDÜLLE',
        introTail: 'başla',
        readyMain: '45 sn dayan',
        readyHot: 'ÖDÜLÜ AL',
        readyPlay: 'BAŞLA ▶',
        boxTitle: 'Ödülün hazır!',
        boxHint: 'Kutuya dokun, aç 👆',
        boxOpen: 'Ödül kutusunu aç',
        rewardTitle: 'İTÜ\'de, Kadıköy\'de, Beşiktaş\'ta tüm restoranları, tüm menü ve fiyatları ve tüm arkadaşlarını görmeye hak kazandın!',
        rewardCollect: 'TOPLA',
        rewardFriends: 'Arkadaşların zaten feast\'te',
        rewardChatTitle: 'Bu akşam nerede yiyoruz?',
        rewardChatNote: 'Örnek sohbet',
        rewardChat: [
          { from: 'Elif', text: 'MED makarnası mı yine? 🍝' },
          { from: 'Can', text: 'Kadıköy\'de yeni bir burgerci açılmış, menüsü feast\'te' },
          { from: 'Deniz', text: 'Fiyatlara baktım, öğrenciye uygun 👌' },
        ],
        rewardScore: 'Skorun: {score}',
```

`itu.strings.en` içine:

```js
        introLead: 'Like an ITU student',
        introPromise: 'start the term',
        introHot: 'WITH A REWARD',
        introTail: 'in 45 seconds',
        readyMain: 'Last 45 seconds',
        readyHot: 'CLAIM THE REWARD',
        readyPlay: 'START ▶',
        boxTitle: 'Your reward is ready!',
        boxHint: 'Tap the box to open 👆',
        boxOpen: 'Open the reward box',
        rewardTitle: 'You\'ve unlocked every restaurant in ITU, Kadıköy and Beşiktaş, every menu and price, and all your friends!',
        rewardCollect: 'COLLECT',
        rewardFriends: 'Your friends are already on feast',
        rewardChatTitle: 'Where are we eating tonight?',
        rewardChatNote: 'Example chat',
        rewardChat: [
          { from: 'Elif', text: 'MED pasta again? 🍝' },
          { from: 'Can', text: 'A new burger place opened in Kadıköy, the menu is on feast' },
          { from: 'Deniz', text: 'Checked the prices, student-friendly 👌' },
        ],
        rewardScore: 'Your score: {score}',
```

(`introBrand` EN'de TR'ye düşer: "İTÜ" marka olarak iki dilde aynı; test bu anahtarı hariç tutuyor.)

- [ ] **Step 4: Geçtiğini gör**

Run: `npm test`
Expected: PASS (41 test)

- [ ] **Step 5: Commit**

```bash
git add js/flow.js js/themes.js test/flow.test.mjs
git commit -m "feat: İTÜ ödül akışı metinleri (TR/EN)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Giriş sekansı ve BAŞLA ekranı (ekran 1–6)

**Files:**
- Create: `js/reward-ui.js`
- Create: `reward.css`
- Modify: `index.html` (`<head>`'e `reward.css`; `#start`'tan sonra `#intro` bölümü)
- Modify: `js/main.js` (`boot()` içinde akış dallanması)

**Interfaces:**
- Consumes: `pickFlow`, `introPlan`, `createSequencer` (Task 1); metin anahtarları (Task 2)
- Produces:
  - `playIntro({ root: HTMLElement, steps, onStep?: (id) => void }): { skip(): void }` — `root.dataset.step`'i günceller, `root` üzerindeki dokunuş (buton hariç) girişi atlar.
  - `main.js`: `INTRO_SEEN_KEY = 'feast-game.intro-seen.v1'`

- [ ] **Step 1: HTML**

`index.html` `<head>`'de `styles.css` linkinin altına:

```html
  <link rel="stylesheet" href="reward.css">
```

`<!-- PLAY -->` yorumundan hemen önce:

```html
  <!-- REWARD FLOW INTRO (only themes with flow: 'reward') -->
  <section id="intro" class="screen intro" aria-live="polite">
    <div class="intro-frame" data-frame="mystery"><span class="intro-q" aria-hidden="true">?</span></div>
    <div class="intro-frame" data-frame="swirl" aria-hidden="true"></div>
    <div class="intro-frame" data-frame="scribble" aria-hidden="true"></div>
    <div class="intro-frame" data-frame="brand"><b class="intro-brand" data-i18n="introBrand"></b></div>
    <div class="intro-frame" data-frame="promise">
      <p class="intro-promise">
        <small data-i18n="introLead"></small>
        <span data-i18n="introPromise"></span>
        <em class="sparkle" data-i18n="introHot"></em>
        <span data-i18n="introTail"></span>
      </p>
    </div>
    <div class="intro-frame intro-ready" data-frame="ready">
      <small class="intro-lead" data-i18n="introLead"></small>
      <h1 data-i18n="readyMain"></h1>
      <strong class="sparkle intro-hot" data-i18n="readyHot"></strong>
      <button id="btn-reward-play" class="btn btn-primary btn-pulse" type="button" data-i18n="readyPlay"></button>
    </div>
  </section>
```

- [ ] **Step 2: CSS**

`reward.css`:

```css
/* Reward flow (?src=itu): intro, mystery box, reward screen. Tokens come from styles.css. */

/* ---------- intro ---------- */
.intro { background: var(--cream); cursor: pointer; overflow: hidden; }
.intro-frame {
  position: absolute;
  inset: 0;
  display: none;
  place-items: center;
  padding: calc(24px + var(--safe-top)) 24px calc(24px + var(--safe-bottom));
  text-align: center;
}
.intro[data-step="mystery"] [data-frame="mystery"],
.intro[data-step="swirl"] [data-frame="swirl"],
.intro[data-step="scribble"] [data-frame="scribble"],
.intro[data-step="brand"] [data-frame="brand"],
.intro[data-step="promise"] [data-frame="promise"],
.intro[data-step="ready"] [data-frame="ready"] { display: grid; }

/* 1–2: wavy rings around a "?" that tighten into a spiral */
[data-frame="mystery"], [data-frame="swirl"] {
  background: repeating-radial-gradient(circle at 50% 45%, var(--cream) 0 14px, var(--ink) 15px 17px);
}
[data-frame="mystery"] { animation: ringsIn 1.1s ease-out both; }
[data-frame="swirl"] { animation: swirlIn .9s cubic-bezier(.6, 0, .9, .4) both; }
.intro-q {
  font: 900 min(40vw, 220px)/1 var(--font);
  color: var(--red);
  -webkit-text-stroke: 4px var(--ink);
  paint-order: stroke fill;
  background: var(--cream);
  border-radius: 50%;
  padding: 0 .15em;
  animation: bob 1.1s ease-in-out infinite;
}
@keyframes ringsIn { from { transform: scale(1.6); opacity: 0; } }
@keyframes swirlIn { to { transform: scale(.05) rotate(540deg); } }

/* 3: scribble wipe */
[data-frame="scribble"] {
  background: repeating-linear-gradient(62deg, var(--ink) 0 6px, var(--cream) 7px 22px);
  animation: scribble .6s steps(6) both;
}
@keyframes scribble { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }

/* 4: big brand */
.intro-brand {
  font: 900 min(38vw, 260px)/1 var(--font);
  color: var(--ink);
  letter-spacing: -.04em;
  animation: brandPop 1s cubic-bezier(.2, .9, .3, 1.4) both;
}
@keyframes brandPop { from { transform: scale(.4); opacity: 0; } }

/* 5–6: promise + ready */
.intro-promise { display: grid; gap: 4px; margin: 0; font: 900 clamp(30px, 9vw, 52px)/1.05 var(--font); color: var(--ink); text-transform: uppercase; }
.intro-promise small, .intro-lead { text-transform: none; color: var(--red-deep); font-size: clamp(16px, 4.5vw, 24px); font-weight: 900; }
.sparkle {
  position: relative;
  font-style: normal;
  color: var(--red);
  -webkit-text-stroke: 1.5px var(--ink);
  paint-order: stroke fill;
  animation: sparkle 1.2s ease-in-out infinite;
}
.sparkle::before, .sparkle::after { content: "✦"; position: absolute; top: -.2em; color: var(--gold); font-size: .5em; -webkit-text-stroke: 0; }
.sparkle::before { left: -.7em; }
.sparkle::after { right: -.7em; }
@keyframes sparkle { 50% { transform: scale(1.06); text-shadow: 0 0 18px rgba(255, 210, 63, .9); } }

.intro-ready { cursor: default; align-content: center; gap: 8px; max-width: 420px; margin: 0 auto; }
.intro-ready h1 { font-size: clamp(34px, 10vw, 56px); }
.intro-hot { display: block; font-size: clamp(34px, 10vw, 56px); font-weight: 900; }
.intro-ready .btn-primary { margin-top: 24px; font-size: 28px; }

@media (max-height: 500px) {
  .intro-ready { gap: 2px; }
  .intro-ready .btn-primary { margin-top: 10px; padding: 10px; }
}
```

- [ ] **Step 3: DOM sıralayıcı**

`js/reward-ui.js`:

```js
// DOM side of the reward flow (logic in flow.js).

import { createSequencer } from './flow.js';

export function playIntro({ root, steps, onStep = () => {} }) {
  const seq = createSequencer({
    steps,
    onStep: (id) => {
      root.dataset.step = id;
      onStep(id);
    },
  });
  // Tap anywhere (except the BAŞLA button) skips to the ready screen.
  root.addEventListener('click', (e) => {
    if (!e.target.closest('button')) seq.skip();
  });
  seq.start();
  return seq;
}
```

- [ ] **Step 4: `main.js` bağlama**

Importlara:

```js
import { pickFlow, introPlan } from './flow.js';
import { playIntro } from './reward-ui.js';
```

Sabitlere:

```js
const INTRO_SEEN_KEY = 'feast-game.intro-seen.v1';
```

`const t = makeT(...)` satırının altına:

```js
const flow = pickFlow(theme);
```

`index.html`'de `#start` `is-active` sınıfıyla geliyor. Ödül akışında başlangıç kartı bir kare bile görünmesin diye giriş, `boot()`'un en başında, `applyStrings()`'ten hemen sonra başlar (oyun görselleri yüklenmeden önce):

```js
async function boot() {
  applyStrings();
  if (flow === 'reward') startRewardIntro();
  renderLegend();
  // ...
```

```js
function startRewardIntro() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seen = storage('get', INTRO_SEEN_KEY) === '1';
  showScreen('intro');
  playIntro({
    root: $('#intro'),
    steps: introPlan({ seen, reducedMotion }),
    onStep: (id) => {
      if (id !== 'ready') return;
      storage('set', INTRO_SEEN_KEY, '1');
      track('intro_ready', { seen });
    },
  });
}
```

`startRewardIntro` fonksiyonunu `boot()`'un üstüne ekle. BAŞLA butonu `play` tanımlandıktan sonra, `$('#btn-play').addEventListener('click', play);` satırının altında bağlanır (oyun hazır olmadan tıklanırsa hiçbir şey olmaz; görseller yüklenirken giriş zaten oynuyor):

```js
  if (flow === 'reward') $('#btn-reward-play').addEventListener('click', play);
```

- [ ] **Step 5: Elle doğrula**

Run: `npm run serve` → `http://localhost:5174/?src=itu`
Expected: "?" → sarmal → karalama → "İTÜ" → "ÖDÜLLE başla" → "45 sn dayan / ÖDÜLÜ AL / BAŞLA". Ekrana dokununca doğrudan BAŞLA ekranı. Sayfayı yenileyince doğrudan BAŞLA ekranı. BAŞLA → oyun başlar. `http://localhost:5174/` (tema yok) → eski başlangıç kartı, değişiklik yok.

Run: `npm test`
Expected: PASS (41 test)

- [ ] **Step 6: Commit**

```bash
git add index.html reward.css js/reward-ui.js js/main.js
git commit -m "feat: İTÜ giriş sekansı ve 'ödülü al' başlangıç ekranı

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Gizemli kutu (ekran 8)

**Files:**
- Modify: `index.html` (`#box` bölümü)
- Modify: `reward.css` (kutu stilleri)
- Modify: `js/reward-ui.js` (`openBoxScreen`)
- Modify: `js/main.js` (`onEnd` dallanması)

**Interfaces:**
- Consumes: `createBoxState` (Task 1); `boxTitle`, `boxHint`, `boxOpen` (Task 2)
- Produces: `openBoxScreen({ root: HTMLElement, button: HTMLElement, onOpened: () => void, openMs?: number }): void` — her çağrıda yeni `createBoxState()`; dokununca `root`'a `is-opening`, `openMs` (varsayılan 1100) sonra `is-open` ve `onOpened()`.

- [ ] **Step 1: HTML**

`#intro` bölümünün altına:

```html
  <!-- REWARD FLOW: mystery box after the round -->
  <section id="box" class="screen box-screen">
    <div class="box-wrap">
      <h2 data-i18n="boxTitle"></h2>
      <button id="btn-box" class="mystery-box" type="button" aria-label="Ödül kutusunu aç" data-i18n-aria="boxOpen">
        <span class="box-lid" aria-hidden="true">?</span>
        <span class="box-body" aria-hidden="true">?</span>
        <span class="box-burst" aria-hidden="true"></span>
      </button>
      <p class="hint" data-i18n="boxHint"></p>
    </div>
  </section>
```

- [ ] **Step 2: CSS**

`reward.css` sonuna:

```css
/* ---------- mystery box ---------- */
.box-screen { background: radial-gradient(circle at 50% 55%, #ffe7a3 0%, var(--cream) 60%); }
.box-wrap { display: grid; justify-items: center; gap: 18px; text-align: center; }
.mystery-box {
  position: relative;
  width: min(56vw, 220px);
  aspect-ratio: 1;
  border: 0;
  background: none;
  cursor: pointer;
  animation: boxIdle 1.4s ease-in-out infinite;
}
.box-body, .box-lid {
  position: absolute;
  left: 0;
  right: 0;
  display: grid;
  place-items: center;
  border: 4px solid var(--ink);
  font: 900 48px/1 var(--font);
  color: var(--gold);
  -webkit-text-stroke: 2px var(--ink);
  paint-order: stroke fill;
  background: linear-gradient(160deg, #6b3df0, #3b1fa8);
  box-shadow: 0 8px 0 var(--ink);
}
.box-body { bottom: 0; height: 72%; border-radius: 10px 10px 22px 22px; }
.box-lid { top: 4%; height: 28%; margin: 0 -6%; border-radius: 16px; font-size: 28px; background: linear-gradient(160deg, #8d63ff, #5a33d6); transition: transform .45s cubic-bezier(.2, .9, .3, 1.4); }
.box-burst { position: absolute; inset: -40%; border-radius: 50%; background: radial-gradient(circle, #fff 0%, var(--gold) 30%, transparent 65%); opacity: 0; transform: scale(.2); pointer-events: none; }

.box-screen.is-opening .mystery-box { animation: boxShake .12s linear 5; }
.box-screen.is-opening .box-lid { transition-delay: .6s; transform: translateY(-140%) rotate(-18deg); }
.box-screen.is-opening .box-burst { animation: burst .5s ease-out .6s both; }
.box-screen.is-opening .hint { visibility: hidden; }

@keyframes boxIdle { 50% { transform: translateY(-6px) rotate(-2deg); } }
@keyframes boxShake { 25% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }
@keyframes burst { 60% { opacity: 1; } to { opacity: 0; transform: scale(1.4); } }
```

- [ ] **Step 3: `openBoxScreen`**

`js/reward-ui.js` başındaki import satırını değiştir:

```js
import { createSequencer, createBoxState } from './flow.js';
```

Dosyanın sonuna ekle:

```js
const BOX_OPEN_MS = 1100; // shake (0.6 s) + lid/burst (0.5 s), matches reward.css

export function openBoxScreen({ root, button, onOpened, openMs = BOX_OPEN_MS }) {
  const box = createBoxState();
  root.classList.remove('is-opening', 'is-open');
  button.onclick = () => {
    if (!box.tap()) return;
    root.classList.add('is-opening');
    if (navigator.vibrate) navigator.vibrate([20, 40, 60]);
    setTimeout(() => {
      if (!box.opened()) return;
      root.classList.add('is-open');
      onOpened();
    }, openMs);
  };
}
```

(`button.onclick` bilinçli: her turda yeni kutu durumu; `addEventListener` her oyunda bir dinleyici daha eklerdi.)

- [ ] **Step 4: `main.js` `onEnd` dallanması**

Importu güncelle:

```js
import { playIntro, openBoxScreen } from './reward-ui.js';
```

`onEnd` içinde `setTimeout(() => showGameOver(result, best, isNewBest), 450);` satırını değiştir:

```js
      setTimeout(() => (flow === 'reward' ? showBox(result) : showGameOver(result, best, isNewBest)), 450);
```

`showGameOver`'ın altına (Task 5 `showReward`'ı ekleyene kadar geçici olarak `showGameOver`'a düşer):

```js
function showBox(result) {
  openBoxScreen({
    root: $('#box'),
    button: $('#btn-box'),
    onOpened: () => {
      track('box_open', { score: result.score });
      showGameOver(result, Number(storage('get', BEST_KEY)) || 0, false);
    },
  });
  showScreen('box');
}
```

- [ ] **Step 5: Elle doğrula**

`?src=itu` ile oyna (45 sn) → kutu ekranı → kutu sallanıyor → dokun → sallanma + kapak uçuyor + parlama → bitiş ekranı. Kutuya art arda hızlı dokun → bitiş ekranı bir kez açılır. Tema olmadan → doğrudan eski bitiş ekranı.

Run: `npm test` → PASS

- [ ] **Step 6: Commit**

```bash
git add index.html reward.css js/reward-ui.js js/main.js
git commit -m "feat: oyun sonu tıkla-aç gizemli kutu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Ödül ekranı + TOPLA + FOMO (ekran 9)

**Files:**
- Create: `js/reward-content.js`
- Modify: `index.html` (`#reward` bölümü; `#over` tekrar/paylaş butonlarına `data-action`)
- Modify: `reward.css`
- Modify: `js/reward-ui.js` (`renderReward`)
- Modify: `js/main.js` (`showReward`, `data-action` bağlama, masaüstü QR)
- Test: `test/flow.test.mjs`

**Interfaces:**
- Consumes: `rewardTitle`, `rewardCollect`, `rewardFriends`, `rewardChatTitle`, `rewardChatNote`, `rewardChat`, `rewardScore` (Task 2); `openBoxScreen` (Task 4)
- Produces:
  - `AVATARS: ReadonlyArray<{ emoji: string, bg: string }>` (`js/reward-content.js`)
  - `renderReward({ avatarsEl, chatEl, scoreEl, chat: Array<{from,text}>, scoreText: string }): void`

- [ ] **Step 1: Failing test**

`test/flow.test.mjs` sonuna:

```js
import { AVATARS } from '../js/reward-content.js';

test('reward avatars are placeholders with a background and an emoji', () => {
  assert.ok(AVATARS.length >= 4 && AVATARS.length <= 8);
  AVATARS.forEach((a) => {
    assert.match(a.bg, /^#[0-9a-f]{6}$/i);
    assert.ok(a.emoji.length > 0);
  });
});

test('reward chat preview has short example lines in both languages', () => {
  ['tr', 'en'].forEach((locale) => {
    const chat = makeT(locale, pickTheme('itu').strings)('rewardChat');
    assert.ok(chat.length >= 2 && chat.length <= 4);
    chat.forEach((line) => assert.ok(line.from && line.text.length <= 70, `${locale}: "${line.text}" too long`));
  });
});
```

- [ ] **Step 2: Kırıldığını gör**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../js/reward-content.js'`

- [ ] **Step 3: İçerik modülü**

`js/reward-content.js`:

```js
// FOMO content for the reward screen. Placeholder avatars until the real
// "güzel PP" artwork arrives: swap each entry for { img: 'assets/...' } and
// update renderReward() in reward-ui.js.

export const AVATARS = Object.freeze([
  { emoji: '👩‍🎓', bg: '#ffd23f' },
  { emoji: '🧑‍🍳', bg: '#ff8a65' },
  { emoji: '👨‍🎓', bg: '#7cc4ff' },
  { emoji: '👩‍💻', bg: '#b69cff' },
  { emoji: '🧑‍🎤', bg: '#7fe0a8' },
]);
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `npm test` → PASS (43 test)

- [ ] **Step 5: HTML**

`#over` içindeki butonları `data-action` ile işaretle (id'ler kalır):

```html
        <button id="btn-again" class="btn btn-ghost" type="button" data-action="again" data-i18n="again"></button>
        <button id="btn-share" class="btn btn-ghost" type="button" data-action="share" data-i18n="share"></button>
```

`#box` bölümünün altına:

```html
  <!-- REWARD FLOW: unlocked reward -->
  <section id="reward" class="screen scrollable">
    <div class="card reward-card">
      <div class="chef-sticker"><img src="assets/chef-head.webp" alt="" width="44" height="44"><span data-i18n="chefPick"></span></div>
      <img class="logo" src="assets/logo.webp" alt="feast." width="120" height="33">
      <h2 class="reward-title" data-i18n="rewardTitle"></h2>

      <div class="reward-friends">
        <div id="reward-avatars" class="avatar-stack" aria-hidden="true"></div>
        <span data-i18n="rewardFriends"></span>
      </div>

      <div class="reward-chat">
        <div class="reward-chat-head"><b data-i18n="rewardChatTitle"></b><small data-i18n="rewardChatNote"></small></div>
        <ul id="reward-chat" class="chat-lines"></ul>
      </div>

      <a class="btn btn-primary btn-pulse reward-collect" data-store="reward" href="#" target="_top" rel="noopener" data-i18n="rewardCollect"></a>
      <div class="app-qr" data-desktop-only>
        <img src="assets/store-qr.svg" loading="lazy" alt="feast. uygulamasını indirme QR kodu" data-i18n-alt="altStoreQr" width="132" height="132">
        <div class="app-qr-text">
          <b data-i18n="qrTitle"></b>
          <small data-i18n="qrHint" data-i18n-platform></small>
        </div>
      </div>

      <p id="reward-score" class="stats"></p>
      <div class="row">
        <button class="btn btn-ghost" type="button" data-action="again" data-i18n="again"></button>
        <button class="btn btn-ghost" type="button" data-action="share" data-i18n="share"></button>
      </div>
    </div>
  </section>
```

- [ ] **Step 6: CSS**

`reward.css` sonuna:

```css
/* ---------- reward ---------- */
.reward-card { position: relative; }
.reward-card .chef-sticker { top: -18px; right: -8px; }
.reward-title { margin-top: 10px; font-size: clamp(20px, 6vw, 26px); line-height: 1.15; color: var(--ink); }
.reward-friends { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 14px; font-weight: 800; font-size: 14px; }
.avatar-stack { display: flex; }
.avatar-stack span {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  margin-left: -10px;
  border: 2.5px solid var(--ink);
  border-radius: 50%;
  font-size: 20px;
}
.avatar-stack span:first-child { margin-left: 0; }
.reward-chat { margin-top: 14px; padding: 10px; border: 2.5px solid var(--ink); border-radius: 18px; background: #f4f1ff; text-align: left; }
.reward-chat-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 14px; }
.reward-chat-head small { font-size: 11px; font-weight: 800; opacity: .55; text-transform: uppercase; letter-spacing: .05em; }
.chat-lines { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 6px; }
.chat-lines li { max-width: 88%; padding: 6px 10px; border-radius: 14px 14px 14px 4px; background: #fff; font-size: 13px; font-weight: 700; line-height: 1.3; }
.chat-lines li:nth-child(even) { justify-self: end; border-radius: 14px 14px 4px 14px; background: var(--red); color: #fff; }
.chat-lines b { display: block; font-size: 11px; opacity: .65; }
.reward-collect { margin-top: 16px; font-size: 28px; }
```

- [ ] **Step 7: `renderReward`**

`js/reward-ui.js` başındaki importların altına:

```js
import { AVATARS } from './reward-content.js';
```

Dosyanın sonuna:

```js
export function renderReward({ avatarsEl, chatEl, scoreEl, chat, scoreText }) {
  avatarsEl.replaceChildren(...AVATARS.map((a) => {
    const el = document.createElement('span');
    el.style.background = a.bg;
    el.textContent = a.emoji;
    return el;
  }));
  chatEl.replaceChildren(...chat.map((line) => {
    const li = document.createElement('li');
    const who = document.createElement('b');
    who.textContent = line.from;
    li.append(who, line.text);
    return li;
  }));
  scoreEl.textContent = scoreText;
}
```

(`textContent`/`append` ile metin eklenir; `innerHTML` yok.)

- [ ] **Step 8: `main.js` bağlama**

Importu güncelle:

```js
import { playIntro, openBoxScreen, renderReward } from './reward-ui.js';
```

`showBox` içindeki geçici `showGameOver(...)` çağrısını değiştir:

```js
    onOpened: () => {
      track('box_open', { score: result.score });
      showReward(result);
    },
```

`showBox`'un altına:

```js
function showReward(result) {
  renderReward({
    avatarsEl: $('#reward-avatars'),
    chatEl: $('#reward-chat'),
    scoreEl: $('#reward-score'),
    chat: t('rewardChat'),
    scoreText: t('rewardScore', { score: result.score }),
  });
  $('#reward').scrollTo(0, 0);
  showScreen('reward');
  track('reward_view', { score: result.score });
}
```

`setupStoreLinks()` sonuna (masaüstünde mağaza linki yok → QR göster; mobilde QR gizle):

```js
  document.querySelectorAll('[data-desktop-only]').forEach((el) => { el.hidden = Boolean(STORE_URL); });
```

`boot()`'ta id bazlı bağlamaları `data-action` ile değiştir:

```js
  document.querySelectorAll('[data-action="again"]').forEach((b) => b.addEventListener('click', play));
  const canShare = Boolean(navigator.share || navigator.clipboard);
  document.querySelectorAll('[data-action="share"]').forEach((b) => {
    b.hidden = !canShare;
    b.addEventListener('click', () => share(lastScore, b));
  });
```

ve `share(score)` imzasını `share(score, btn)` yapıp içindeki `const btn = $('#btn-share');` satırını sil (kopyalandı etiketi tıklanan butonda görünsün).

- [ ] **Step 9: Elle doğrula**

`?src=itu` ile oyna → kutu → aç → ödül ekranı: başlık, avatar yığını, "Örnek sohbet" etiketli önizleme, TOPLA (mobil UA ile mağaza linki), skor satırı, Tekrar oyna/Paylaş. Masaüstünde TOPLA gizli, QR görünür. "Tekrar oyna" → oyun yeniden başlar; tekrar bitince kutu kapalı hâlde gelir. Tema olmadan bitiş ekranının tekrar/paylaş butonları çalışır.

Run: `npm test` → PASS (43 test)

- [ ] **Step 10: Commit**

```bash
git add index.html reward.css js/reward-content.js js/reward-ui.js js/main.js test/flow.test.mjs
git commit -m "feat: 'hak kazandın' ödül ekranı, TOPLA ve FOMO öğeleri

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Uçtan uca test ve boyut taraması

**Files:**
- Create: `test/e2e/reward-flow.e2e.mjs`
- Modify: `package.json` (`e2e` scripti, `playwright-core` devDependency)

**Interfaces:**
- Consumes: DOM id'leri `#intro`, `#btn-reward-play`, `#box`, `#btn-box`, `#reward`, `[data-store="reward"]`, `[data-desktop-only]` (Task 3–5); `INTRO_SEEN_KEY` değeri `feast-game.intro-seen.v1`

- [ ] **Step 1: Bağımlılık ve script**

Run: `npm i -D playwright-core`

`package.json` `scripts` içine:

```json
    "e2e": "node test/e2e/reward-flow.e2e.mjs"
```

- [ ] **Step 2: E2E testini yaz**

`test/e2e/reward-flow.e2e.mjs`:

```js
// End-to-end check of the İTÜ reward flow in real Chrome. Needs `npm run serve`
// in another terminal. Plays one full 45 s round, so it takes about a minute.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const BASE = process.env.E2E_URL || 'http://localhost:5174/';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const SIZES = [[320, 568], [375, 667], [390, 844], [1280, 720], [568, 320], [667, 375], [844, 390]];

const browser = await chromium.launch({ channel: 'chrome' });
const active = (page) => page.evaluate(() => document.querySelector('.screen.is-active')?.id);

async function open(context, query = '?src=itu') {
  const page = await context.newPage();
  await page.goto(BASE + query);
  await page.waitForFunction(() => document.body.classList.contains('is-ready'));
  return page;
}

// Returns true when the element is inside the viewport or reachable by scrolling its screen.
async function reachable(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el || el.hidden) return false;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
  }, selector);
}

try {
  // 1. First visit plays the intro; a tap skips to the ready screen.
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: IPHONE_UA, hasTouch: true });
  let page = await open(mobile);
  assert.equal(await active(page), 'intro');
  assert.equal(await page.getAttribute('#intro', 'data-step'), 'mystery');
  await page.click('#intro', { position: { x: 20, y: 20 } });
  assert.equal(await page.getAttribute('#intro', 'data-step'), 'ready');

  // 2. Returning visitor lands on the ready screen directly.
  await page.close();
  page = await open(mobile);
  assert.equal(await page.getAttribute('#intro', 'data-step'), 'ready');

  // 3. Play a full round → box → double tap opens once → reward.
  await page.click('#btn-reward-play', { force: true });
  assert.equal(await active(page), 'play');
  await page.waitForFunction(() => document.querySelector('.screen.is-active')?.id === 'box', null, { timeout: 60_000 });
  await page.click('#btn-box', { force: true });
  await page.click('#btn-box', { force: true });
  await page.waitForFunction(() => document.querySelector('.screen.is-active')?.id === 'reward', null, { timeout: 5_000 });
  assert.equal(await page.locator('#reward-chat li').count() >= 2, true);
  assert.equal(await page.isVisible('[data-store="reward"]'), true, 'TOPLA visible on phones');
  assert.equal(await page.isHidden('#reward [data-desktop-only]'), true, 'QR hidden on phones');

  // 4. Desktop: TOPLA hidden, QR shown.
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const dpage = await open(desktop);
  await dpage.evaluate(() => {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('is-active', s.id === 'reward'));
  });
  assert.equal(await dpage.isHidden('[data-store="reward"]'), true, 'TOPLA hidden on desktop');
  assert.equal(await dpage.isVisible('#reward [data-desktop-only]'), true, 'QR shown on desktop');

  // 5. Classic flow is untouched.
  const classic = await open(desktop, '');
  assert.equal(await active(classic), 'start');

  // 6. Size sweep: BAŞLA and TOPLA reachable on every size.
  for (const [width, height] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width, height }, userAgent: IPHONE_UA });
    const p = await open(ctx);
    await p.click('#intro', { position: { x: 5, y: 5 } });
    assert.ok(await reachable(p, '#btn-reward-play'), `BAŞLA unreachable at ${width}x${height}`);
    await p.evaluate(() => {
      document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('is-active', s.id === 'reward'));
    });
    assert.ok(await reachable(p, '[data-store="reward"]'), `TOPLA unreachable at ${width}x${height}`);
    await ctx.close();
  }

  console.log('reward flow e2e: all checks passed');
} finally {
  await browser.close();
}
```

- [ ] **Step 3: Çalıştır**

Terminal 1: `npm run serve`
Terminal 2: `npm run e2e`
Expected: `reward flow e2e: all checks passed`. Bir boyutta BAŞLA/TOPLA erişilemezse ilgili `@media` kuralını `reward.css`'te düzelt ve tekrar çalıştır.

- [ ] **Step 4: Tüm testler**

Run: `npm test`
Expected: PASS (43 test)

- [ ] **Step 5: Commit**

```bash
git add test/e2e/reward-flow.e2e.mjs package.json package-lock.json
git commit -m "test: İTÜ ödül akışı için uçtan uca test ve boyut taraması

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
