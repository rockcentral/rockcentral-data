# Anthony's private Google Calendar → gig register sync (beta)

## Connected resources

- Source Google Calendar: **Gigs** (owned by RockCentral account).
- Working/private Google Sheet: https://docs.google.com/spreadsheets/d/1f-pkmgRWbZObOkv1o0lBeHKo8CEI75WKczG6NCcSmuE/edit
- Existing public website feed: **RockCentral - Anthony Public Gigs**. This sync does not write to it.
- Existing website \`rockcentralpromotions.com/anthony/\` stays unchanged.

## Install

1. Open https://script.google.com/ signed into **info@rockcentralpromotions.com**.
2. Create a project named \`Anthony Calendar Gig Sync\`.
3. Paste \`anthony-calendar-sync.gs\` into \`Code.gs\`.
4. Show \`appsscript.json\` in Project Settings and use:

\`\`\`json
{
  "timeZone": "Europe/London",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/spreadsheets"
  ]
}
\`\`\`

5. Run \`testAnthonyCalendarSyncRules\`. Expect seven \`true\`.
6. Run \`previewAnthonyCalendarSync\`. This is **read-only**, and shows every proposed addition, move, disappearance and unknown-title entry.
7. Once preview has been reviewed, run \`syncAnthonyCalendarToRegister\` manually. It will import gigs **privately** as unpublished.
8. Re-run the same function. Expect \`added:0\`, \`moved:0\`, \`sourceUpdated:0\`, \`missingFlagged:0\` if nothing changed.

## Controlled test

After baseline import, create a GIG event with title \`GIG Sync Test - [venue]\`, a date with no current bookings, and location. **NOTE**: the importer excludes titles containing \`test\`; for a controlled test use \`GIG Fixture - Venue Name\` instead. Run preview/sync, move it to another date, then delete it; preview/sync after each. You'll see the original private register record change date or be flagged missing, never disappear. For the test, never approve \`Publish? Yes\`.

## Safeguards

- No edits to the public feed, live website or Calendar.
- No automatic publishing. Imported rows have \`Publish? = No\`.
- Distinguishes bookings on the same date by stable Calendar iCalUID. For a single event representing multiple days, keys use \`iCalUID|slot:N\`.
- Updates internal date/title/location/time only; existing public title, venue, time, URL and status are untouched.
- Deleted/removed calendar events are flagged, never deleted from the register.
- Ambiguous recurring events sharing an iCalUID are skipped until reviewed.
- Personal and test titles excluded by conservative filters. Unknown titles only appear in the preview; they don't import automatically.
- No scheduled trigger is installed yet. Once create/move/delete tests pass, a daily trigger can be added.

## Caveats to resolve before launch

- Some genuine gig titles (e.g. \`20 for Marty Riley in Hudds\`) lack the expected keywords and are intentionally held for classification. These must be reconciled before unattended operation.
- Calendar start times are often travel/load-in, not the public show time. The script never converts calendar time to a public start time.
- Existing public gigs have **not** been backfilled into the private register. This first stage does not modify or replace the live public feed.
- Recurring gigs with identical iCalUIDs are not safely identified by this beta importer. Handle these manually.
