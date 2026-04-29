# 🌟 Starlight Inn

A cozy world of islands, trades, and starlit chats. A social pixel-art world inspired by Maplestory and Habbo Hotel.

## 📂 Repository Structure

| Directory | Contents |
|-----------|----------|
| `web/` | **Playable web game** — open `index.html` to play instantly |
| `sprite-forge/` | Procedural pixel art generator + 16 generated sprites |
| `unity/` | Unity 2022.3 LTS scaffolding (scenes, prefabs, scripts) |
| `MASTER_PROMPT.md` | Complete game specification — the project bible |

## 🚀 Play Now

### Option 1: Double-click HTML (Fastest)
1. Go to `web/`
2. Double-click `index.html`
3. Play!

### Option 2: Launcher (Better experience)
1. Double-click `Start Starlight Inn.bat`
2. Server starts, browser opens automatically
3. Play!

### Option 3: Online
- [Play on GitHub Pages](https://mapleteamxp.github.io/starlightinn/web/) *(after enabling Pages in Settings)*

## 🎮 Features

- 🏨 **6 Areas:** Starlight Inn, Beach, Forest, Treehouse, Park, Your Island
- 🎭 **6 Characters:** Neko, Rasta, Luna, Cpt. Kiko, Bun-Bun, Byte
- 🎨 **Procedural Sprites:** 32×48 pixel art, Maplestory chibi proportions
- 💱 **Trading:** Rarity system (Common → LTD) with glowing borders
- 💬 **Chat:** NPCs + simulated multiplayer
- 🏝️ **Island Builder:** Place furniture on your personal island
- 🎁 **Daily Rewards:** Login streak bonuses

## 🎨 Sprite Forge

Generate infinite character variations:
```bash
cd sprite-forge
node SpriteForge.js
```

Creates 6 canonical + 10 random sprites every run. All 32×48 PNG pixel art.

## 🛠️ Tech Stack

- **Web:** HTML5 Canvas 2D, vanilla JavaScript
- **Art:** Procedural pixel art (SpriteForge.js)
- **Server:** Node.js static file server (optional)
- **Unity:** 2022.3 LTS, URP 2D, Netcode for GameObjects

## 📄 License

MIT License — feel free to fork, modify, and build your own worlds.

## 🌐 Links

- **Repo:** https://github.com/MapleteamXP/starlightinn
- **Issues:** https://github.com/MapleteamXP/starlightinn/issues

---

Made with 💜 by the Starlight Inn team.
