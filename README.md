# Emily & Hameed Budget Planner

This folder is ready to upload to GitHub Pages. The planner is still hosted by GitHub, but shared budget data now syncs through Firebase Firestore.

## Files

- `index.html` - the budget planner app.
- `firebase-config.js` - paste your Firebase web app config here.
- `DEPLOY.md` - setup steps for GitHub Pages and Firebase.
- `.nojekyll` - keeps GitHub Pages from changing how the site is served.
- `notion-import/` - optional CSV files from the earlier Notion setup.

## Color Palette

- Rose: `#C97B8E`
- Brown: `#A4643F`
- Gold: `#D4A23A`
- Sand: `#D8C9A6`

## Shared Editing

Once Firebase is configured, both Emily and Hameed open the same GitHub Pages link. Changes auto-save to Firebase and update across devices. No GitHub token is needed.

The app still saves locally if Firebase is not configured yet, so it will keep working while setup is in progress.
