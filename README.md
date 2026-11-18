# Trinity

**A Game of Tycoons, Landmarks, and Hostile Takeovers**

*2–4 Players | 30–45 Minutes | Ages 10+*

## About

Trinity is a tile-placement strategy board game where players compete as rival tycoons racing to dominate a booming city. Build your real estate empire by strategically placing **Housing**, **Commerce**, and **Industry** tiles on an 8×8 city grid.

When you connect all three tile types, you create a **Landmark**—a monument to your success. But beware: rival tycoons eye the same plots. When negotiation fails, deploy your **Agents** to secure your holdings or execute hostile takeovers of competitors' assets.

When the board is full, the tycoon with the most Landmarks wins.

## Key Features

- **Perfect Information**: All tiles in hand are visible—plan and counter-plan accordingly
- **Engine Building**: Landmarks grant bonus tile draws, accelerating your growth
- **Tactical Combat**: Convert Landmarks to Headquarters to deploy Agents for offense or defense
- **Risk vs Reward**: Headquarters provide Agents but don't count toward victory

## Digital Version

This repository contains a WebGL-based digital implementation of Trinity featuring:

- WebGL 2.0 rendering with WebGL 1.0 fallback
- Isometric camera with smooth controls
- Interactive tile hover and selection
- Real-time shader-based board rendering

## Getting Started

No dependencies and no build step: the files in this repo are what the browser loads.

```bash
npm start   # node server.js, or serve the folder with any static server
npm test    # node:test, Node 22+
```

Then open `http://localhost:3000` in your browser.

## Tech Stack

- Vanilla JavaScript (ES6 modules)
- WebGL 2.0
- GLSL shaders
- Node.js (optional dev server, built-in test runner; no npm packages)

## License

All rights reserved.

---

*Build your legacy. The city is watching.*
