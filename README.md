# Money Tracker Cat 🐱

A daily money tracker with a white cat that reacts to your spending, now built with **React + TypeScript + Vite**.

**Live app:** https://money-tracker-cat.netlify.app

## What's new in v2
- Vertical side menu (with logo and a menu button) on desktop and phones
- App-shell layout that fixes the "whole page shifts when scrolling" problem
- Interactive chart: hover or touch for details, 7/14/30-day range, show or hide lines
- Interactive donut: hover or tap a slice or legend row
- Preferences: **Change limit** and **Save** buttons
- Cat poses by time of day: standing (6am-6pm), sitting (6pm-10pm), sleeping (10pm-6am), and it uses your name
- In-app **Update** banner when a new version is deployed

## Develop
```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # optional type check
npm run build      # outputs to dist/
```

## Deploy (Netlify)
`netlify.toml` already sets the build command (`npm run build`) and publish folder (`dist`).
Push to `main` and Netlify rebuilds the site automatically.

## How users get updates
1. You push a change to GitHub (change `VERSION` in `src/App.tsx` and `version` in `package.json` if you like).
2. Netlify builds and deploys it.
3. The next time someone opens the app (or within an hour if it is already open), an **Update** button appears at the top. One tap loads the new version. No reinstall, and their data is kept.

## Privacy
All data is stored in the browser (`localStorage`) on the user's own device. Nothing is sent to a server.
