# Anthony Public Feed Bridge, v0.3.0

This stage is READ-ONLY. It compares the populated private gig register with the existing `RockCentral - Anthony Public Gigs` sheet. It does not change the public sheet, website or any ticket links.

### Installation
In the existing **Anthony Calendar Gig Sync** Apps Script project, leave Code.gs (v0.2.2) untouched. Create an additional script file named `AnthonyPublicBridge` and paste the code from `anthony-public-bridge.gs`.

Run `testAnthonyPublicFeedMatches` (6 test results) and then `previewAnthonyPublicFeedMatches`. The report contains only aggregate counts and twelve examples from each side.

### Why this cannot just overwrite the public sheet
A private calendar title can be travel shorthand or mention a fee. Calendar start times are often arrival times, not show times. The public feed already has verified ticket links and manually chosen statuses, and the same date may have several performances. A date match does NOT establish gig identity.

### Next stage
Once the reconciliation has been reviewed, introduce a reviewed, immutable link between a private performance key and a specific existing public-feed row, and decide the policy for new, moved and cancelled gigs. Preserve existing public fields by default. Only explicitly approved entries should publish.
