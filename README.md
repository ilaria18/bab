# Body Language for Athletes (BAB)

A mobile-first web app (installable PWA) that helps athletes notice and name what their body is telling them. Pick a word for a sensation, mark where you feel it, rate how strong it is, add a note — then look back at your history in a calendar and watch your character reflect how you feel.

Everything is stored locally in the browser (`localStorage`). There is no backend and no account.

The only thing that leaves the device is an anonymous page-view ping (via [Vercel Web Analytics](https://vercel.com/docs/analytics)), used solely to count how many people use the app. It carries no identifiers and no check-in data.

If `VITE_USAGE_ENDPOINT` is set and the athlete has agreed (`setUsageConsent(true)`), the app also sends one anonymous row per visit — day, minutes open and a few yes/no flags such as "first visit today" — to `api/usage.ts`, which stores it in Postgres. There is no user or device id; daily and weekly active users, time spent and week-by-week retention are computed by counting the flags (`analytics/metrics.sql`). Nothing the athlete records is ever included. See `src/features/usage-stats/usageStats.ts`.

## What's inside

| Screen | Route | What it does |
| --- | --- | --- |
| Check-in | `/` | Home screen with the daily entry point |
| Words | `/words` | Field of body-sensation words to choose from |
| Check-in flow | `/words/:wordId/check-in` | Steps: body location → intensity → notes → summary |
| Calendar | `/calendar` | Browse past days, open, edit or add entries |
| World | `/world` | Your avatar: body colour, accessories, hats |
| Settings | `/settings` | Theme, language, install prompt |

## Getting started

Requires Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Type-check and build to `dist/` (fails on untranslated UI strings) |
| `npm run preview` | Serve the production build locally (http://localhost:4173) |
| `npm test` | Run the tests once (Vitest) |
| `npm run test:watch` | Run the tests in watch mode |
| `npm run lint` | Lint with Oxlint |
| `npm run i18n:extract` | Extract UI strings into the `.po` catalogs |
| `npm run i18n:compile` | Compile the catalogs |

The service worker is registered only in production builds, so to try offline mode or "Add to Home Screen", use `npm run build && npm run preview`.

## Tech stack

React 19, TypeScript, Vite, React Router, [Lingui](https://lingui.dev) for translations, date-fns and react-day-picker for the calendar, Vitest + Testing Library for tests. Deployed on Vercel (`vercel.json` rewrites all routes to `index.html`).

## Project structure

```
src/
  entities/   Data models and storage (check-in, avatar, daily-log, user-profile, word)
  features/   Screens and feature logic (check-in-flow, calendar, avatar, settings, ...)
  shared/     Reusable UI, layout and helpers
  i18n/       Translations and language setup
  styles/     Design tokens
  routes/     Route paths
public/       PWA manifest, service worker, icons
```

`@/` is an alias for `src/`. Storage sits behind repository interfaces (e.g. `checkInRepository`), so a real backend can replace `localStorage` without touching the UI.

## Localization

English and Italian are available; the language can be changed in Settings.

- **UI strings** (buttons, headings, `aria-label`s) go through Lingui: `<Trans>`, `t` from `useLingui()`, and `msg` for module-level constants. Catalogs live in `src/i18n/locales/<code>/messages.po`. Run `npm run i18n:extract` after changing any string.
- **Domain content** (words, pain scale, body zones, error screen) lives in typed catalogs in `src/i18n/locales/<code>/*.ts`. They are typed by `Messages`, so a missing translation is a compile error. Read them with `useContent()`.

`npm run build` fails if any language has untranslated UI strings; `npm run dev` and the tests fall back to English.

`LANGUAGE_SELECTION_ENABLED` in `src/i18n/locales/index.ts` switches the language picker and browser-language detection on or off. To force a language while testing, run `localStorage.setItem('locale', 'it')` in the browser console and reload.

### Adding a language

1. Add the code to `locales` in `lingui.config.ts`, run `npm run i18n:extract`, and translate the new `messages.po`.
2. Add `src/i18n/locales/<code>/` providing `Messages` (copy `en/` as a starting point).
3. Register it in `src/i18n/locales/index.ts` (`LOCALES`, `LOCALE_NAMES`) and `src/i18n/dateLocale.ts` (a `date-fns` locale for the calendar).
4. Check that the two CSS rules that title-case English labels (`:root:lang(en)`) still suit the language.
