# Neon Swarm

A neon arcade formation shooter in the spirit of **Galaga**, built with React and HTML5 Canvas. No build step, no bundler, nothing to install — open `index.html` and play.

![stack: React 18 + Canvas](https://img.shields.io/badge/stack-React%2018%20%2B%20Canvas-35f0ff)

## Play

**Live:** https://matii1942.github.io/Neon-Swarm/

Or clone and open `index.html` directly in a browser.

## Controls

| Action | Keys |
| --- | --- |
| Move | `←` `→` or `A` `D` |
| Fire | `Space` or `Z` |
| Pause | `P` or `Esc` |
| Start / restart | `Enter` or click |
| Touch | drag anywhere on the screen to move (autofire while held) |

## Features

- **40-strong formation** — 20 bees, 16 butterflies, 4 boss galagas — entering along curved flight paths, then breathing side to side in formation
- **Dive-bomb attacks** that swoop, shoot, loop off the bottom of the screen and re-enter from the top back into their slot; more concurrent divers each stage
- **Tractor-beam capture** — a boss galaga descends and fires its beam. Get caught and you lose a ship; shoot that boss afterwards and your rescued fighter returns as a **dual fighter**
- **Power-up drops** — `R` rapid fire, `W` spread shot, `S` shield, `1` extra ship
- **Stage progression** with rising speed and attack frequency, a PERFECT bonus for a no-loss stage, and an extra ship at 20,000 points
- High score persisted to `localStorage`, mute toggle, CRT scanline treatment, WebAudio sound effects synthesised at runtime (no audio files)

## Scoring

| Enemy | In formation | Diving |
| --- | --- | --- |
| Bee | 50 | 100 |
| Butterfly | 80 | 160 |
| Boss galaga (2 hits) | 150 | 400 |

Destroying a boss that is holding your captured fighter is worth an extra **1,000**. Clearing a stage without losing a ship awards **3,000**.

## Publishing on GitHub Pages

1. Push these files to the default branch of the repository.
2. In the repository, go to **Settings → Pages**.
3. Under *Build and deployment*, set **Source** to `Deploy from a branch`, pick your branch and the `/ (root)` folder, then **Save**.
4. After a minute the site is live at `https://matii1942.github.io/Neon-Swarm/`.

```bash
git init
git add .
git commit -m "Neon Swarm: Galaga-style formation shooter"
git branch -M main
git remote add origin https://github.com/matii1942/Neon-Swarm.git
git push -u origin main
```

## Project layout

```
index.html        markup, meta tags and the four <script> tags — no build step
css/style.css     cabinet chrome, neon palette, CRT scanline treatment
js/game.js        simulation + canvas renderer; publishes window.NeonSwarm
js/app.js         React shell: marquee, HUD, ship indicator, overlays
```

`game.js` must load before `app.js` — it exposes `window.NeonSwarm = { Game, loadHigh, W, H }`, which `app.js` consumes. React and ReactDOM come from cdnjs as UMD globals, so there is nothing to install and nothing to compile.

## How it works

- **React 18** (UMD builds from cdnjs, loaded via `<script>` tags) renders the cabinet shell — marquee, HUD, ship indicator, power-up chips, legend and the title / pause / game-over overlays.
- A plain-JavaScript `Game` class owns the simulation and draws every frame to a `<canvas>` at a fixed 480×640 logical resolution, scaled by CSS and `devicePixelRatio`. It pushes HUD snapshots up to React only when a displayed value actually changes, so React re-renders a few times a second rather than sixty.
- Flight paths are sampled parametric curves (entry sweeps, dive arcs) reduced to waypoint lists the enemies steer along, which keeps the motion curved without per-frame trigonometry per entity.
- Sound is generated on the fly with the Web Audio API — oscillators for shots and pickups, filtered noise bursts for explosions.

## License

MIT — see `LICENSE`.
