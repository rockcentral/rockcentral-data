# Comedian Site Builder: Richard Morton pilot

Status: first reusable content features implemented 27 November 2026. This is a **pilot**, not a completed multi-tenant platform.

## Principle
Build functional editing components as the Richard site needs them, then reuse the same content model and code for other comedians. No retrofitting a finished static website, and no big generic page-builder project ahead of actual use.

## Existing site
- Staging: https://rockcentralpromotions.com/Richard/ (capital R). Remains noindex and unapproved.
- Home presentation source: `site-publisher/files/Richard/index.html`, deployed through the existing manifest.
- Design: existing dark/near-black and orange identity retained.
- PHP content code is in this directory. Do not add PHP to the public static publisher manifest.

## First working features
1. Single-password editor at `/Richard/studio/`, with session cookies, CSRF, login throttling, private password hash and password change. No self-registration or general membership system.
2. News drafts/publishing with heading/bold/italic/lists/links, a protected image uploader, featured images, and readable permanent article slugs.
3. Public news listing at `/Richard/news/` and article route `/Richard/news/<slug>/`. Published slugs are immutable; drafts are not public.
4. Gig records have date, optional time, venue, town, optional direct ticket URL and draft/published state. The public feed excludes past and draft gigs. No invented times or links.
5. Section visibility saved independently of page design. News and gigs start **off**; existing About, Reviews, Watch and Music start on. Contact/Home are always present. The future timeline toggle is disabled until the timeline is implemented.
6. Homepage reads a small read-only JSON endpoint to render news previews, gigs, and visibility. HTML source stays static; rich text is sanitised server-side using a strict allowlist.

## Site-specific public wrappers
- `admin.php` -> `public_html/Richard/studio/index.php`
- `news.php` -> `public_html/Richard/news/index.php`
- `news.htaccess` -> `public_html/Richard/news/.htaccess`
- `feed.php` -> `public_html/Richard/site-data.php`
- `site-widgets.js` -> `public_html/Richard/site-widgets.js`
- `core.php` -> private `.comedian-builder/core.php` **outside** public_html.
- Per-site SQLite database: private `.comedian-builder/data/richard.sqlite`.
- Credential: private `.comedian-builder/richard-admin.hash`, permissions 0600, **never** committed.
- Uploaded media: `public_html/Richard/media/`. Validated JPEG/PNG/WebP only, up to 4MB and 6000px.

Current publishing is split: the old HTML is delivered by the existing manifest-based publisher, while the CMS PHP/JS endpoints are installed through controlled SSH. A dedicated builder release tool and fuller backups are required before onboarding a second performer. Do not claim the PHP is deployed merely because GitHub has changed.

## Known limitations and guardrails
- Site wrappers and paths are currently Richard-specific. The data layer accepts a site key; configure path/branding and release automation before onboarding a second client.
- Uses a native contenteditable toolbar for the pilot. This is a real editor but needs cross-browser usability acceptance before Richard relies on it. The rich HTML is cleaned again on the server.
- News is hidden from the homepage until explicitly enabled. A published article by itself does not automatically turn the section on.
- No comments, categories, newsletters, complex analytics, design editor or multiple permissions.
- The career timeline is planned as a curated, **image-led series of dated milestones** sourced from Richard's 39-file WeTransfer archive, not an automatic gallery. File names supply candidate dates only; verify original poster text, event/year and rights before publishing. No images from that archive were published in this phase.
- The Rich Morton Sound and The Panic Brothers music content remains a distinct site section. Audio players should use Richard-authorised recordings/embeds, not invented audio.
- Keep the existing placeholder booking contact and noindex status until Richard approves.
- Never overwrite the broader RockCentral site, Kevin's site or Richard's other domain.

## Quality checks
- Source PHP linted against /usr/bin/php84 on StackCP.
- `test.php` exercises the SQLite schema, visibility changes, rich text sanitisation and safe URLs, article slugs and published gig filtering. Test database key: `richardtest`; never seed fake gigs into the production database.
- HTTP GET checks: `/Richard/studio/`, `/Richard/site-data.php`, `/Richard/news/` returned 200; a nonexistent article slug returned 404.
- A real signed-in editing walkthrough and mobile checks still need operator acceptance. Do not claim that login/publishing forms are fully acceptance-tested without it.

## Phase 2: image-led career timeline (27 November 2026)

The previously disabled Timeline control is now an implemented first-class feature. The private Studio has a timeline manager supporting:
- Four-digit year; optional more precise, human-readable date label.
- Title, short story/caption, image with accessible alternative text.
- Sort order for multiple events within a year.
- Private draft and published states. Publishing requires an uploaded, validated local image and image description.
- An image-card preview **within the signed-in Studio**, including drafts.
- A show/hide switch that refuses to enable an empty timeline; hiding the section does not delete existing milestones.

The read-only JSON feed now includes `timeline` only if that section is enabled. The Richard homepage has a responsive vertical visual timeline with decade labels, chronological milestones, photographs and an orange-accented design, hidden by default. It uses DOM text nodes for untrusted captions and limits images to the approved local-media path. No external timeline widgets or dependencies.

The PHP schema adds one independent `timeline` table and index through `CREATE TABLE IF NOT EXISTS`. No changes are made to existing article, gig or audience content. `test-timeline.php` passed on the hosting PHP 8.4 runtime using a separate synthetic test database. Tests cover default visibility, empty-section guard, draft exclusion, chronological/year-internal ordering, preservation on hide and existing gig stability. Source lint and public browser checks should be repeated after deployment. **A signed-in owner walkthrough remains required before Richard uses this independently.**

The 39-item Richard WeTransfer archive was inventoried on RockCentral-2 only. **36 filenames contain a proposed year**; three are undated, five are HEIC and five exceed the current 4 MB uploader limit. A private local `timeline-archive-inventory.csv` and JSON inventory were created under `C:\Users\ant\LearningStudioDev\richard-builder-v1\`. Years are filename-only leads, not verified historical facts. No original images have been published or pushed to GitHub.

The visual component is deliberately Richard-specific for this pilot. Reuse the model/editor, and theme the presentation per comedian as later pilots justify it.
