# Kevin Daniel website build notes

Status: staging concept v0.1 committed to `site-publisher/files/kevin/index.html` and referenced by manifest revision 70.
Staging URL: https://rockcentralpromotions.com/kevin/
Destination domain: https://kevindaniel.co.uk/ (not live yet).

## Non-negotiable requirements
- Kevin retains a dark theme with his own voice and visual identity.
- Easy gig rows with dates, venues, times and immediately visible ticket links.
- Keep the existing electronic press ZIP; add individual file downloads from the same approved master set.
- Kevin can update gig data and page content without ChatGPT.
- All deployed Kevin files must stay within `public_html/kevin/`, including `kevin/assets`, `kevin/press` and any CMS output. Never deploy them into shared `/assets`.
- Work must not disturb the RockCentral site, its ticket checkout or other existing deployments.

## Staging v0.1
- Self-contained accessible HTML/CSS/JS, mobile menu, dark theme, responsive gig cards, past-date filtering, show-all toggle, a biography, approved sourced testimonial excerpts, contact link.
- Two direct ticket destinations verified on Kevin's old site; remaining booking buttons transparently labelled "Booking info" rather than falsely claiming a direct ticket URL.
- Press section links to existing old-site press pack; short and full plain-text biographies download in-browser.
- No image or PDF files have been imported; no new ZIP has been published.
- **Dates are a one-time snapshot, not a live sheet feed.** Replace before production.
- Staging page carries robots noindex and a visible preview banner. Quotes, photographs and proposed copy require Kevin's approval.

## Spreadsheet requirements
Suggested columns: Date (YYYY-MM-DD), Start Time (24-hour HH:MM), Show, Venue, Town, Ticket URL, Ticket Status (On sale / Info soon / Sold out), Type (Club / Solo / Festival), Public (Y/N), Notes.
Use Kevin's own published CSV, not Anthony's. Follow proven CSV parser/date logic in `site-publisher/files/anthony/index.html`.
Validate URLs to https/http, escape text, hide past gigs, order upcoming by date/time. Show "Book tickets" only if a direct verified ticket URL is present. Fallback to explanatory status, never a fake ticket link.

## Publishing architecture
Current `site-publisher/manifest.json` schema is 1 with paths and sha256 checksums. Manifest revision 70 contains 42 files and adds only `kevin/index.html`.
A previously saved publisher.php v1.0 only allows .html, while live manifest includes images at shared assets paths. **Inspect exact live publisher.php in StackCP before changing path validation.** Do not globally allow PHP or untrusted uploads.
Possible options:
1. Separate Kevin-only scheduled publisher configured with root `public_html/kevin` and own manifest/repo. This offers best isolation.
2. Carefully extend shared publisher to allow specific `kevin/assets/**` file types, with path canonicalisation, symlink checks, hashes, atomic replacement, and strict file/size limits.
Prefer option 1 long-term; do not deploy unreviewed PHP through the existing public repository.
Current staging intentionally avoids external asset dependencies and uses only `kevin/index.html`.

## CMS
Prefer a lightweight Git-based editor, such as Pages CMS, after creating Kevin-owned content files and GitHub repo. Keep editing permissions, upload paths and publisher credentials limited to Kevin. Avoid inventing a second login system. Alternative: WordPress if Kevin explicitly prefers an established CMS and accepts its maintenance footprint.

## EPK migration
Obtain the existing approved ZIP from Kevin. Inventory contents, image rights and photo credits. Organise under `kevin/assets/press/`. Give each approved item a distinct download button, offer short/long bios and testimonials, and build a ZIP from the same source files. Do not publish unapproved original images or assume the link to his old press page is the ZIP itself.

## Before domain launch
Test mobile/desktop, verify all ticket URLs, connect Kevin's own sheet, update contact, test download links, connect full kit ZIP, audit images/credits and redirects, apply canonical on final domain, set HTTPS, remove noindex only after Kevin approves launch. Check that `kevindanielcomedy.co.uk` redirects correctly, preferably page to page.

## EPK source archive received (9 November 2026)
- Source ZIP: presskit-kevin-daniel-comedy.zip, 1.4MB, SHA-256 `45d43c33f6f5648b661576e1d2cdc8d01f2570fb167a1f2ecab79abe952a894e`.
- Contents: six JPEG originals (DSCF1268-3, DSCF1279-2, DSCF1332-2, DSCF1361-2, DSCF1374-3, DSCF1455-3) and original three-page PDF.
- All photos © Steve Best (https://www.stevebest.com/); photographer attribution is REQUIRED according to Kevin's press PDF. Do not omit credits on public press page.
- PDF includes biography, seven attributed promoter testimonials, contact/social links, and photo-usage note. Creation date February 2025; check details and former-domain URLs before final launch.
- A v0.2 offline deployment package was assembled containing `kevin/press/index.html`, individual photo downloads, lightweight WebP thumbnails, PDF, original unchanged ZIP, short/full editable biographies, photo-credit note and `kevin/content/epk.json`. ZIP link and all local asset paths validated; original source ZIP verified byte-for-byte.
- Package is NOT deployed to hosting and is NOT committed in GitHub because binary asset publishing to nested directories has not yet been configured. Keep staging public press section pointed at existing live archive until binary assets are on-server.
- Preferred EPK hero: DSCF1455-3.jpg (black-and-white smiling portrait); optional home hero: DSCF1332-2.jpg (colour headshot). Final artwork needs Kevin's approval.
