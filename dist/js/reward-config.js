// Reward flow (?src=itu) — every duration, text and option in one place.
// Texts use placeholders filled by campus.js from ?campus= (default İTÜ/ITU):
//   {campusPlural} → "İTÜ'lülere"   {campusLoc} → "İTÜ'de"   {campus} → "İTÜ"

export const REWARD_CONFIG = Object.freeze({
  // Intro steps 1–5 advance on their own; step 6 (BAŞLA) waits for a tap. ms.
  timings: Object.freeze({ mystery: 2000, swirl: 1500, scribble: 800, brand: 1500, promise: 2500 }),
  boxOpenMs: 1400, // shake builds up → flash → burst + particles → explainer

  // "feast nedir?" explainer between the opened box and the prize page (8 s,
  // no skipping). Styled after @feast_tr's "feast nedir?" highlight: red
  // background, white captions, the app inside a phone. One scene per entry. ms.
  explainer: Object.freeze({ hook: 1000, brand: 1200, map: 1500, reels: 2400, friends: 1900 }),

  // Full-screen dishes in the explainer's Reels-style feed (illustrative
  // names/prices). Photos: Unsplash (free Unsplash License), 540×960 WebP,
  // ids: pizza 1593560708920-61dd98c46a4e, burger 1571091718767-18b5b1457add,
  // sushi 1553621042-f6e147245754, sis 1599487488170-d11ec9c172f0.
  reels: Object.freeze([
    { name: 'Burrata Pizza', img: 'assets/reels/pizza.webp', price: 340 },
    { name: 'Cheeseburger', img: 'assets/reels/burger.webp', price: 285 },
    { name: 'Sushi Tabağı', img: 'assets/reels/sushi.webp', price: 460 },
    { name: 'Tavuk Şiş', img: 'assets/reels/sis.webp', price: 260 },
  ]),

  // Prize page: link to the giveaway rules. Empty = the link stays hidden.
  termsUrl: '',


  // Round lost before the 45 s ran out: 'box' = give the box anyway, 'retry' = "Az kaldı!" page with TEKRAR DENE.
  onLose: 'retry',

  // Where the yellow "feast'i indir" button on the download page goes.
  downloadUrl: 'https://get.feast.tr',

  campus: Object.freeze({ tr: 'İTÜ', en: 'ITU', maxLength: 24 }),

  strings: Object.freeze({
    tr: {
      introLead: '{campusPlural} özel',
      introPromise: 'Yeni döneme',
      introHot: 'ÖDÜLLE',
      introTail: 'başla',
      readyMain: '45 sn dayan',
      readyHot: 'ÖDÜLÜ AL',
      readyPlay: 'BAŞLA ▶',
      // Faint thought bubbles behind the BAŞLA screen (the questions feast answers).
      readyBubbles: [
        'Bugün ne yesek? 🤔',
        'Kampüste nerede yenir?',
        'Kahve ne içsek? ☕',
        'Acıktım, napsak?',
        'Nereye gitsek?',
        'Kadıköy\'de nerede yesek?',
        'Beşiktaş\'ta pizza nerede güzel? 🍕',
        'Ders çıkışı ne yiyoruz?',
      ],
      boxTitle: 'Sürpriz kutun geldi!',
      boxHint: 'Kutuya dokun, aç 👆',
      boxOpen: 'Ödül kutusunu aç',
      // Explainer (after the box opens): "feast nedir?" in six quick scenes
      exHook: 'Bugün ne yesek?',
      exSlogan: ['Nerede?', 'Ne?', 'Kaça?'],
      exMap: 'Yakınındaki tüm mekânlar haritada',
      exReels: 'Canının çektiğini bulana kadar',
      exSticker: 'KAYDIR',
      exSeeMap: 'Haritada Gör',
      exFriends: 'Arkadaşlarınla yeni tatlar keşfet',
      exChat: ['Kanka bugün ne yesek?', 'Şuna bak 👇', 'Gidiyoruz! 🔥'],
      // Prize page (after the explainer)
      rewardTitle: '3 adet AirPods\u00a05 hediye!', // nbsp: "AirPods 5" never splits
      rewardSub: 'Uygulamayı indir, {campusLoc} çekilişe katıl! 🎧',
      rewardTerms: 'Katılım koşulları',
      rewardDownload: 'feast\'i indir',
      rewardTagline: 'Küçük bir adım, büyük bir lezzet',
      rewardPlaceCampus: '📍 {campus}', // Kadıköy and Beşiktaş are plain text in index.html
      rewardMore: 've yakında daha fazlası ✨',
      // Retry page (lost before the 45 s ran out)
      retryTitle: 'Az kaldı!',
      retrySub: '{seconds} saniye dayandın. Ödül için 45 saniyeyi tamamla!',
      retryButton: 'TEKRAR DENE ▶',
      retryTip: 'İpucu: yeşil kapılardan geç, kırmızılardan kaç!',
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
      readyBubbles: [
        'What should we eat today? 🤔',
        'Where to eat on campus?',
        'Coffee, but where? ☕',
        'I\'m hungry, now what?',
        'Where should we go?',
        'Where to eat in Kadıköy?',
        'Best pizza in Beşiktaş? 🍕',
        'Food after class?',
      ],
      boxTitle: 'A surprise box for you!',
      boxHint: 'Tap the box to open 👆',
      boxOpen: 'Open the reward box',
      exHook: 'What should we eat today?',
      exSlogan: ['Where?', 'What?', 'How much?'],
      exMap: 'Every spot near you, on the map',
      exReels: 'Until you find what you\'re craving',
      exSticker: 'SWIPE',
      exSeeMap: 'See on map',
      exFriends: 'Discover new flavours with friends',
      exChat: ['What should we eat today?', 'Look at this 👇', 'Let\'s go! 🔥'],
      rewardTitle: '3 AirPods\u00a05 to win!',
      rewardSub: 'Get the app and join the {campus} draw! 🎧',
      rewardTerms: 'Giveaway rules',
      rewardDownload: 'Get feast',
      rewardTagline: 'A small step, a big feast',
      rewardPlaceCampus: '📍 {campus}',
      rewardMore: 'and more coming soon ✨',
      retryTitle: 'So close!',
      retrySub: 'You lasted {seconds} seconds. Make it to 45 to unlock the reward!',
      retryButton: 'TRY AGAIN ▶',
      retryTip: 'Tip: go through the green gates, dodge the red ones!',
      rewardScore: 'Your score: {score}',
    },
  }),
});
