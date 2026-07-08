# Deploy With GitHub Pages + Firebase

GitHub Pages hosts the planner. Firebase Firestore stores the shared budget data so Emily and Hameed can see the same edits.

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Click `Add project`.
3. Name it something like `Emily Hameed Budget`.
4. Google Analytics is optional.

## 2. Add A Web App

1. In Firebase, open Project settings.
2. Under `Your apps`, click the web icon `</>`.
3. Register the app.
4. Copy the Firebase config object.
5. Paste those values into `firebase-config.js`.

## 3. Turn On Anonymous Auth

1. In Firebase, open `Authentication`.
2. Click `Get started`.
3. Open `Sign-in method`.
4. Enable `Anonymous`.

## 4. Create Firestore Database

1. In Firebase, open `Firestore Database`.
2. Click `Create database`.
3. Start in production mode.
4. Choose a location.

## 5. Firestore Rules

For easiest household-only setup, use anonymous auth rules:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /budgets/emily-hameed {
      allow read, write: if request.auth != null;
    }
  }
}
```

These rules allow anyone who opens the app to sign in anonymously and read/write that one budget document. Keep the GitHub Pages link private-ish: share it with Hameed, not publicly.

## 6. Upload To GitHub

Upload the contents of this folder, not the folder itself:

- `index.html`
- `firebase-config.js`
- `README.md`
- `DEPLOY.md`
- `.nojekyll`
- `.gitignore`
- `notion-import/`

## 7. Turn On GitHub Pages

In the GitHub repo:

1. Open `Settings`.
2. Open `Pages`.
3. Under `Build and deployment`, choose `Deploy from a branch`.
4. Choose branch `main`.
5. Choose folder `/root`.
6. Click `Save`.

GitHub will give you a link like:

`https://your-username.github.io/emily-hameed-budget-planner/`

## 8. Use It

Open the GitHub Pages link. The header status will say whether it is synced with Firebase or only saved on this device.
