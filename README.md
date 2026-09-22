# feast. — Bıyıklı Şef Koşuyor! (QR oyunu)

QR → mobil web oyunu → oyun sonunda **feast'i indir** yönlendirmesi.
Build yok, bağımlılık yok (runtime). Statik dosyalar; herhangi bir CDN / Cloudflare Pages'e atılır.

## Akış
1. Kullanıcı masadaki/posterdeki QR'ı okutur → `https://<GAME_URL>/?src=qr`
2. **Sonsuz koşu (Subway Surfers tarzı):** Bıyıklı Şef 3 şeritli yemek sokağında koşar. Kaydır ← → şerit, ↑ zıpla, ↓ kay (ekranın sol/sağına dokunmak da şerit değiştirir; masaüstünde ok tuşları / WASD / boşluk).
   Engeller: feast. pizza kutuları (zıpla), feast. pankartı (altından kay), feast. food truck (şerit değiştir). Malzemeler = coin, restoran pini = yeni mekân (+30), altın bıyık = mıknatıs. Hız zamanla artar; 3 çarpışmada oyun biter. Puan = metre + toplananlar × kombo.
   - **Pazarlama katmanı:** Yol kenarında uygulamanın kendi mutfak fotoğraflarıyla "feast'te keşfet!" billboard'ları. Şef oyun boyunca konuşur (başlangıç, kombo, hızlanma, pizza aşaması, çarpışma + ~8 sn'de bir feast. mesajı: "feast'i kesin indir, yeni mekânları ilk sen keşfet!"). Kırmızı **restoran pini** düşer → "YENİ MEKÂN!", +30 puan, "keşfedilen restoran" sayacı. Başlangıç ekranında feast. faydaları dönen ticker.
3. Oyun sonu: puan + rütbe + "📍 N yeni restoran keşfettin" + **"Canın ne çekiyor?"** mutfak seçimi (seçince indirme başlığı kişiselleşir: "Yakınındaki en iyi Döner mekânları feast'te!") + "Şefin tavsiyesi: Bunu kesin indir!" etiketi + **indirme kartı** (neden indirmeli maddeleri, platforma göre buton, 3 adımlı indirme rehberi).
   - iPhone/iPad → `https://apps.apple.com/tr/app/feast/id6762010641`
   - Android → Play Store `com.feast.mobile` (`referrer=utm_source=<src>` ile install kaynağı ölçülür)
   - Masaüstü → buton yerine QR (`?dl=1` → telefonda direkt mağazaya atar)

## Dil
Oyun **her cihazda Türkçe** açılır (tarayıcı dili ne olursa olsun). İngilizce sürüm için linke `?lang=en` ekle. Tüm metinler `js/i18n.js` içinde (`tr` kaynak, `en` çeviri).

## Lokal
```bash
npm run serve        # http://localhost:5174
npm test             # logic.js birim testleri (node:test)
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
- Toplam ~110 KB asset (4 WebP şef sprite'ı, 3.7 MB SVG'lerden türetildi), JS ~30 KB, harici font/kütüphane yok.
- Canvas DPR ≤ 2, malzemeler açılışta offscreen canvas'a bir kez çizilir; oyun döngüsü sadece `drawImage`.
- Object pool (item/particle/popup) → frame başına allocation yok. HUD DOM'u sadece değer değişince güncellenir.
- Sekme arka plana geçince döngü durur; dönüşte 3-2-1 geri sayımla devam eder.
- Ses WebAudio ile sentezlenir (dosya yok), ilk dokunuşta açılır; sessiz modu hatırlanır.

## Dosyalar
| Dosya | Görev |
|---|---|
| `js/logic.js` | Saf kurallar: mağaza linki, puan/kombo, rütbe, item tanımları (test edilir) |
| `js/runner-logic.js` | Koşu kuralları: hız eğrisi, satır üretimi, swipe algılama, çarpışma (test edilir) |
| `js/game.js` | Koşu motoru: perspektif yol, döngü, input, çarpışma, render |
| `js/scenery.js` | Engel sprite'ları, billboard'lar, İstanbul silueti |
| `js/art.js` | Prosedürel malzeme çizimleri |
| `js/main.js` | Ekranlar, HUD, mağaza CTA, paylaş, localStorage |
| `js/i18n.js` | TR (varsayılan) / EN metinler + şefin konuşma satırları (`lines_*`) — pazarlama metinlerini buradan düzenle |
| `tools/make-qr.mjs` | Markalı QR + poster üretici |

## Analytics
`window.dataLayer` varsa (GTM) şu event'ler basılır: `feast_game_view`, `_start`, `_end`, `_store_click`, `_craving` (seçilen mutfak), `_share`, `_store_redirect`.
