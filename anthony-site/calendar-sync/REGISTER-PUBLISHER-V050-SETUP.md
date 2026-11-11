# Anthony gig system: register-led publisher v0.5.1

Updated 11 November 2026.

## Data flow

1. Google Calendar ("Gigs") is authoritative for whether Anthony is booked and for the performance date.
2. `Gig Register` is the private review and enrichment layer. Every calendar booking gets a stable `Performance Key`. Calendar start time is NOT the public show start.
3. The `RockCentral - Anthony Public Gigs` sheet is the live website feed. A:I retain the same schema. Column J is `Performance Key`, a private technical link.
4. The website continues reading the existing public A:I information.

## Replace, don't add to old publisher

Keep these existing Apps Script files:
- `Code.gs` containing Calendar Sync v0.2.2.
- `AnthonyPublicBridge.gs` containing read-only comparison v0.3.1.

**Replace the full contents of `AnthonyAutoPublisher.gs` (v0.4.2) with `anthony-register-publisher-v050.gs`.** Do not leave both files, since old v0.4.2 includes less restrictive publish and trigger functions.

## What is allowed to publish

A private row must have:
- `Sync Status` = `Active`.
- `Review Status` = `Approved`.
- `Publish?` = `Yes`.
- `Public Venue` and `Public Location` (town).
- `Ticket Status` = `Info soon`, `Live` or `Hidden`.
- A single unambiguous role expressed in the calendar title (MC, Opener, Middle or Closer). If not unambiguous, it is held for review.
- For `Live`, an HTTPS ticket/event URL.
- `Public Time` is optional for `Info soon`, otherwise use a verified show start. It is never copied from the Calendar Start field.

The public `Notes` column receives the reviewed `Public Show Title` field or a generic description. The publisher never copies internal calendar titles, fee details, or private notes.

## Existing public listings and duplicate prevention

The live public sheet has a 10th technical column `Performance Key` (J). Its A:I website columns were not changed.

Existing entries have been linked where identity is known:
- 14 Nov 2026 Wittering, public row 63, private row 2.
- 26 Feb 2027 Malton, public row 64, private row 31.
- 27 Aug 2027 Thornbury, public row 65, private row 51.

All other existing public gigs remain unchanged. For unlinked legacy rows, same-date venue/postcode collisions are **held** for manual linking instead of duplicated. Multiple public bookings on one date are allowed if venues differ and identity is clear.

Once a performance is linked, any date change, cancellation or other source change is detected as a **review condition**. v0.5.1 **does not** silently change or delete public listings. Existing ticket links are never overwritten.

## Tests and operation

1. Paste and save v0.5.1.
2. Run `testAnthonyRegisterPublisher` and confirm thirteen `true` results.
3. Run `previewAnthonyRegisterPublisher` and inspect the report. It makes no changes.
4. Only after approval and preview, use `publishAnthonyApprovedGigs` for new approved entries.
5. Re-run publisher after the first write: it should be idempotent (zero new entries).

**No daily automation is enabled in v0.5.1.** Later, create a coordinated scheduled workflow after reviewing source changes, holds and error notifications. Do not run any old v0.4.x daily workflow or trigger-creation function.

## Deliberate limits

This stage does not web-search ticket links on its own, auto-approve unknown gigs, auto-update existing rows or auto-remove deleted bookings. All are separate workflow stages and must have tests and safeguards before enabling. A high number of held rows usually reflects records not yet reviewed and does not imply they are missing from the public website.

This design avoids a growing catalogue of venue and ticket information inside Apps Script and protects the already-verified website feed.
