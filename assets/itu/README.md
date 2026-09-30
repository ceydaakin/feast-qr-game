# İTÜ sprite PNGs (optional)

Put PNGs in this folder to replace the drawn characters and thrown food in the
`?src=itu` game. Every file is optional: anything missing keeps its current drawing.
The layout doesn't change, because each PNG is fitted into the same box the drawing used.

Rules for all files: transparent background, PNG, character's feet on the bottom edge.

| File | What it is | Recommended size |
|---|---|---|
| `chef.png` | Squad chef, **seen from behind** (runs away from the camera) | 320×400 |
| `chef-leader.png` | Leader chef at the front of the squad (falls back to `chef.png`) | 320×400 |
| `eater-1.png` | Hungry customer, facing the camera | 320×400 |
| `eater-2.png` | Second customer variant (falls back to `eater-1.png`) | 320×400 |
| `eater-3.png` | Third customer variant (falls back to `eater-1.png`) | 320×400 |
| `eater-big.png` | Big "OBUR" customer | 480×600 |
| `boss.png` | "Dev Obur" boss | 640×800 |
| `tomato.png` | Thrown food (it spins in flight) | 128×128 |
| `cheese.png` | Thrown food | 128×128 |
| `pepperoni.png` | Thrown food | 128×128 |
| `mushroom.png` | Thrown food | 128×128 |
| `olive.png` | Thrown food | 128×128 |
| `basil.png` | Thrown food | 128×128 |

Characters use a 4:5 (portrait) box. Food uses a square box.
The "İTÜ" text on the customers' bibs is part of the drawing, so if you want it,
include it in your PNG.
