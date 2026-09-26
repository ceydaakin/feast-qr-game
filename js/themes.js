// Event themes: a QR printed for a venue opens the game with `?src=<id>`, which
// swaps in local copy (strings), scenery, crowd art labels and roadside signs.
// Pure data + lookup so it is unit-tested in Node.

const ITU_BLUE = ['#0b3e7a', '#1f5fae', '#3a7bd5'];

export const THEMES = Object.freeze({
  itu: {
    scene: { sky: 'stadium', ground: 'stadium', bees: 6 },
    art: {
      eaterLabel: 'İTÜ',
      shirts: ITU_BLUE,
    },
    signs: {
      tr: [['Hoş geldin!', 'Yeni dönem · İTÜ 1773'], ['MED Çimleri', 'Piknik zamanı 🧺'], ['MED Makarnası', 'Sıcak sıcak 🍝'], ['Gölet', 'Kenarında mola 🦆'], ['Ayazağa', 'Yemekhane sırası →']],
      en: [['Welcome!', 'New term · ITU 1773'], ['MED Lawns', 'Picnic time 🧺'], ['MED Pasta', 'Served hot 🍝'], ['The Pond', 'Take a break 🦆'], ['Ayazağa', 'Cafeteria queue →']],
    },
    strings: {
      tr: {
        headline: '45 saniye oyna, yeni döneme İTÜ usulü başla!',
        roundBadge: 'Yeni döneme özel 45 saniyelik lezzet turu',
        subtitle: 'Okul başladı, kampüs aç! İTÜ Stadyumu\'nda şef ordunu büyüt, MED çimlerinden gölet kenarına herkesi doyur — gerçek lezzetler oyunun sonunda.',
        over_time: 'Tebrikler, İTÜ\'yü doyurdun! 🎉',
        ranks: ['Hazırlıkçı 📘', 'Birinci Sınıf', 'Kıdemli', 'Kampüs Efsanesi 🏆'],
        shareText: 'Yeni dönemde İTÜ Stadyumu\'nda Şef Ordusu\'nda 45 saniyede {score} puan yaptım! Sen kaç kişiyi doyurursun? 🍝',
        bossIncoming: 'DEV OBUR STADA GİRDİ! 👑',
        lines_start: ['Okul başladı, kampüs aç! Atın!', 'Stat dolu, herkes aç! Hadi doyuralım!'],
        lines_gateGood: ['Ekip büyüyor, MED çimleri gibi kalabalık!', 'Daha çok şef, daha çok MED makarnası! 🍝', 'Tribünler coştu, ekip büyüyor! 📣'],
        lines_gateBad: ['Ayy! Yanlış kapı, ders programı gibi karıştı!', 'Şefler dağıldı! Yeşil kapıları seç!'],
        lines_bad: ['Ayy! Bir şefimizi kaptılar!', 'Dikkat! Ders çıkışı açlığı yaklaşıyor 😅', 'Of! Ekip küçüldü, kapılara bak!'],
        lines_fed: ['Herkes doydu! Çimlerde piknik zamanı 🧺', 'Ders çıkışı aç kalan kalmasın — mekânlar feast\'te!'],
        lines_boss: ['Dev Obur stada girdi! Hep birlikte atın!', 'Bu iş tek şefle olmaz — hepimiz atıyoruz!'],
        lines_bossDown: ['Dev Obur bile doydu! Tribünler ayakta — feast\'i indir!'],
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
        headline: 'Play 45 seconds, start the new term the ITU way!',
        roundBadge: 'A 45-second taste tour for the new term',
        subtitle: 'School\'s back and campus is hungry! Grow your chef army in the ITU Stadium and feed everyone from the MED lawns to the pond.',
        over_time: 'Well done, you fed ITU! 🎉',
        ranks: ['Prep Student 📘', 'Freshman', 'Senior', 'Campus Legend 🏆'],
        shareText: 'I scored {score} in 45 seconds of Chef Army at the ITU Stadium! How many can you feed? 🍝',
        bossIncoming: 'THE GLUTTON ENTERED THE STADIUM! 👑',
        lines_start: ['School\'s back and campus is hungry! Throw!', 'Full stadium, everyone\'s hungry! Let\'s feed them!'],
        lines_gateGood: ['The squad is as crowded as the MED lawns!', 'More chefs, more MED pasta! 🍝', 'The stands go wild! 📣'],
        lines_fed: ['Everyone\'s full! Picnic time on the lawns 🧺', 'Nobody stays hungry after class — the spots are on feast!'],
        lines_boss: ['The Glutton entered the stadium! Everybody throw!', 'One chef can\'t do this — we all throw!'],
      },
    },
  },
});

export function pickTheme(src) {
  const id = String(src || '').toLowerCase();
  return Object.hasOwn(THEMES, id) ? { id, ...THEMES[id] } : null;
}
