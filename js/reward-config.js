// Reward flow (?src=itu) — every duration, text and option in one place.
// Texts use placeholders filled by campus.js from ?campus= (default İTÜ/ITU):
//   {campusPlural} → "İTÜ'lülere"   {campusLoc} → "İTÜ'de"   {campus} → "İTÜ"

export const REWARD_CONFIG = Object.freeze({
  // Intro steps 1–5 advance on their own; step 6 (BAŞLA) waits for a tap. ms.
  timings: Object.freeze({ mystery: 2000, swirl: 1500, scribble: 800, brand: 1500, promise: 2500 }),
  boxOpenMs: 1400, // shake builds up → flash → burst + particles → reward screen

  // Round lost before the 45 s ran out: 'box' = give the box anyway, 'retry' = back to BAŞLA.
  onLose: 'box',

  campus: Object.freeze({ tr: 'İTÜ', en: 'ITU', maxLength: 24 }),

  // Placeholder friend avatars until real profile artwork arrives.
  avatars: Object.freeze([
    { emoji: '👩‍🎓', bg: '#ffd23f' },
    { emoji: '🧑‍🍳', bg: '#ff8a65' },
    { emoji: '👨‍🎓', bg: '#7cc4ff' },
    { emoji: '👩‍💻', bg: '#b69cff' },
    { emoji: '🧑‍🎤', bg: '#7fe0a8' },
  ]),

  // Restaurant cards. No logo files yet: Mustachio shows a monogram until one
  // is added as { img: 'assets/…' }.
  restaurants: Object.freeze([
    { name: 'Mustachio', monogram: 'M', bg: '#3a1d10' },
    { name: 'Burger', img: 'assets/cuisine/burger.webp' },
    { name: 'Pizza', img: 'assets/cuisine/pizza.webp' },
    { name: 'Sushi', img: 'assets/cuisine/sushi.webp' },
  ]),

  strings: Object.freeze({
    tr: {
      introLead: '{campusPlural} özel',
      introPromise: 'Yeni döneme',
      introHot: 'ÖDÜLLE',
      introTail: 'başla',
      readyMain: '45 sn dayan',
      readyHot: 'ÖDÜLÜ AL',
      readyPlay: 'BAŞLA ▶',
      boxTitle: 'Ödülün hazır!',
      boxHint: 'Kutuya dokun, aç 👆',
      boxOpen: 'Ödül kutusunu aç',
      rewardTitle: '{campusLoc}, Kadıköy\'de, Beşiktaş\'ta tüm restoranları, tüm menü ve fiyatları ve tüm arkadaşlarını görmeye hak kazandın!',
      rewardCollect: 'TOPLA',
      rewardFriends: 'Arkadaşlarınla feast\'te buluş',
      rewardScore: 'Skorun: {score}',
    },
    en: {
      introLead: 'For {campus} students',
      introPromise: 'Start the new term',
      introHot: 'WITH A REWARD',
      introTail: 'on feast',
      readyMain: 'Survive 45 seconds',
      readyHot: 'CLAIM THE REWARD',
      readyPlay: 'START ▶',
      boxTitle: 'Your reward is ready!',
      boxHint: 'Tap the box to open 👆',
      boxOpen: 'Open the reward box',
      rewardTitle: 'You\'ve unlocked every restaurant in {campus}, Kadıköy and Beşiktaş, every menu and price, and all your friends!',
      rewardCollect: 'COLLECT',
      rewardFriends: 'Meet your friends on feast',
      rewardScore: 'Your score: {score}',
    },
  }),
});
