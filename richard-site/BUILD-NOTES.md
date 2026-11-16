# Richard Morton website starter

## Status
- Starter design committed 16 November 2026.
- Source: `site-publisher/files/Richard/index.html`
- Publishing manifest: `site-publisher/manifest.json`, revision 118, path `Richard/index.html`.
- Target preview: `https://rockcentralpromotions.com/Richard/` (case-sensitive).
- This is a **draft preview**, not an approved public launch. Site uses `noindex, nofollow` and a preview banner. Do not remove those before Richard approves the content, images, videos and contact information.
- GitHub commit for initial page: `4b325332c0dea069e7485916b1d92cea03108d98`. Manifest commit: `b3e4da58bcd1f45c1d21663d834c29e416eea342`.

## Portability and isolation
- The website is currently **one completely self-contained HTML file**, including all CSS, decorative artwork, a small navigation script and its own fallback fonts. It uses **no** shared RockCentral assets, styles, scripts, framework, data feeds or CDN fonts.
- All internal navigation uses local hash links, so the same file works if moved to a different directory, domain or host.
- External hyperlinks point only to third-party informational resources, not to dependencies required to render the site.
- Future images, audio, videos, downloads and any separate CSS/JS should go **inside `Richard/`**. Do not put Richard's files in shared `/assets/` or reference Kevin's/Anthony's files.
- To move: copy the `Richard` folder as one unit to a new document root. Replace the draft's `noindex` setting and insert domain-specific canonical/OG URLs once a final domain is known. No absolute internal paths need changing.
- When updating via the current publisher, update the corresponding SHA-256 entry in the publishing manifest and increment its revision. Do not modify any existing site's file entries.

## Design intention
- Deliberately different from Anthony's and Kevin's conventional dark comedy layouts.
- Mid-century record sleeve meets theatre poster: warm cream paper, red-orange, mustard, ink-blue, large editorial serif typography, CSS vinyl graphics and expansive type-led composition.
- No unlicensed artist photography, external hotlinks, false video embeds or fabricated ticket dates.

## Pending Richard's input
1. Approved portrait / gig photos, with photographer credits and permission to publish.
2. Exact official YouTube channel URL and the clips Richard wants featured. Search results have not established a reliable official channel link.
3. Any official Bandcamp page, streaming or album purchase links. Do not infer a Bandcamp profile from the existence of The Rich Morton Sound.
4. Preferred booking and press email or agency contact. No dummy form or invented email is published.
5. Verified upcoming public dates and ticket URLs.
6. Approved biography wording, quotes, tone, music emphasis and any downloadable electronic press kit.

## Initial research used for the draft
- Richard's ComedyCV: https://www.comedycv.co.uk/richardmorton/
- Wikipedia: https://en.wikipedia.org/wiki/Richard_Morton_(comedian)
- British Comedy Guide: https://www.comedy.co.uk/people/richard_morton/
- The Divine Comedians interview (June 2025): https://shows.acast.com/divinecomedianspodcast/episodes/divine-comedians-podcast-episode-59-richard-morton
- Agent/venue biographies also confirm historic career credits. Those pages are not a substitute for Richard's sign-off.

## Verification
- Site file created and manifest entry committed to GitHub.
- The exact live publisher process and hosting output were not independently verified in this build session; the preview URL should not be presented as confirmed live until checked directly or via StackCP.
