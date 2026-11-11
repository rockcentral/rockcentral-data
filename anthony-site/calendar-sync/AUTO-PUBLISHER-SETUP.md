# Anthony automatic gig publisher v0.4.1

Installation: add a NEW script file named **AnthonyAutoPublisher** to the existing Google Apps Script project, leaving Code.gs v0.2.2 and AnthonyPublicBridge v0.3.1 alone.

Functions:
- `testAnthonyAutoPublisher` for eleven no-write logic tests.
- `previewAnthonyAutoPublisher` for no-write live publication preview.
- `publishAnthonyConfirmedGigs` to append brand-new safe gigs only to public Google Sheet, which the website already reads.
- `dailyAnthonyGigWorkflow` performs calendar → private register, then conservative public append.
- `enableAnthonyDailyGigWorkflow` installs a London-time daily run at approximately 6am. Enable this ONLY after first preview and write tests.

The publisher **never changes existing public rows**, deletes rows, changes ticket links or guesses show start times. Calendar times are usually load-in, NOT show start. A new public listing must have either manually researched verified details or a clearly structured venue, town and postcode in calendar Location and a performance role in the title. When details are insufficient, it is held back and must be enriched before publishing.

Existing Malton, 26 Feb 2027, is now present in the live public feed with the promoter's confirmed start time, source page, venue and role. The publisher includes that booking in its verified catalogue and should NOT duplicate it.

Known limitations:
- This version does not independently search for ticket links on a scheduled Apps Script run. Entries published using structured calendar information use Info soon and blank ticket URL. Ticket-link research is a separate process.
- Existing calendar bookings whose locations are vague will be held. They are not necessarily missing gigs.
- Cancellations and date moves are flagged in the private register, not automatically deleted/changed in live public listings. Public date changes need a separate verified update path.
- Never use a calendar title containing fee or internal booking notes directly as a website headline.

### v0.4.1 duplicate fix
The same-day postcode is compared as well as the venue name. This prevents Wittering Parish Hall being duplicated under the Wittering SAS Club display name. A same-day identical postcode is conservatively treated as already listed even when the venue name differs. Thornbury remains eligible for the next preview. Do not enable the daily trigger until live preview and a controlled append are checked.
