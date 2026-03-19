# Bluehost Deep Link Setup

Use these files from this folder:

- `.well-known/apple-app-site-association`
- `.well-known/assetlinks.json`
- `.htaccess`

Upload destination on Bluehost (for `pikup-app.com`):

- `public_html/.well-known/apple-app-site-association`
- `public_html/.well-known/assetlinks.json`
- merge `.htaccess` rules into `public_html/.htaccess` (top of file, before WordPress rewrites)

Important:

- `assetlinks.json` already includes your Android release SHA-256 fingerprint.
- `apple-app-site-association` must have **no extension** and be served as JSON.

Validation:

```bash
curl -I https://pikup-app.com/.well-known/apple-app-site-association
curl -I https://pikup-app.com/.well-known/assetlinks.json
curl -I https://pikup-app.com/invite/TESTCODE
curl -I https://pikup-app.com/reset-password
```

Expected:

- first two are `200` and `Content-Type: application/json`
- invite/reset are no longer WordPress 404
