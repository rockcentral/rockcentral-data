# Anthony Williams calendar-to-website gigs sync

Phase 1 is **read-only**. No live website code has been changed.

## Existing architecture
- Calendar source: the RockCentral Google Calendar named **Gigs**.
- Public destination: native Google Sheet **RockCentral - Anthony Public Gigs** (sheet ID shown in source).
- Website: \`rockcentralpromotions.com/anthony/\` already fetches the public Sheet's published CSV.
- There is **no separate working register**, unlike Kevin's setup. Therefore a direct calendar-to-public-sheet write would be unsafe.

## Phase 1 test procedure
Create a new Apps Script project under info@rockcentralpromotions.com.
Paste \`anthony-gig-sync.gs\` into \`Code.gs\`.

In appsscript.json set:
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

Run \`testAnthonyGigSync\`, then \`previewAnthonyGigSync\`. The latter prints a read-only review report. No deployment or scheduled trigger needed.

**Privacy:** The Gigs calendar includes personal appointments and sensitive booking correspondence. Never copy event descriptions, fees or unreviewed diary titles into the public Sheet. The review log contains titles and locations, so handle it privately.

## Phase 2 before real writeback
1. Create a separate private **Anthony Gig Register (Working)** with source calendar IDs, source event summary, candidate status, reviewed public fields and an explicit Publish toggle.
2. Implement identity matching using iCalUID plus performance date/slot and a review workflow for double gigs and multiple shows.
3. Never rewrite an existing public row or ticket URL based on an ambiguous date match.
4. Feed the existing public sheet from explicitly approved working records, after a parity test against current public listings.
5. Run an import dry run, controlled write test and repeat for idempotency; only then schedule daily 6am UK time.

No code in this phase creates a row, sends emails, changes website content, modifies calendar entries or installs triggers.
