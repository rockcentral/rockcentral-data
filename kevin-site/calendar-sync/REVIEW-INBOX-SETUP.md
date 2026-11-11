# Kevin's controlled review-inbox importer (phase 2)

Do not schedule this or enable automatic writes yet.

The existing phase-1 \`previewKevinGigSync\` stays in place and keeps working.

## Add to Google Apps Script
1. Open the existing **Kevin Daniel Gig Sync** Apps Script project.
2. Create a **new script file** (Files + > Script) named \`KevinReviewInbox\`.
3. Copy the contents of \`kevin-review-inbox.gs\` into the new file.
4. Save. Existing \`appsscript.json\` scopes already include Sheets and Calendar access.

Run in this order:
1. \`testKevinReviewInboxLogic\` (seven pure fixture checks, zero writes).
2. \`previewKevinReviewInbox\` (real calendar/register read, zero writes). Kevin's 18 Nov event is deliberately **excluded** as a test.
3. \`testKevinReviewInboxWrite\` (creates a new **Calendar Sync Review** tab if missing; writes a harmless fixture row; checks the second run is idempotent; removes just that fixture row).
4. **Only after inspecting the above results:** \`importKevinNewGigsToReview\`. It creates review entries for unmatched, real \`GIG\` or \`MY SHOW\` entries that have no booking on the same date. It never edits the main register, public sheet or website.

**Important limits**
- CalendarApp's \`getId()\` returns an iCalUID; old working-sheet Calendar Event IDs came from the REST API. No attempt is made to rewrite/migrate those original IDs.
- Same-date bookings are deliberately held back (no overwrites); this means the importer can miss a different second booking on an existing date. Identity resolution is still needed before full automation.
- Multi-day calendar entries can result in several separate performance-date review rows. Human review is required.
- Calendar title and location appear in the **private** review tab; they do not become public. Do not place sensitive details in either of those fields if the sheet is shared beyond trusted administrators.
- Test gigs are never imported, including the 18 November Leicester test. Keep the test calendar event until the testing phase is finished.
- Do not approve/publish a review entry by setting its status alone: at this stage it is an inbox, not an automation wired into the public feed.

The website remains sourced exclusively from the working register's explicitly published rows.
