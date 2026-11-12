# Memory Card Game

A memory (pairs) game built with React 19, TypeScript and Vite. Games are defined either as static
JSON in the repo or created from the built-in admin and stored in Firebase. Each game can have
**any number of pairs**.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run lint       # ESLint
npm run build      # type-check + production build
```

`predev` / `prebuild` run `scripts/sync-ficohsa-assets.mjs`, which scans `public/images/ficohsa`
and `public/logos/ficohsa` and writes `public/games/ficohsa.assets.json`.

## Routes

| Route              | What it is                                              |
| ------------------ | ------------------------------------------------------- |
| `/`                | Ficohsa game (main game)                                |
| `/g/:gameId`       | Play any game by id                                     |
| `/menu`            | List of all games (static + Firebase)                   |
| `/admin`           | Admin: list of Firebase games (Google sign-in required) |
| `/admin/new`       | Create a game                                           |
| `/admin/edit/:id`  | Edit / delete a game                                    |

Admin routes are lazy-loaded, so players never download the admin code.

## Where games come from

1. **Static games**: `public/games/index.json`. Entries with `useFicohsaAssetBundle` get their
   cards/logo from `public/games/ficohsa.assets.json`.
2. **Firebase games**: Firestore collection `games/{id}`. Images live in Firebase Storage under
   `games/{id}/…`; the document only stores download URLs, so the number of pairs is not limited
   by Firestore's 1 MiB document size.

Both are merged by `loadGameRegistry()` (`src/utils/gameUtils.ts`). Static ids win on conflicts.

### Game document shape

```ts
{
  id: string;          // slug: a-z, 0-9, "-"
  title: string;
  logo: string;        // URL, defaults to /images/logo.png
  cards: string[];     // one URL per pair
  theme?: GameThemeOverride;
  maxMoves?: number;   // optional; otherwise 5 moves per pair (gameConfig.json → movesPerPair)
}
```

## Admin

- Sign in with Google; allowed emails are listed in `ADMIN_EMAILS` (`src/firebase.ts`). The real
  enforcement must live in the Firestore/Storage security rules.
- The create/edit form (`src/components/admin/GameForm.tsx`) supports drag-and-drop images,
  reordering, removing, a live theme preview and an optional move limit.
- Images are downscaled in the browser before upload (WebP, or JPEG on browsers that can't
  encode WebP; images with transparency keep their original format).
- When editing, images that are no longer used are removed from Storage after a successful save.

## Project structure

```
src
├── App.tsx                       # Game screen (theme, board, controls, modal)
├── main.tsx                      # Routes
├── gameConfig.json               # Base theme, card size, movesPerPair
├── firebase.ts                   # Firebase init + admin emails
├── hooks
│   ├── useMemoryGame.ts          # Loads a game and runs the reducer (timers, restart)
│   └── useAdminAuth.ts           # Google sign-in state for the admin
├── utils
│   ├── gameReducer.ts            # Pure game state machine (moves, matches, win/loss, timer)
│   ├── gameUtils.ts              # Deck creation, shuffle, board columns, registry loading
│   ├── gamesRemote.ts            # Firestore/Storage CRUD for games
│   ├── gameForm.ts               # Admin form validation + theme mapping
│   ├── cardItems.ts              # Admin image list helpers
│   ├── imageProcessing.ts        # Accepted formats + client-side compression
│   └── async.ts                  # Bounded-concurrency helper for uploads
├── components
│   ├── Card.tsx / GameBoard.tsx / GameControls.tsx / GameOverModal.tsx
│   ├── Menu.tsx / Admin.tsx / CreateGame.tsx / EditGame.tsx
│   └── admin/                    # AdminGate, AdminHeader, GameForm, CardImagesEditor, ThemePreview
└── styles
    ├── game.css                  # Game styles (themed through CSS variables)
    └── admin.css                 # Admin + menu styles (scoped under .adm)
```

## Game rules

- Flip two cards per move. A matching pair stays face up; otherwise both flip back.
- You win by finding every pair before running out of moves. The timer starts on the first flip.

## Tests

Pure logic is covered with Vitest (`src/utils/*.test.ts`): deck creation and shuffle, board
layout, the game reducer, form validation, theme mapping, image list handling and upload
concurrency.
