# rockcentral-data
Data for rockcentral site

## Kevin Daniel website
Live staging site: https://rockcentralpromotions.com/kevin/

- Homepage source: `site-publisher/files/kevin/index.html` (large file: if contents API returns empty, fetch the Git blob by SHA).
- Press kit: `site-publisher/files/kevin/epk/index.html`.
- Publisher manifest: `site-publisher/manifest.json`. Manifest paths are relative to `site-publisher/files/`, not repository root. Update SHA-256 hashes and increment revision when publishing changed files. Increment visible page versions and verify live pages after publishing.
- Keep all Kevin site changes within `/kevin/`; do not modify his existing external website.

- Store new Kevin images as separate optimised WebP, PNG or JPEG assets in `site-publisher/files/kevin/assets/`, never inline Base64. Include each asset in the publisher manifest.

Prefer WebP for photographs, PNG where lossless detail or transparency is needed, and retain JPEG where appropriate. Never embed image data in HTML.
