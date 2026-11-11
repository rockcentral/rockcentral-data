# Anthony Gigs, final safe deployment notes (11 November 2026)

The system is installed in the Google Apps Script project already called **Anthony Calendar Gig Sync**.

## Files to use

* Replace existing `Code.gs` with `anthony-calendar-sync.gs` **v0.2.5**.
* Keep `AnthonyPublicBridge.gs` **v0.3.1** (read-only).
* Keep `AnthonyAutoPublisher.gs` **v0.5.3** (register-led publisher). Do not restore the older 0.4.x publisher.
* Keep `AnthonyLegacyLinker.gs` **v0.6.2**. It has already linked 29 legacy gigs.
* Add `AnthonyDailyWorkflow.gs` from `anthony-daily-workflow.gs` **v0.7.2**.

The private register tab `Gig Register` now has columns V (Calendar Description) and W (Booking State). Its original columns A:U are unchanged.

The live public gig tab still has the website-facing A:I schema. Column J stores a one-way Listing Sync ID. No private calendar UID should be copied to public cells.

## First-time sequence

1. Save Code.gs v0.2.5. Run `testAnthonyCalendarSyncRules`. There are now 17 checks, including GIG/HOLD/CANCELLED states and private event description capture.
2. Run `previewAnthonyCalendarSync`, then `syncAnthonyCalendarToRegister`. Confirm the ordinary bookings remain recognised and the new private columns fill in. No website changes from this function.
3. Add `AnthonyDailyWorkflow.gs` v0.7.2. Run `testAnthonyLegacyBackfill` (7 checks). Run `previewAnthonyLegacyBackfill`. It should propose enriching already-linked records using the public listings without changing the public sheet.
4. If the preview is sensible, run `backfillAnthonyPrivateRegister` and then run it a second time to confirm zero new enrichments. This only writes J:Q in matched private rows; it retains existing verified manual details and holds conflicts.
5. Run `previewAnthonyRegisterPublisher` (v0.5.3). It should propose no duplicate existing bookings. Any new publication requires `Approved`, `Publish? Yes`, and complete public fields.
6. Run `dailyAnthonySafeWorkflow` once manually. It syncs calendar, then publishes only approved new public gigs. It throws an error if a linked public gig has moved or become inactive, rather than silently editing the website.
7. Only once the manual run is clean, enable Apps Script project manifest via **Project Settings > Show "appsscript.json" manifest file in editor** and set the documented scopes in `appsscript-v070.json`. Saving new scopes may require granting permissions. Run `enableAnthonySafeDailyTrigger` once. This installs a roughly 6am Europe/London daily trigger and removes any older dailyAnthonyGigWorkflow trigger.

Do not enable the trigger before the manual run and safety checks are confirmed.

## Day-to-day conventions

- `GIG - town - role - promoter`: confirmed performance. Calendar date is authoritative. Calendar start is often arrival time, not public start.
- `HOLD - town - role`: provisional. It imports privately with Booking State Hold but cannot publish.
- `CANCELLED - ...`: retained privately and never newly published. Existing public listing is flagged for review, not auto-deleted.
- Add a venue/town in Location as known. Add freely formatted notes, fees and confirmations to Description; description stays private.
- When you know reliable public information, use private fields `Public Venue`, `Public Location`, `Public Time`, `Ticket URL`, `Ticket Status`. Mark Review Status `Approved` and Publish? `Yes` when publication is appropriate.
- Web research for unknown venues/ticket links is not performed by Apps Script itself. It remains a separate enrichment task. Avoid assuming the booking's calendar start is the show start.

## Safety guarantees and remaining limitations

- Calendar sync never writes to the calendar or public sheet. Appending calendar descriptions to the private register is strictly private.
- The public publisher appends new approved rows and never overwrites existing public dates, statuses or ticket URLs.
- Matching and legacy linking do not auto-publish.
- Date moves and cancellations of already-published gigs require review before public updates. They cause the daily workflow to fail closed; Google Apps Script execution notifications should be monitored.
- If the public sheet contains a linked booking, a new matching row cannot be appended.
- Calendar descriptions may contain private information. Never paste them into the public sheet or web.
- There is no external automatically researched ticket lookup in this script. The existing weekly gig-ticket automation can help research ticket URLs.

## Source file versions

- Calendar Sync: v0.2.5
- Public Bridge: v0.3.1
- Register Publisher: v0.5.3
- Legacy Linker: v0.6.2
- Daily & Private Backfill: v0.7.2
