# bdnix — Coming Soon

Professional services — launching soon.

This repository contains a small, static "coming soon" site built for deployment to GitHub Pages (or any static host).

## Quick Start

Preview locally:

```bash
cd /workspaces/bdnix
python3 -m http.server 8000
# Open http://localhost:8000 in your browser
```

## Configure

- Set the launch date in `index.html` by editing `window.LAUNCH_DATE`.
- To enable real signups, set `window.FORM_ENDPOINT` in `index.html` to your Formspree (or other) endpoint.
- Contact email is set to `root@bdnix.com` (see `_config.yml` and the site footer).

## Files of note

- [index.html](index.html) — main page (logo, countdown, signup)
- [assets/css/style.css](assets/css/style.css) — styles
- [assets/js/main.js](assets/js/main.js) — countdown + signup handling (supports `window.FORM_ENDPOINT`)
- [assets/img/favicon.svg](assets/img/favicon.svg) — favicon

## Deploy

Push to the `master` branch and enable GitHub Pages in the repository settings, or deploy the folder to any static host.

## Contact

Email: root@bdnix.com

## License

This project contains minimal assets for a coming-soon site. Use and adapt as you like.
