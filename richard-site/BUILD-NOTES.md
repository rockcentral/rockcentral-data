# Richard Morton site: build and publishing notes

## Current status (16 November 2026)
- **Preview version:** redesigned, portrait-led site. Repository path: `site-publisher/files/Richard/index.html`.
- Manifest: `site-publisher/manifest.json`, **revision 124**.
- Intended hosting path: `https://rockcentralpromotions.com/Richard/` (capital R).
- GitHub contains the site, portrait and the three previously supplied album cover images. The live publisher and hosted output have not been independently verified in this build session.
- The page retains robots `noindex, nofollow` pending Richard's approval. Footer says Website preview.

## Direction
This replaces an earlier coloured retro record-sleeve concept, which Anthony rejected because it resembled other previous designs. The new site draws on the direct, image-led layouts of Milton Jones and Michael McIntyre without copying their visual branding. It uses clean white and near-black, a restrained blue accent inspired by Richard's stage suit, a single sans-serif system font, no decorative section eyebrow labels, no textures, and no gratuitous animation.

Design priority order:
1. Establish who Richard is with a recognisable image and simple introductory description.
2. Demonstrate credibility through an award, Comedy Store credits, verified press quotations, video link and career history.
3. Display public gig dates and verified booking links as Richard supplies them.
4. Provide a clear, usable booking contact.

## Source files, independence and portability
- HTML, CSS and mobile navigation JavaScript are in the one `Richard/index.html` file.
- All images are under `Richard/assets/`. No files are loaded from `/assets/`, Kevin, Anthony, any fonts CDN or website framework.
- All local paths are relative. Copy the entire `Richard` folder to another document root or domain to move it.
- Files currently referenced:
  - `Richard/assets/richard-live-blue.webp` (supplied image of Richard performing in a blue suit; optimised low-resolution temporary copy for layout testing, approx. 420×280).
  - `Richard/assets/richard-portrait.webp` (temporary **low-resolution** optimised copy of user-supplied 31750.jpg, approximately 218×340; suitable for layout review, **replace with a high-resolution local copy before launch**).
  - `Richard/assets/panic-brothers.webp`
  - `Richard/assets/theme-that-never-was.webp`
  - `Richard/assets/sequel-that-never-was.webp`
- Do not move new assets outside the Richard folder.
- A new asset requires its own SHA-256 entry in the publisher manifest. Each HTML update requires updating its checksum. Increment manifest revision with every publish.

## Approved / supported material (still request Richard's review)
- Winner of 1992 Time Out Comedy Award.
- Founding member of Comedy Store's Cutting Edge.
- TV credits include Never Mind the Buzzcocks; BBC Radio 4 work.
- Historic tour support for Jack Dee, Lee Evans, Jo Brand, Lily Savage and Phill Jupitus.
- Press quotations (three) attributed to The Daily Express, The Sunday Times and The Guardian. These match multiple published booking profiles; see https://manfordscomedyclub.com/comedians/richard-morton/ and https://thecomedyclub.co.uk/comedians/richard-morton.
- Richard's YouTube channel provided by Anthony: https://www.youtube.com/@richardmorton3519.
- No individual videos embedded until selection and approval. Media uses a link to his channel rather than an empty player.
- The Panic Brothers and The Rich Morton Sound albums are secondary content.

## Outstanding before launch
- Replace the very small stand-in portrait with the supplied original or optimised high-resolution WebP. Confirm photographer's credit and publishing permission.
- **Get Richard's preferred direct booking email or authorised representative details.** The interim booking button currently points to https://thecomedyclub.co.uk/comedians/richard-morton, a publicly listed booking agency, explicitly identified as interim. Do not imply this is Richard's personal contact.
- Obtain confirmed future gigs and direct ticket links. Public date search on 16 November found no reliable confirmed upcoming listings; the site honestly says none currently listed rather than presenting expired shows.
- Select 1–3 actual YouTube performance videos, possibly add a video embed after testing privacy/performance.
- Review and approve final bio, quotes and promotional positioning with Richard; decide whether music should remain a separate section.
- Add correct canonical/OG URLs and final title/metadata for eventual domain, remove `noindex` and preview notice only on approval.
- Test desktop and mobile in a real browser. Verify all assets through live publisher and that no `/Richard` case-sensitivity issues arise.

## Changes in manifest revision 123
- Changed all red accents to suit-inspired blue (`#2463a3`, darker hover `#174a80`), including booking and hero buttons.
- Shortened the biography based on user-supplied Ents24 promotional copy; prioritises performing style, music and established support credits. Retains original studio portrait.
- Added supplied blue-suit live performance photograph to About section using `assets/richard-live-blue.webp`, local to Richard folder, without replacing hero portrait.
- About section now precedes press reviews, followed by video/music, dates and booking.
- Photo is intentionally provisional; replace with higher-resolution optimised version when practical.

## Publisher workaround: revision 124 (16 November 2026)
- User ran StackCP Scheduled Tasks > Test Command on the existing every-minute `/usr/bin/php84 /home/sites/33b/7/78a0ecb40e/publisher.php`. The output was: `2026-11-16T11:07:05+00:00 ERROR: Unsupported file type or destination: Richard/assets/panic-brothers.webp`.
- This proves the publisher was rejecting an unsupported nested image destination before completing deployment. It does **not** establish that the scheduled task itself is disabled or that SSH is necessary.
- Fix committed: the five small WebP files (portrait, blue-suit live photograph and three album covers) are embedded as `data:image/webp;base64,...` directly in `Richard/index.html`.
- Manifest revision **124** contains **only** `Richard/index.html` for Richard, with SHA-256 `1c47e4245b8b8977a8cd7c852ba5cf66829cb253ac905db53aba3c502fde72ff`. All five `Richard/assets/*.webp` entries were removed from the publisher manifest, **not** deleted from GitHub source control.
- All image sources and internal links validated from the new page content; no external runtime asset dependencies. The HTML source is about 34 KB.
- Leave the publisher itself unchanged, since it handles other public sites. Any future changes to the Richard website should preserve a single HTML publishing target unless a specifically tested, isolated publisher configuration for assets is introduced.
- **Still needs confirmation:** Run StackCP's existing `Test Command` again and verify the white-and-blue page appears at https://rockcentralpromotions.com/Richard/?v=124. The GitHub commit and updated manifest alone cannot prove a successful live deployment.
