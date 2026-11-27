# Kevin Daniel website and gig-feed operations

Last reviewed: 23 November 2026. This document is an operational handover, not a claim that every historical deployment has been retested.

## Ownership and deployment

- Staging/concept website: https://rockcentralpromotions.com/kevin/ . This is the **only Kevin website path we control**. Kevin has not approved it as his main public-facing website. Do not edit kevindanielcomedy.co.uk.
- Repository: `rockcentral/rockcentral-data`, branch `main`.
- Website source path: `site-publisher/files/kevin/index.html`; manifest/deployed path: `kevin/index.html`. Confirmed by Git commit `1bb2d33de1bc2e70cf073bea56b657e992c10ac4` and the publisher manifest.
- Publisher manifest: `site-publisher/manifest.json`; its entries map deployed paths (including `kevin/index.html`) to SHA-256 checksums. The manifest was at revision 130 when inspected 23 November 2026. Updating source alone is **not** equivalent to publishing. Follow the existing publisher workflow, update checksum and manifest revision consistently, and verify the resulting deployment. Never modify other site paths accidentally.
- Existing Kevin gig-sync source and older setup documentation: `kevin-site/calendar-sync/`. These older docs describe prototype phases and are **historical**; see current automation below.
- Site inspected in live browser 23 November: footer `Version 0.3.34, concept pending Kevin's approval`. Six upcoming dates visible before expanding `SHOW ALL DATES`. Browser inspection could not determine whether the gig data is server-rendered or fetched; **do not infer that the feed is hardcoded** merely because no client-side Sheets request appeared.

## Gig data sources

Private working register:
https://docs.google.com/spreadsheets/d/1Dr89sbwDhBmb0FozJ4H7hj-Pvs2sWlI1IScSP2wvSao/edit
Tab `Gig Register`, sheetId `1254597404`, 31 columns A:AE.
Other tabs: `Calendar Sync Review` (sheetId `1966429600`) and `Guide`.

Public-only feed:
https://docs.google.com/spreadsheets/d/1uVWnOkFFD3JYiJXc74KCIfW2Kl7OFV88mrKwsH35qSk/edit
Tab `Public Gigs`. A1 uses `QUERY(IMPORTRANGE(...))` to select explicitly published rows from the private register. **Do not edit the public feed manually.** Its seven output fields, in order: performance date, performance time, public show title, public venue, public location, ticket link, ticket status.

Calendar: `Kevin Daniel Gigs & Availability`
ID: `045f8e76bf0e26a6741344d8173f4c97e0d278ac8776d05a62f952a7964d89fe@group.calendar.google.com`.

Daily ChatGPT automation: `Kevin Gig Register Sync`, ID `Automation_5c55f3ddd764819198fb7713848c3b91`, scheduled daily around 08:00 London time. This is a **ChatGPT automation**, separate from the older Apps Script prototypes. Its prompt was strengthened 23 November to use header-name mapping, all 31 columns including empty placeholders, validation and read-back checks, no invented fees, no automatic publication, and rejection of malformed rows. A manual import was tested; unattended next-run reliability still needs verification.

## Private register columns (exact order)

A Gig Number; B Day of Week; C Date; D Venue; E Town; F Postcode; G Miles travelled to gig and back; H Promoter; I MC/Open/Middle/Close; J Time; K Fee Agreed; L Payment Cash/Invoice; M Invoice Number; N date Invoice sent; O date invoice paid; P listed on my website; Q Ticket Link; R Public Show Title; S Public Venue; T Public Location; U Performance Date; V Performance Time; W Ticket Status; X Publish?; Y Review Status; Z Calendar Event ID; AA Performance Key; AB Calendar Last Synced; AC Ticket Source; AD Ticket Link Verified; AE Public Notes.

Valid W statuses: `Info soon`, `On sale`, `Sold out`, `Cancelled`.
Valid X: `No`, `Yes`.
Valid Y: `Needs review`, `Ready`, `Verify ticket link`, `Cancelled`.
Valid AD: `No`, `Yes`.
Keep internal notes, fees and correspondence out of the public feed.

## Verified changes and audit, 20–23 November 2026

- Repaired shifted Glasgow row 39 for 27 March 2027, RoboScot, calendar event `g6hf6j0e21ruf5en629etksko0`. Column Q blank; R RoboScot; S The Griffin, 266 Bath Street, Glasgow G2 4JP; T Glasgow; U 2027-03-27; W Info soon; X No; Y Needs review; Z event ID; AA `g6hf6j0e21ruf5en629etksko0|2027-03-27|single`; AB 2026-11-20; AD No. Read-back verified.
- Imported row 40, 19 December 2026, Cerys Nelmes closing spot, Frampton Cotterell; calendar ID `2mdk61rlmcqh7erce1fouhl4rc`; performance key `2mdk61rlmcqh7erce1fouhl4rc|2026-12-19|single`. Initially `Publish? No`, `Needs review`; Anthony later **manually changed Publish? to Yes** and confirmed it appeared on the staging site. Do not silently revert that approval. Its time and ticket link remain unknown.
- Imported row 41, 20 March 2027, Ian Hayes opener, Wittering; ID `ctht79tislcp8dhg184oo50o2o`; unpublished, Needs review. Calendar text expresses interest in the spot but does not conclusively establish acceptance. No fee or time invented.
- Imported row 42, 24 November 2027, Ashley Frieze closing spot, Ledbury; ID `0qla65edeurnr0bpj8pebal4k8`; unpublished, Needs review. Public listing research suggested Prince of Wales, Church Lane, Ledbury HR8 1DL, 19:00, but Kevin is not named in the public line-up. The venue/time should be independently rechecked before approval. No fee invented.
- On 23 November, added official event-specific ticket link for 18 December 2026 Just the Tonic at NG-One, Nottingham: https://www.justthetonic.com/nottingham-comedy/shows/friday-18-dec-2026/7501/ . The organiser's page explicitly names Kevin, doors 18:45, show 20:00. Updated row 12 Q, Y to Ready, AC source, AD Yes, AE notes; read-back verified.
- The cancelled 12 December 2026 Chesterfield booking is marked `Publish? No` and absent from the public feed. Do not re-publish.
- 5 December 2026 Nottingham Just the Tonic **early and late shows are deliberately two distinct performance rows**, sharing one calendar event ID but having different performance keys and times.
- Final 23 November audit: 41 private register entries; 29 `Publish? Yes` rows; 29 public feed rows; exact seven-field match for all 29; zero unmatched rows; zero duplicate performance keys; zero malformed event-ID/performance-key prefixes. 12 published listings lack ticket URLs; 10 published listings lack start times. Some are legitimate advance announcements; do not invent values or automatically unpublish.
- The website browser inspection showed initial six upcoming gigs, 26 November through 3 December, with `SHOW ALL DATES` expansion. Anthony personally verified 19 December appears on staging after publishing it. That is evidence of end-to-end propagation, but not a full independent DOM comparison of all 29 dates.

## Safety and publishing rules

1. Calendar events and all-day dates are not definitive proof of booking acceptance or performance time. Never infer start times from midnight calendar timestamps.
2. Match by calendar event ID plus date plus performance variant; one event may cover multiple nights or early/late shows.
3. Preserve manually edited public titles, ticket links, publication choices, fees and review decisions. Do not auto-publish new imports.
4. Use explicit blank cells in 31-column writes. Before each edit, read current cells and validation, write the smallest safe range, then read back. Do not overwrite neighbouring rows.
5. Research ticket URLs on official promoter/venue event pages; mark verified only when the link is show-specific and the relevant event is confirmed. A generic venue website is not a verified booking link.
6. The test site is not advertised to Kevin's audience, but it is accessible without login. Treat it as staging, not private storage.
7. Website changes must be scoped to `kevin/index.html` and its necessary Kevin-only assets, then deployed using the existing manifest and publisher workflow. Never modify the main RockCentral website or Kevin's current website as a side effect.

## Website improvement backlog (NOT IMPLEMENTED as of 23 November)

- Gig cards: clear date, venue, location, time; sensible fallback text for missing values.
- Ticket actions only when a verified usable booking URL exists; avoid dead links.
- Upcoming dates exclude past gigs automatically; handle cancellations appropriately; optional past-gigs archive.
- Mobile scanability, tap targets and expanded dates.
- Empty upcoming-gigs state.
- Feed failure fallback using last successful data or explicit error; do not show an apparently empty list on fetch failure.
- Small diagnostics/last-updated indicator; avoid exposing private feed details.
- Test all 29 public rows against the expanded staging page and verify no cancelled/unpublished rows appear.

## Next operator checklist

1. Read this document and the existing publisher files **before** editing.
2. Inspect `kevin/index.html` and `site-publisher/manifest.json` in GitHub, not guessed paths.
3. Review the current private/public sheet values and automation run before claiming sync status.
4. Implement the backlog with small isolated changes, update manifest/checksum and deploy using the known publisher procedure.
5. Verify live staging URL on desktop/mobile and compare all approved rows, not only the first six.
6. Commit updated documentation with each future significant change, noting what was actually deployed versus merely proposed.

No website code was changed on 23 November as part of the improvement request; this document records the handover and verified spreadsheet work.

## 23 November 2026 EPK build and publisher fix

- Resolved source/deployment path confusion: **GitHub source** is `site-publisher/files/kevin/index.html`, whereas **deployed path** and manifest entry are `kevin/index.html`. The earlier handover's statement that the repository source was `kevin/index.html` was incorrect. Do not repeat that mistake.
- Created `site-publisher/files/kevin/epk/index.html`, commit `4eab800285c413f5fbce28298f19da09c0299533`.
- Registered `kevin/epk/index.html` in `site-publisher/manifest.json`, revision 131, SHA-256 `21e78d5260d22e8ff1d5bfecd940e4e954987b5779ceb9f99eeafb694d15f0a8`, commit `bdc79a61b8b6ff70970d3e2438a6afc2b9ed9fda`.
- Intended staging URL: https://rockcentralpromotions.com/kevin/epk/ . Initial immediate fetch returned HTTP 404, likely because scheduled publishing had not run yet. **Do not claim deployed or verified until URL returns 200 and content is checked.**
- EPK has short/full biography with copy buttons, selected historical credits, sourced-on-existing-site promoter quotes, official YouTube channel link, existing press-resource link and email booking contact. It is a standalone page; the main `/kevin/` navigation has **not** been edited to add an EPK link.
- No full-resolution original press assets were recovered; do not label website photos as high-resolution downloads. EPK uses existing press link until approved files are obtained.
- Next: verify publisher run and live EPK, test copy controls and mobile layout, then add a discreet link from the main Kevin navigation after safely reading the full existing HTML. The GitHub connector `fetch_file` returned an empty string for the large main `site-publisher/files/kevin/index.html` file on 23 November; do not overwrite it with an empty or reconstructed file.

## EPK visual correction, 23 November 2026

- The earlier browser inspection incorrectly identified Poppins/Acme. The authoritative main-site HTML was recovered through GitHub `fetch_blob` using blob SHA `52391a0a4da39105d19498eb63fbf920ffbb2489`. It explicitly loads **Jost 700/800/900, League Spartan 600/700/800/900 and Montserrat 400/500/600/700/800**. The body uses Montserrat; the logo and hero name use Jost with League Spartan fallback; headings use League Spartan. **Never infer fonts from a visual browser summary.**
- Main homepage final CSS uses background `#08090b`, warm yellow accent `#e0c13a`, white wordmark and a mobile `Menu` toggle, not a wrapped horizontal navigation. The homepage features a black-and-white Kevin portrait. See source rather than using an older CSS definition because the main file has several later overrides.
- EPK `v0.1.6`, manifest revision **136**: removed Poppins, loaded correct three families, aligned colours, made both header logo words white, and added mobile Menu toggle. Source commit `3a75b0f0fe40ce2238e895c8d92af98825503f21`, manifest commit `ca1169b7eaf6d41b9570ffb014c22fe442251de5`. **Live deployment and visual parity remain to be verified**; EPK still lacks homepage's prominent photograph and full layout consistency.

## 23 November 2026: consolidate press kit and remove stray punctuation

- Read the actual 1 MB main page source with GitHub `fetch_blob` (the ordinary `fetch_file` tool returns empty content for large blobs); do not recreate the homepage from scratch.
- Main site `site-publisher/files/kevin/index.html` updated to **v0.3.35**: replaced the duplicated `<section id="press">` downloads, press ZIP and individual-file lists with a short description and a **View Kevin's press kit** button linking to `/kevin/epk/`. Changed main nav Press Kit link from `#press` to `/kevin/epk/`. Other sections and embedded image assets retained. Source commit `1dbef76aec9f625061f98e039939ad854adce65c`.
- EPK `site-publisher/files/kevin/epk/index.html` updated to **v0.1.8**: removed stray full stop in header wordmark, now `KEVIN DANIEL` rather than `KEVIN DANIEL.`. Source commit `604784c58eba103e337874888be2420579286c1d`.
- Publisher manifest **revision 138**, commit `4c766a3553752a33c73c7eceb9e70c9b53c5c1af`. SHA-256 main `8917e9da489c11834338bd89ac24c7ed09e119a9500521bac9ea3b2e885815d2`, EPK `cca4ee4b978ca01771e33bd98e5431ae1f6226acecba7323b18794e56082788a`.
- Live publication and mobile review **not yet verified** at commit time. Check visible footer versions and press CTA after publisher runs.

## 27 November 2026: approved testimonial replacements and verified live deployment

- Kevin's message **New pics to go with quotes**, 24 November 2026, supplied five replacement JPEGs named by promoter. The image-to-testimonial mappings are: BUZZ.jpg to `kevin/assets/testimonial-buzz.jpg`; gifted melon.jpg to `testimonial-gifted-melon.jpg`; shaft of wit.jpg to `testimonial-shaft-of-wit.jpg`; Chuckl.jpg to `testimonial-chuckl.jpg`; harvey hawkins.jpg to `testimonial-final.jpg`. Quotes and attribution text were retained.
- GitHub homepage `site-publisher/files/kevin/index.html` changed from v0.3.37 to **v0.3.38**, with matching photo alt text, a portrait image positioning rule for the Gifted Melon photo, and versioned references to avoid old browser caches. Five JPEG binaries were replaced as standalone assets; no Base64 data was embedded.
- Manifest moved from revision **140 to 141** with SHA-256 hashes for all five JPEGs and the homepage. Commit **`156923fb866524be37367a385e49ee257e2223fe`** includes the seven changes, and changed paths were confined to Kevin and the manifest.
- Live publisher had been **stuck at revision 139 since 25 November** because `publisher.php` allowed raster files under `assets/` and `learning/assets/`, but not `kevin/assets/`. Its scheduled log reported `Unsupported file type or destination: kevin/assets/hero-mobile.webp` every minute. This was a validation allowlist problem, not proof that GitHub writes failed.
- The live server publisher was modified on 27 November **only to add `kevin/assets/` to the existing image destination allowlist**. Existing extension whitelist, basename checks, path/traversal checks, MIME checks and image size limits remained intact. Before activation, verified original SHA-256 `a7027c6deb036be7fc0ba0bee8b8c8e90a234145f4f025a59a5a802b9d850a11` and candidate SHA-256 `53601bcd00e32c8ee96e2ecec2bb81b0f530add52f2a8c339db4a96b72ff6178`; PHP syntax passed; an original copy was retained privately as `.publisher-before-kevin-image-allowlist-20261127.php.bak`. Deployment was an atomic rename.
- The publisher then reported **revision 141 deployed at 2026-11-27T19:03:11Z**, with **8 changed and 46 unchanged**. On public staging, the homepage returned HTTP 200 and v0.3.38. Each of the five JPEG URLs returned HTTP 200 and matched the original email attachment SHA-256. The desktop screenshot displayed the new Buzz image with its correct quote. A true mobile CDP viewport of 390 px returned `innerWidth=390`, `clientWidth=390`, `scrollWidth=390`, 5 carousel slides, and a loaded first image; its screenshot showed no horizontal clipping.
- Only the RockCentral-hosted Kevin staging path was deployed. No changes were made to `kevindanielcomedy.co.uk`, the private gig register, or the main RockCentral homepage. Kevin's broader site/design approval remains pending.
