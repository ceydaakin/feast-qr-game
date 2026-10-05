# İTÜ character & food images

These images replace the drawn characters and thrown food in the `?src=itu`
game. They are listed in `js/themes.js` (`art.sprites`, `spriteExt: 'webp'`);
only listed names are loaded.

| File | What it is |
|---|---|
| `chef.webp` | Squad chef, seen from behind |
| `chef-leader.webp` | Front chef (star on the hat) |
| `eater-1.webp` | Hungry customer: bearded man |
| `eater-2.webp` | Hungry customer: plaid shirt |
| `eater-3.webp` | Hungry customer: red-haired woman |
| `eater-big.webp` | Big "OBUR" customer |
| `boss.webp` | "Dev Obur" boss |
| `tomato.webp` `cheese.webp` `pepperoni.webp` `mushroom.webp` `olive.webp` `basil.webp` `potato.webp` | Thrown food (it spins in flight) |

The originals had green backgrounds; they were cut out, cropped and
resized (characters 360 px tall, OBUR 480, boss 640, food 160) and saved as
WebP with transparency (~250 KB for all 14).

## Replacing one

Transparent background, character's feet on the bottom edge, saved as
`.webp` with the same name. Any name you remove from `art.sprites` goes back
to its drawn version (potato is image-only: without its file it is simply not
thrown).
