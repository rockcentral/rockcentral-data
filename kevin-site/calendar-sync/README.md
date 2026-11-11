# Kevin Daniel gig sync: phase 1

**Status: read-only prototype, not installed or scheduled.** This code is separate from the live site publisher.

## What it does
- Reads Kevin's shared Google Calendar via the Google Calendar API.
- Reads the existing **Gig Register** tab in the working spreadsheet.
- Compares exact Google Calendar event IDs and date ranges.
- Recognises multi-day bookings and multiple performances on the same date.
- Ignores holidays and ordinary appointments that do not start with "GIG" or "MY SHOW".
- Reports new gigs, changed dates and missing calendar IDs as **review items**.
- Does not create/modify/delete calendar events, spreadsheet rows, public feed entries or website files.

## Configuration / permissions
Run from a new **Google Apps Script** project authorised by the RockCentral Google account that has access to Kevin's shared calendar and working register.

Create one Apps Script file called Code.gs from kevin-gig-sync.gs. In **Project Settings**, enable "Show appsscript.json manifest file" and use:

\`\`\`json
{
  "timeZone": "Europe/London",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}
\`\`\`

Run \`testKevinGigSyncRules\` first, then \`previewKevinGigSync\`. Inspect execution logs for proposals. If the event API returns 403, confirm the calendar is shared with the *executing* account and Google Calendar API access is authorised.

**Do not schedule this version.** Phase 2 will use a review sheet, explicit manual approval and protected columns before any controlled writeback.

## Safety considerations
- A Calendar "confirmed" event status is not proof of a confirmed booking, nor does it say whether Kevin personally accepted an invite. Calendar IDs and content are the source, and human review remains necessary.
- One calendar event can be multiple gigs: an event's start and end dates are exclusive-end and might represent two nights. The register can also have two shows on a single date.
- All-day calendar entries do **not** provide a show start time. Keep researched public show times untouched.
- The calendar may contain private fees, messages and booking correspondence. Do not log raw event descriptions or copy them to public sheets.
- The missing-event warning is not cancellation proof. Only notify for review.
- Some historical rows have no calendar ID. This importer never modifies them.
- Future sync must never rewrite public title, venue, ticket URL, verified link, publication or review decisions automatically.
