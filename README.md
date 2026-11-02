# Till Mate (web)

A till assistant for counting change, taking payments and practising change-making.
Plain HTML, CSS and JavaScript, with no build step. Works offline once loaded.

## Files

- `index.html`: the page shell
- `css/style.css`: styles, including dark mode
- `js/app.js`: screens, state and events
- `js/money.js`, `js/currency.js`, `js/rounds.js`, `js/stats.js`, `js/storage.js`: logic
- `sw.js`: service worker for offline use
- `manifest.webmanifest`: app name, colours and icons for installing

## Put it on GitHub Pages

1. Create a new repository on github.com, for example `tillmate`. Make it public, or use a paid plan for a private Pages site.
2. Upload the contents of this folder to the repository root, so `index.html` sits at the top level. The easiest way is **Add file > Upload files** on the repository page, then **Commit changes**.
3. Go to **Settings > Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and the `/ (root)` folder, then save.
4. After a minute or two, the site is live at `https://YOURNAME.github.io/tillmate/`.

## Install on a phone

- **iPhone:** open the link in Safari, tap Share, then **Add to Home Screen**.
- **Android:** open the link in Chrome, tap the menu, then **Install app** or **Add to Home screen**.

## Testing locally

Service workers need HTTPS or localhost. From the folder, run:

    python3 -m http.server 8000

then open http://localhost:8000.

## Updating

Edit the files, upload them again, and bump `CACHE_NAME` in `sw.js` (for example `till-mate-v2`). Without the bump, phones keep the cached old version.

## Notes

- Progress and the menu live in the browser's local storage. They don't move between phone and computer, and clearing site data deletes them.
- Safari on iPhone can clear website data for home-screen apps that haven't been opened for a while. If that matters, an export and import of progress and the menu can be added.

## Backing up the menu

In **Settings**, tap **Export menu** to save the menu as a `.json` file. On iPhone, choose **Save to Files**.
To restore or move it, tap **Import menu** and choose the file. Items with the same name are updated rather than duplicated.
