# feast. — Bıyıklı Şef'in Pizzası (QR oyunu)

QR → mobil web oyunu → oyun sonunda **feast'i indir** yönlendirmesi.
Build yok, bağımlılık yok (runtime). Statik dosyalar; herhangi bir CDN / Cloudflare Pages'e atılır.

## Akış
1. Kullanıcı masadaki/posterdeki QR'ı okutur → `https://<GAME_URL>/?src=qr`
2. 60 sn oyun: Bıyıklı Şef pizzaya malzeme yakalar; ananas / ayakkabı / kılçık can götürür, altın bıyık mıknatıs verir. Puan arttıkça şefin pizzası sos → peynir → malzeme olarak ilerler.
   - **Pazarlama katmanı:** Şef oyun boyunca konuşur (başlangıç, kombo, pizza aşaması, kötü malzeme, son 10 sn + ~8 sn'de bir feast. mesajı: "feast'i kesin indir, yeni mekânları ilk sen keşfet!"). Kırmızı **restoran pini** düşer → "YENİ MEKÂN!", +30 puan, "keşfedilen restoran" sayacı. Başlangıç ekranında feast. faydaları dönen ticker.
3. Oyun sonu: puan + rütbe + "📍 N yeni restoran keşfettin" + **"Canın ne çekiyor?"** mutfak seçimi (seçince indirme başlığı kişiselleşir: "Yakınındaki en iyi Döner mekânları feast'te!") + "Şefin tavsiyesi: Bunu kesin indir!" etiketi + **indirme kartı** (neden indirmeli maddeleri, platforma göre buton, 3 adımlı indirme rehberi).
   - iPhone/iPad → `https://apps.apple.com/tr/app/feast/id6762010641`
   - Android → Play Store `com.feast.mobile` (`referrer=utm_source=<src>` ile install kaynağı ölçülür)
   - Masaüstü → buton yerine QR (`?dl=1` → telefonda direkt mağazaya atar)

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
| `js/logic.js` | Saf kurallar: mağaza linki, puan/kombo, zorluk eğrisi, rütbe (test edilir) |
| `js/game.js` | Oyun döngüsü, input, çarpışma, render |
| `js/art.js` | Prosedürel malzeme çizimleri + arka plan |
| `js/main.js` | Ekranlar, HUD, mağaza CTA, paylaş, localStorage |
| `js/i18n.js` | TR (varsayılan) / EN metinler + şefin konuşma satırları (`lines_*`) — pazarlama metinlerini buradan düzenle |
| `tools/make-qr.mjs` | Markalı QR + poster üretici |

## Analytics
`window.dataLayer` varsa (GTM) şu event'ler basılır: `feast_game_view`, `_start`, `_end`, `_store_click`, `_craving` (seçilen mutfak), `_share`, `_store_redirect`.
