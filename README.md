# feast. — Şef Ordusu! (QR oyunu)

QR → mobil web oyunu → oyun sonunda **feast'i indir** yönlendirmesi.
Build yok, bağımlılık yok (runtime). Statik dosyalar; herhangi bir CDN / Cloudflare Pages'e atılır.

## Akış
1. Kullanıcı masadaki/posterdeki QR'ı okutur → `https://<GAME_URL>/?src=qr`
2. **Kalabalık atıcı (Last Z / "kapı" reklamları tarzı):** Bıyıklı Şef'in ekibi yolda ilerler; parmağı sağa-sola sürükleyerek ekibi yönlendirirsin (masaüstünde ← → / A D). Şefler kendiliğinden ileri yemek (domates, peynir, sucuk…) fırlatır.
   - **feast. kapıları:** yeşil `+N` / `×2` / `×3` ekibi büyütür, kırmızı `-N` / `÷2` küçültür. Ekibin merkezi hangi yarıdaysa o kapıdan geçer.
   - **Aç kalabalık:** yemekle vurulan müşteri doyar (😋, puan). Doymadan ekibe değen her aç müşteri şef kapar; büyük "OBUR"lar daha çok.
   - **Kilitli mekân:** uygulamanın mutfak fotoğrafı + HP sayısı. Kırınca "YENİ MEKÂN: Döner! 📍", keşfedilen restoran sayacı ve ekibe yeni şefler. Kırılamazsa çarpınca şef kaybedilir.
   - **Dev Obur (boss):** 13. bölümden sonra her 7 bölümde bir. Doyurursan büyük ödül; değerse ekip biter.
   - Ekip 0 olunca oyun biter. Puan = metre + doyurulan × 10 + keşfedilen restoran × 100 + en kalabalık ekip.
   - **Pazarlama katmanı:** kapılarda feast. logosu, yol kenarında "feast'te keşfet!" billboard'ları, şefin konuşma balonları (kapı, keşif, boss, ~8 sn'de bir feast. mesajı), başlangıç ekranında faydalar ticker'ı.
3. Oyun sonu: puan + rütbe + "📍 N yeni restoran keşfettin" + **"Canın ne çekiyor?"** mutfak seçimi (seçince indirme başlığı kişiselleşir: "Yakınındaki en iyi Döner mekânları feast'te!") + "Şefin tavsiyesi: Bunu kesin indir!" etiketi + **indirme kartı** (neden indirmeli maddeleri, platforma göre buton, 3 adımlı indirme rehberi) + **her cihazda görünen uygulama QR'ı**: "İndir, eğlenceye devam et! Restoranda postlarını paylaş…" (telefonda "masadaki arkadaşların da okutsun").
   - iPhone/iPad → `https://apps.apple.com/tr/app/feast/id6762010641`
   - Android → Play Store `com.feast.mobile` (`referrer=utm_source=<src>` ile install kaynağı ölçülür)
   - Masaüstü → buton yok, sadece QR (`?dl=1` → telefonda direkt mağazaya atar)

## Dil
Oyun **her cihazda Türkçe** açılır (tarayıcı dili ne olursa olsun). İngilizce sürüm için linke `?lang=en` ekle. Tüm metinler `js/i18n.js` içinde (`tr` kaynak, `en` çeviri).

## Lokal
```bash
npm run serve        # http://localhost:5174
npm test             # logic.js + squad-logic.js birim testleri (node:test)
```

## QR / poster üretimi
```bash
npm install          # sadece qrcode (dev)
GAME_URL=https://oyun.feast.tr/ npm run qr
```
Çıktılar: `qr/feast-game-qr.{svg,png}` (baskı), `qr/feast-game-poster.{svg,png}` (A6 masa kartı),
`assets/store-qr.svg` (masaüstü bitiş ekranı). **Domain değişirse `npm run qr` tekrar çalıştır ve deploy et.**
Kampanya ayırmak için QR'ları farklı `src` ile üretebilirsin (ör. restoran bazlı) — Play referrer'ına taşınır.

## Performans notları
- Toplam ~110 KB asset (şef ekibi, müşteriler ve kapılar prosedürel çizilir; sadece mutfak fotoğrafları + logo WebP), JS ~30 KB, harici font/kütüphane yok.
- Canvas DPR ≤ 2, malzemeler açılışta offscreen canvas'a bir kez çizilir; oyun döngüsü sadece `drawImage`.
- Object pool (varlık/mermi/parçacık/popup), ekranda en fazla 42 şef çizilir (sayı banner’da) → frame başına allocation yok. HUD DOM'u sadece değer değişince güncellenir.
- Sekme arka plana geçince döngü durur; dönüşte 3-2-1 geri sayımla devam eder.
- Ses WebAudio ile sentezlenir (dosya yok), ilk dokunuşta açılır; sessiz modu hatırlanır.

## Dosyalar
| Dosya | Görev |
|---|---|
| `js/logic.js` | Saf kurallar: mağaza linki, platform, rütbe, dil, mutfaklar (test edilir) |
| `js/squad-logic.js` | Ekip kuralları: kapılar, formasyon, hasar, bölüm üretimi, boss, puan (test edilir) |
| `js/game.js` | Atıcı motoru: perspektif yol, sürükleme, atış, çarpışma, render |
| `js/crowd-art.js` | Şef ekibi, aç müşteriler, Dev Obur, kapı ve kilitli mekân sprite'ları |
| `js/fx.js` | Parçacık + uçan yazı havuzları |
| `js/scenery.js` | Billboard'lar, İstanbul silueti |
| `js/art.js` | Prosedürel malzeme çizimleri |
| `js/main.js` | Ekranlar, HUD, mağaza CTA, paylaş, localStorage |
| `js/i18n.js` | TR (varsayılan) / EN metinler + şefin konuşma satırları (`lines_*`) — pazarlama metinlerini buradan düzenle |
| `tools/make-qr.mjs` | Markalı QR + poster üretici |

## Analytics
`window.dataLayer` varsa (GTM) şu event'ler basılır: `feast_game_view`, `_start`, `_end`, `_store_click`, `_craving` (seçilen mutfak), `_share`, `_store_redirect`.
