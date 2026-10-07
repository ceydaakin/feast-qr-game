// Event themes: a QR printed for a venue opens the game with `?src=<id>`, which
// swaps in local copy (strings), scenery, crowd art labels and roadside signs.
// Pure data + lookup so it is unit-tested in Node.

const ITU_BLUE = ['#0b3e7a', '#1f5fae', '#3a7bd5'];

export const THEMES = Object.freeze({
  itu: {
    scene: { sky: 'stadium', ground: 'stadium', bees: 3, crisp: true }, // bees stay on the sides (js/bees.js)
    // Bundled rounded font (assets/fonts, declared in reward.css) for pages AND canvas text.
    font: '"Baloo 2"',
    // Start-of-round tutorial: just two short lines in one white card.
    tutorial: { lines: ['tutDrag', 'tutGates'], card: true },
    maxSquad: 999999, // chef counter keeps going past 999 (base game stops at 999); 6 digits fit the banner and HUD
    art: {
      eaterLabel: 'İTÜ',
      shirts: ITU_BLUE,
      chefScale: 1.5, // the player's chef squad, 50 % bigger than the base game
      crowdScale: 1.3, // hungry customers, OBUR and boss, 30 % bigger
      // Images that replace the drawn characters/food (see assets/itu/README.md).
      // Put the file in assets/itu/ AND add its name here.
      spriteDir: 'assets/itu/',
      spriteExt: 'webp',
      sprites: [
        'chef', 'chef-leader', 'eater-1', 'eater-2', 'eater-3', 'eater-big', 'boss',
        'tomato', 'cheese', 'pepperoni', 'mushroom', 'olive', 'basil', 'potato',
        'bee-1', 'bee-2',
      ],
      // Thrown food: the base six plus potato (image-only).
      food: ['tomato', 'cheese', 'pepperoni', 'mushroom', 'olive', 'basil', 'potato'],
    },
    signs: {
      tr: [['Hoş geldin!', 'Yeni dönem · İTÜ 1773'], ['MED Çimleri', 'Piknik zamanı 🧺'], ['MED Makarnası', 'Sıcak sıcak 🍝'], ['Gölet', 'Kenarında mola 🦆'], ['Ayazağa', 'Yemekhane sırası →']],
      en: [['Welcome!', 'New term · ITU 1773'], ['MED Lawns', 'Picnic time 🧺'], ['MED Pasta', 'Served hot 🍝'], ['The Pond', 'Take a break 🦆'], ['Ayazağa', 'Cafeteria queue →']],
    },
    strings: {
      tr: {
        shareText: 'Yeni dönemde İTÜ Stadyumu\'nda Şef Ordusu\'nda 45 saniyede {score} puan yaptım! Sen kaç kişiyi doyurursun? 🍝',
        bossIncoming: 'DEV OBUR STADA GİRDİ! 👑',
        tutDrag: '👆 Sürükle, yönlendir',
        tutGates: '🟢 Yeşil kapıdan geç',
        lines_start: ['Okul başladı, kampüs aç! Atın!', 'Stat dolu, herkes aç! Hadi doyuralım!'],
        lines_gateGood: ['Ekip büyüyor, MED çimleri gibi kalabalık!', 'Daha çok şef, daha çok MED makarnası! 🍝', 'Tribünler coştu, ekip büyüyor! 📣'],
        lines_gateBad: ['Ayy! Yanlış kapı, ders programı gibi karıştı!', 'Şefler dağıldı! Yeşil kapıları seç!'],
        lines_bad: ['Ayy! Bir şefimizi kaptılar!', 'Dikkat! Ders çıkışı açlığı yaklaşıyor 😅', 'Of! Ekip küçüldü, kapılara bak!'],
        lines_fed: ['Herkes doydu! Çimlerde piknik zamanı 🧺', 'Ders çıkışı aç kalan kalmasın, mekânlar feast\'te!'],
        lines_boss: ['Dev Obur stada girdi! Hep birlikte atın!', 'Bu iş tek şefle olmaz, hepimiz atıyoruz!'],
        lines_bossDown: ['Dev Obur bile doydu! Tribünler ayakta, feast\'i indir!'],
        lines_final: ['Son 10 saniye! Sonra MED çimlerinde feast\'le keyif 🚀', 'Son 10 saniye! Asıl lezzet ders çıkışı feast\'te!'],
        lines_idle: [
          'MED makarnası mı, yeni bir mekân mı? feast\'e bak!',
          'MED çimlerinde piknik mi? Yakındaki lezzetler feast\'te 🧺',
          'Gölet kenarında mola mı? Yakındaki kafeler feast\'te 🦆',
          'Yemekhane sırası uzun mu? Yakındaki mekânlar feast\'te!',
          'Maslak\'ta bugün ne yesek? feast biliyor!',
          'Pssst… oyun bitince feast\'i indirmeyi unutma!',
        ],
      },
      en: {
        shareText: 'I scored {score} in 45 seconds of Chef Army at the ITU Stadium! How many can you feed? 🍝',
        bossIncoming: 'THE GLUTTON ENTERED THE STADIUM! 👑',
        tutDrag: '👆 Drag to steer',
        tutGates: '🟢 Go through green gates',
        lines_start: ['School\'s back and campus is hungry! Throw!', 'Full stadium, everyone\'s hungry! Let\'s feed them!'],
        lines_gateGood: ['The squad is as crowded as the MED lawns!', 'More chefs, more MED pasta! 🍝', 'The stands go wild! 📣'],
        lines_fed: ['Everyone\'s full! Picnic time on the lawns 🧺', 'Nobody stays hungry after class, the spots are on feast!'],
        lines_boss: ['The Glutton entered the stadium! Everybody throw!', 'One chef can\'t do this, we all throw!'],
      },
    },
  },
});

export function pickTheme(src) {
  const id = String(src || '').toLowerCase();
  return Object.hasOwn(THEMES, id) ? { id, ...THEMES[id] } : null;
}
