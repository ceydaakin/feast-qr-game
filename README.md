# feast. — Şef Ordusu! (QR oyunu)

QR → mobil web oyunu → oyun sonunda **feast'i indir** yönlendirmesi.
Build yok, bağımlılık yok (runtime). Statik dosyalar; herhangi bir CDN / Cloudflare Pages'e atılır.

## Akış
Tek oyun var; her link aynı akışı açar (`?src=` sadece analytics / mağaza referrer'ı için tutulur, `?campus=ODTÜ` kampüs adını değiştirir).
1. Kullanıcı QR'ı okutur → `https://<GAME_URL>/?src=qr`
2. **Giriş:** sarmal → feast logosu → "45 sn dayan, ÖDÜLÜ AL" + **BAŞLA** (dokununca giriş atlanır).
3. **45 sn oyun:** Bıyıklı Şef'in ekibini sağa-sola sürükle (masaüstünde ← → / A D); yeşil kapılar ekibi büyütür, kırmızılar küçültür; aç kalabalığı yemekle doyur, kilitli mekânları kır, Dev Obur'u doyur.
   - Süre dolmadan ekip biterse → **"Az kaldı!"** sayfası + TEKRAR DENE.
4. **Sürpriz kutu** → dokununca açılır.
5. **"feast nedir?" animasyonu (8 sn, atlanamaz):** @feast_tr "feast nedir?" öne çıkanı stilinde — "Bugün ne yesek?" → "Nerede? Ne? Kaça?" → harita → KAYDIR (Reels gibi tam ekran yemekler) → arkadaş sohbeti. Hareketi azaltmış cihazlar doğrudan ödül sayfasına geçer.
6. **Ödül sayfası:** "3 adet AirPods 5 hediye!" + **feast'i indir** (her cihazda `https://get.feast.tr`).

Süreler, metinler, Reels yemekleri, çekiliş koşulları linki (`termsUrl`): `js/reward-config.js`.

## Dil
Oyun **her cihazda Türkçe** açılır (tarayıcı dili ne olursa olsun). İngilizce sürüm için linke `?lang=en` ekle. Tüm metinler `js/i18n.js` içinde (`tr` kaynak, `en` çeviri).

## Lokal
```bash
npm run serve        # http://localhost:5174
npm test             # birim testleri (node:test)
npm run e2e          # tarayıcıda uçtan uca akış (önce npm run serve)
```

## QR / poster üretimi
```bash
npm install          # sadece qrcode (dev)
GAME_URL=https://oyun.feast.tr/ npm run qr
```
Çıktılar: `qr/feast-game-qr.{svg,png}` (baskı), `qr/feast-game-poster.{svg,png}` (A6 masa kartı).
**Domain değişirse `npm run qr` tekrar çalıştır ve deploy et.**
Kampanya ayırmak için QR'ları farklı `src` ile üretebilirsin (ör. restoran bazlı) — analytics event'lerine `source` olarak düşer.

## Performans notları
- Oyun asset'leri WebP + kendi fontumuz (Baloo 2); harici kütüphane yok. Reels fotoğrafları (`assets/reels/`, ~180 KB) sadece kutu açılınca yüklenir.
- Canvas DPR ≤ 2, malzemeler açılışta offscreen canvas'a bir kez çizilir; oyun döngüsü sadece `drawImage`.
- Object pool (varlık/mermi/parçacık/popup), ekranda en fazla 42 şef çizilir (sayı banner’da) → frame başına allocation yok. HUD DOM'u sadece değer değişince güncellenir.
- Sekme arka plana geçince döngü durur; dönüşte 3-2-1 geri sayımla devam eder.
- Ses WebAudio ile sentezlenir (dosya yok), ilk dokunuşta açılır; sessiz modu hatırlanır.

## Dosyalar
| Dosya | Görev |
|---|---|
| `js/logic.js` | Saf kurallar: platform, dil, şef replikleri, mutfaklar (test edilir) |
| `js/squad-logic.js` | Ekip kuralları: kapılar, formasyon, hasar, bölüm üretimi, boss, puan (test edilir) |
| `js/game.js` | Atıcı motoru: perspektif yol, sürükleme, atış, çarpışma, render |
| `js/crowd-art.js` | Şef ekibi, aç müşteriler, Dev Obur, kapı ve kilitli mekân sprite'ları |
| `js/fx.js` | Parçacık + uçan yazı havuzları |
| `js/scenery.js` | Billboard'lar, İstanbul silueti |
| `js/art.js` | Prosedürel malzeme çizimleri |
| `js/main.js` | Ekranlar arası akış (SPA), HUD, indirme butonu, paylaş |
| `js/flow.js` · `js/reward-ui.js` · `js/reward-config.js` · `reward.css` | Giriş, kutu, "feast nedir?" animasyonu ve ödül sayfası (süreler/metinler config'te) |
| `js/themes.js` · `js/campus.js` | İTÜ görünümü, kampüs adı (`?campus=`) |
| `js/i18n.js` | TR (varsayılan) / EN metinler + şefin konuşma satırları (`lines_*`) — pazarlama metinlerini buradan düzenle |
| `tools/make-qr.mjs` | Markalı QR + poster üretici |

## Analytics
`window.dataLayer` varsa (GTM) şu event'ler basılır: `feast_game_view`, `_intro_ready`, `_start`, `_end`, `_retry_offered`, `_box_open`, `_explainer_view`, `_reward_view`, `_store_click`, `_share`.
