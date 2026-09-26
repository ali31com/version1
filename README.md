# Welcome to your Convex + React (Vite) app

This is a [Convex](https://convex.dev/) project created with [`npm create convex`](https://www.npmjs.com/package/create-convex).

After the initial setup (<2 minutes) you'll have a working full-stack app using:

- Convex as your backend (database, server logic)
- [React](https://react.dev/) as your frontend (web page interactivity)
- [Vite](https://vitest.dev/) for optimized web hosting
- [Tailwind](https://tailwindcss.com/) for building great looking accessible UI

## Get started

If you just cloned this codebase and didn't use `npm create convex`, run:

```
npm install
npm run dev
```

If you're reading this README on GitHub and want to use this template, run:

```
npm create convex@latest -- -t react-vite
```

## Learn more

To learn more about developing your project with Convex, check out:

- The [Tour of Convex](https://docs.convex.dev/get-started) for a thorough introduction to Convex principles.
- The rest of [Convex docs](https://docs.convex.dev/) to learn about all Convex features.
- [Stack](https://stack.convex.dev/) for in-depth articles on advanced topics.

## Join the community

Join thousands of developers building full-stack apps with Convex:

- Join the [Convex Discord community](https://convex.dev/community) to get help in real-time.
- Follow [Convex on GitHub](https://github.com/get-convex/), star and contribute to the open-source implementation of Convex.

## CodeGem live cataract coding demo

- `npm run dev` — Convex dev deployment + Vite. Presenter workspace at `/`; the QR joins participants at `/join/<code>`, which redirects to a personal URL `/p/<token>`.
- `npm test` — deterministic scenario and Convex state-machine suites (fake model; no network).
- `node scripts/measure.mjs` — live readiness measurement (sends real Gemini requests).
- Environment: `GEMINI_API_KEY` (a paid tier is needed for a 50-person audience) and optional `GEMINI_MODEL` (comma-separated Flash model IDs tried across attempts).

See [docs/START-HERE.md](docs/START-HERE.md) and the [readiness record](docs/research/readiness-measurements.md).
