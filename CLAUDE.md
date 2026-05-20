# World Cup 2026 — Betting App

## Project context

Build a full-stack friend betting app for the 2026 FIFA World Cup. The app is self-hosted on a local server (LAN access, ~50 users max). No cloud deployment needed.

## Stack

- **Frontend**: React + Vite (responsive, mobile-first)
- **Backend**: Node.js + Express (minimal API)
- **Database**: Firebase Realtime Database
- **Auth**: pseudo-based (no email/password), stored in localStorage

## Project structure

```
worldcup2026/
├── client/          # React + Vite
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── context/    # AppContext (global state)
│       ├── data/       # mockData.js (all 104 matches hardcoded)
│       └── hooks/
├── server/          # Node + Express
│   ├── index.js
│   └── firebase.js
└── README.md
```

## Data model (Firebase Realtime DB)

```
/players/{pseudoId}        → { name, avatar, createdAt }
/bets/{pseudoId}/{matchId} → 'home' | 'draw' | 'away'
/matches/{matchId}/result  → { homeScore, awayScore, winner }
/settings/adminPassword    → string
```

## Match data

All 104 matches are hardcoded in `client/src/data/mockData.js`:
- **48 group stage matches**: 12 groups (A–L) × 4 teams × 3 matchdays
- **32 Round of 32 matches**
- **16 Round of 16 matches**
- **8 Quarter-finals**
- **4 Semi-finals**
- **1 Third-place match**
- **1 Final**

Use realistic but mocked team names and dates. Groups A–L with 4 teams each.

## Betting rules

- **Group stage**: 3 outcomes → home win / draw / away win → **1 point** if correct
- **Knockout rounds**: 2 outcomes → home win / away win (no draw) → points scale by round:
  - R32 = 2pts, R16 = 3pts, QF = 4pts, SF = 5pts, Final = 6pts, 3rd place = 3pts

## Tiebreaker logic (group standings)

Apply FIFA 2026 official criteria in order:
1. Points (W=3, D=1, L=0)
2. Goal difference (all group matches)
3. Goals scored (all group matches)
4. Points in head-to-head matches between tied teams
5. Goal difference in head-to-head matches
6. Goals scored in head-to-head matches
7. Fair-play score (yellow = -1, indirect red = -2, direct red = -3)
8. If still tied → flag as `requiresDrawingOfLots: true` for admin to resolve manually

## Pages / views

### 1. Login page
- Pseudo input (min 2 chars, max 20)
- Avatar picker (12 emoji options)
- "Join" button → creates or retrieves player by name (case-insensitive)
- Store in localStorage

### 2. Home page
- Greeting with avatar + name
- 3 stat cards: my points / my bets count / my rank
- Tournament progress bar (X/104 matches played)
- Section "To bet now" → next 3 matches without a bet placed
- Section "Upcoming" → next 3 matches already bet

### 3. Calendar page
- Filter tabs: All / By phase / By group
- Each match shows: teams, date, time, venue, phase badge
- Show user's current bet if placed
- Inline bet buttons (for upcoming matches without a bet)
- Finished matches show score + whether bet was correct (green border) or wrong (red border)

### 4. My bets page
- List of all 104 matches
- For each: show current bet or 3-button picker (home/draw/away)
- Knockout matches show only 2 buttons (no draw)
- Group by phase with collapsible sections
- Badge showing bet count vs total (ex: "47/104")

### 5. Scoreboard page
- Ranked list of all players by total points
- Show: rank, avatar, name, total points, correct bets count
- Highlight current user's row
- Per-phase breakdown accordion (group stage / knockouts)
- Show group standings table per group (A–L) with tiebreaker logic applied

### 6. Admin panel (password-protected: "admin2026")
- Access via nav icon, password modal
- Enter official match results (home score / away score) per match
- Points auto-calculated and propagated to all player scores
- Visual confirmation of which players had the correct bet per match

## UI requirements

- **Mobile-first**, fully responsive (works on 375px phones and 1440px desktops)
- **Bottom navigation bar** on mobile (5 tabs)
- **Left sidebar** on desktop (≥768px)
- Dark-friendly color scheme (CSS variables for all colors)
- No external UI library — plain CSS with CSS variables
- Smooth transitions on bet selection and page changes

## Backend (Node + Express)

Minimal — only handles:
- `POST /api/auth/admin` → verify admin password (never expose password to client)
- `POST /api/results/:matchId` → write official result to Firebase (admin-only, protected by server-side password check)
- `GET /api/health` → server status
- Serve the Vite build (`express.static`) in production

All other data (bets, scoreboard, player list) → read/write directly from React via Firebase client SDK.

## Firebase rules (Realtime DB)

```json
{
  "rules": {
    "players": { ".read": true, ".write": true },
    "bets": { ".read": true, ".write": true },
    "matches": { ".read": true, ".write": false },
    "settings": { ".read": false, ".write": false }
  }
}
```

Match results and settings are written only via the Node backend with the Firebase Admin SDK.

## README must include

- Prerequisites (Node 18+, Firebase project setup)
- `npm install` steps for both `/client` and `/server`
- Firebase config setup (env variables)
- Dev mode: `npm run dev` in client + `node index.js` in server
- Production: `npm run build` in client → Express serves the build
- LAN access: how to expose on local network (server host: `0.0.0.0`)

## Constraints

- MUST work offline once loaded (Firebase handles sync)
- NEVER use TypeScript — plain JavaScript only
- NEVER use a CSS framework (no Tailwind, no Bootstrap)
- NEVER add features beyond what is specified above
- All mock data MUST cover all 104 matches with realistic structure
- Group tiebreaker logic MUST be implemented as a pure utility function in `client/src/utils/standings.js`
- Admin password MUST only be verified server-side — never hardcoded in client bundle
