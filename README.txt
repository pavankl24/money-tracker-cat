# Money Tracker Cat 🐱

A friendly daily money tracker with a white cat that reacts to how you spend.
Add money in, add money out, set a daily limit, and see the exact date your money will run out.

**Live app:** https://money-tracker-cat.netlify.app

![Dashboard in light mode](docs/dashboard-light.png)

<img src="docs/dashboard-dark-mobile.png" alt="Dashboard in dark mode on a phone" width="320">

## Features

- **Money in and money out** with an optional note and date for every entry
- **Daily limit** with a "Money lasts until" date based on your balance
- **Cat mascot** that changes expression based on your activity (see below)
- **Charts:** a 7-day line chart, a spending donut grouped by note, and a battery-style ring when no notes are added
- **Day-by-day history** showing whether each day ended under or over your limit
- **Money-in-first check:** a warning appears if you try to add money out before adding any money in
- **Undo last** and **Reset** (with a confirmation step) for fixing mistakes
- **Light and dark mode**
- **Installable** on iPhone and Android as a home-screen app, and works offline
- **Private:** all data stays in your own browser

## Meet the cat

| Mood | When it shows |
| --- | --- |
| Happy and purring | You are within today's limit |
| So excited | You just added money in |
| Sleepy | Nothing added yet today |
| A little worried | You used 75% or more of today's limit, or your money lasts 3 days or less |
| Feeling sad | Over today's limit, balance is zero, or balance is below zero |
| Whoa! | You tried to add money out before adding any money in |
| Curious | A brand-new tracker with no money in yet |

## How "Money lasts until" is calculated

```
balance = total money in - total money out
remaining today = max(daily limit - spent today, 0)

if balance <= remaining today:
    lasts until today
else:
    days after today = ceil((balance - remaining today) / daily limit)
    lasts until today + days after today
```

Today's remaining allowance counts as the first day. For example, a balance of ₹5,000 at ₹500 a day with nothing spent today lasts 10 days including today.

## Run it locally

There is no build step and no dependencies. Serve the folder with any static server:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000

Opening `index.html` directly also works, but the service worker and install prompt need `http://localhost` or `https`.

## Install on a phone

- **iPhone (Safari):** Share > Add to Home Screen
- **Android (Chrome):** menu (three dots) > Install app

## Deploy

It is a static site, so any static host works. The live app runs on Netlify:

1. Link this repository in Netlify (**Site configuration > Build & deploy > Link repository**)
2. Leave the build command empty and publish the root folder
3. Every push to `main` updates the site

GitHub Pages also works: **Settings > Pages > Deploy from a branch > main / root**.

## Project structure

```
index.html            the whole app (HTML, CSS and JavaScript)
manifest.webmanifest  app name, colors and icons for installing on phones
sw.js                 service worker for offline use
icons/                app icons (cat face on a purple and green ring)
docs/                 screenshots used in this README
```

## Tech

Plain HTML, CSS and JavaScript. Charts and the cat are hand-written SVG. Data is saved with `localStorage`. The Plus Jakarta Sans font is loaded from Google Fonts and falls back to system fonts offline.

## Privacy

Everything is stored in your browser on your own device. Nothing is sent to a server, and data does not sync between devices. Clearing your browser data removes your entries.

## Ideas for later

- Export and import a backup file
- Categories with icons
- Monthly summary and savings goal
- A name and more outfits for the cat

## License

Add a license of your choice before sharing the code for reuse. [choosealicense.com](https://choosealicense.com) can help you pick one.
