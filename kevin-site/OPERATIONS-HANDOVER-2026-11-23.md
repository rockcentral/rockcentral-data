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
