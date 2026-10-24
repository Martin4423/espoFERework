# ViaCRM Frontend 2.0.0

This EspoCRM extension installs the React frontend and its API bridge in one uploadable archive.

## Install or upgrade

1. Build `packages/ViaCRM-Frontend-2.0.41.zip` with `./scripts/package-frontend-extension.sh`.
2. In EspoCRM, open **Administration → Extensions**, upload the ZIP and click **Install**.
3. Open the frontend at `/client/custom/viacrm/` on the same site origin as EspoCRM.

Upgrades are installed by uploading the new extension ZIP without uninstalling the existing version. The package includes the public workflow and account-session endpoints previously distributed by ViaCRM Frontend Bridge.

## Web server routing

The app and `/api` must share the same HTTPS origin so login cookies, API requests, uploads and generated public form links work correctly. The extension installs the static client files under EspoCRM's public `client` directory and provides an Apache rewrite fallback for routes below `/client/custom/viacrm/`.

For Nginx or another server that does not read `.htaccess`, add an equivalent SPA fallback for `/client/custom/viacrm/` that serves the installed `index.html` for client-side routes while serving existing assets directly. To make the app replace the CRM root URL and to route EspoCRM-generated public entry-point URLs through React, configure the site's reverse proxy to serve the frontend bundle at `/` and proxy `/api/` and `/client/` to EspoCRM. The workspace Docker gateway demonstrates this root-mounted mode.

The existing native EspoCRM app remains available at the backend origin for administration and recovery. The React client is installed separately under `/client/custom/viacrm/`; this package does not overwrite EspoCRM's core `index.php` or native client files.
