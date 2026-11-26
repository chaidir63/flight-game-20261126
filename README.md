# Nusa Air — Island Hopper

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/chaidir63/flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/chaidir63/flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Fly a bush plane between the islands of an Indonesian archipelago. Each delivery asks you to fly through three rings and then land on the runway to drop off the cargo. Green rings refuel the tank; an empty tank means gliding. Three lives. Landings pay 500 points, rings pay 100, and a clean delivery with every ring flown pays a bonus.

## How to play

- **← →** (or **A / D**) turn. **↑ ↓** climb and descend. **W / S** throttle up and down.
- **Mouse**: move left or right of centre to steer. **Space**: boost (burns extra fuel).
- **P** pauses, **R** restarts, **Enter** starts.
- Keep the speed above 55 km/h or the wing stalls and the plane sinks. Land slow (under 145 km/h) and low (under 12 m) over the runway strip. Touching the sea or an island costs a life.
- Fuel drains with throttle. Fly through a green ring for +25 fuel, or land to refill the tank.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` directly in desktop Chrome. No build step, no network, no libraries — plain Canvas 2D, all art drawn in code.

## Screenshots

Taken by `node tools/shoot.mjs` — the game itself, rendered in headless Chrome at 1280x800: the chase view over the islands, a ring run, and the final approach to the runway.

---

Built by an AI agent for [make.fun](https://make.fun/r/a7hzkas8)'s "Make the best flight game" bounty.
