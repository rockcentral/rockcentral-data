/**
 * KEVIN CALENDAR SYNC, PHASE 2: PRIVATE REVIEW INBOX
 * Add to the same Apps Script project as kevin-gig-sync.gs.
 *
 * This file never edits Gig Register or the website Public Feed.
 * It ONLY creates/appends to a private "Calendar Sync Review" tab
 * in the existing working spreadsheet, when a WRITE function is RUN.
 *
 * Run order:
 *   testKevinReviewInboxLogic()      // no Google access/writes
 *   previewKevinReviewInbox()        // read only
 *   testKevinReviewInboxWrite()      // creates temporary test row, tests duplicate, deletes it
 *   importKevinNewGigsToReview()     // optional manual review-inbox import, no publishing
 */
const KEVIN_INBOX_TAB = 'Calendar Sync Review';
const KEVIN_INBOX_HEADERS = [
  'Calendar iCalUID', 'Performance Date', 'Calendar Title', 'Calendar Location',
  'Review Status', 'First Detected', 'Last Checked', 'Notes'
];

function isKevinTestEvent_(event) {
  return !!event.testOnly || /\btest\b/i.test(event.summary || '');
}

function isKevinImportCandidate_(event) {
  // Strict deliberate naming gate to avoid importing holidays / private appointments.
  // The new 18 November test is detected in the DRY RUN, but excluded from writes.
  return /^\s*(?:GIG\b|MY SHOW\b)/i.test(event.summary || '') &&
         !isKevinTestEvent_(event);
}

function kevinInboxKey_(id, date) {
  return String(id || '').trim() + '|' + String(date || '').trim();
}

function kevinReviewProposals_(events, registerRows, existingInboxRows) {
  const registerDates = new Set(registerRows
    .filter(r => !/cancelled/i.test(r.ticketStatus || ''))
    .map(r => r.date));
  const inboxKeys = new Set(existingInboxRows.map(r =>
    kevinInboxKey_(r.id, r.date)));
  const proposedKeys = new Set();
  const proposals = [];
  events.forEach(event => {
    if (!isKevinImportCandidate_(event)) return;
    eventDates_(event).forEach(date => {
      const key = kevinInboxKey_(event.id, date);
      if (!event.id || proposedKeys.has(key) || inboxKeys.has(key)) return;
      proposedKeys.add(key);
      // Existing same-date gigs are not overwritten; separate gig on same date
      // requires human review and stronger identity verification.
      if (registerDates.has(date)) return;
      proposals.push({
        key, id: event.id, date, title: event.summary || '',
        location: event.location || '',
        note: 'Candidate only. Verify before adding to Gig Register; Publish defaults No.'
      });
    });
  });
  return proposals;
}

function kevinReadInbox_() {
  const spreadsheet = SpreadsheetApp.openById(KEVIN_SYNC.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(KEVIN_INBOX_TAB);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getDisplayValues();
  if (rows.length && KEVIN_INBOX_HEADERS.some((h, i) => rows[0][i] !== h))
    throw new Error('Review tab has unexpected headers; no changes made.');
  return rows.slice(1).filter(r => r[0] && r[1]).map(r => ({
    id: r[0], date: r[1], status: r[4]
  }));
}

function kevinNewEventProposals_() {
  const now = new Date();
  const start = new Date(now.getTime() - KEVIN_SYNC.daysBehind * 86400000);
  const end = new Date(now.getTime() + KEVIN_SYNC.daysAhead * 86400000);
  const events = fetchKevinBuiltInEvents_(start, end);
  const registerRows = readKevinRegister_();
  const inboxRows = kevinReadInbox_();
  return {
    eventsRead: events.length,
    gigsInRegister: registerRows.length,
    reviewInboxRows: inboxRows.length,
    proposals: kevinReviewProposals_(events, registerRows, inboxRows)
  };
}

/** Entirely read-only; useful to see candidate count before any write. */
function previewKevinReviewInbox() {
  const result = kevinNewEventProposals_();
  Logger.log(JSON.stringify({
    mode: 'DRY_RUN_ONLY', proposedNewReviewRows: result.proposals.length,
    ...result, spreadsheetWrites: 0, calendarWrites: 0
  }, null, 2));
  return result;
}

function kevinEnsureReviewTab_(spreadsheet) {
  let tab = spreadsheet.getSheetByName(KEVIN_INBOX_TAB);
  if (!tab) {
    tab = spreadsheet.insertSheet(KEVIN_INBOX_TAB);
    tab.getRange(1, 1, 1, KEVIN_INBOX_HEADERS.length)
      .setValues([KEVIN_INBOX_HEADERS]);
    tab.setFrozenRows(1);
    tab.getRange(1, 1, 1, KEVIN_INBOX_HEADERS.length)
      .setFontWeight('bold').setBackground('#e9edf5');
    tab.setColumnWidths(1, KEVIN_INBOX_HEADERS.length, 155);
    tab.setColumnWidth(1, 280);
    tab.setColumnWidth(3, 350);
  } else {
    const head = tab.getRange(1, 1, 1, KEVIN_INBOX_HEADERS.length)
      .getDisplayValues()[0];
    if (head.some((h, i) => h !== KEVIN_INBOX_HEADERS[i]))
      throw new Error('Existing review tab headers differ. Aborted.');
  }
  return tab;
}

function kevinAppendInboxProposals_(proposals) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Another import is running; retry later.');
  try {
    if (!proposals.length) return { added: 0, alreadyThere: 0 };
    const ss = SpreadsheetApp.openById(KEVIN_SYNC.spreadsheetId);
    const tab = kevinEnsureReviewTab_(ss);
    const existing = tab.getDataRange().getDisplayValues().slice(1);
    const keys = new Set(existing.filter(r => r[0] && r[1])
      .map(r => kevinInboxKey_(r[0], r[1])));
    const stamp = Utilities.formatDate(new Date(), KEVIN_SYNC.timezone,
      'yyyy-MM-dd HH:mm');
    const additions = [];
    let alreadyThere = 0;
    proposals.forEach(p => {
      if (!p.id || !p.date) return;
      if (keys.has(p.key)) { alreadyThere++; return; }
      // Guard even if someone calls the low-level append helper directly.
      if (/\btest\b/i.test(p.title || '')) return;
      keys.add(p.key);
      additions.push([
        p.id, p.date, p.title, p.location,
        'Needs review', stamp, stamp,
        p.note || 'Not approved for website publication'
      ]);
    });
    if (additions.length)
      tab.getRange(tab.getLastRow() + 1, 1, additions.length,
        KEVIN_INBOX_HEADERS.length).setValues(additions);
    return { added: additions.length, alreadyThere };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Manual import. Adds ONLY to separate private review tab, not Gig Register.
 * NEVER sets Publish? Yes, changes an event, or touches a ticket URL.
 */
function importKevinNewGigsToReview() {
  const result = kevinNewEventProposals_();
  const write = kevinAppendInboxProposals_(result.proposals);
  Logger.log(JSON.stringify({
    mode: 'PRIVATE_REVIEW_INBOX_ONLY', eventsRead: result.eventsRead,
    proposed: result.proposals.length, ...write,
    gigRegisterWrites: 0, publicFeedWrites: 0, calendarWrites: 0
  }, null, 2));
  return write;
}

/** Local fixture tests, absolutely no Google reads or writes. */
function testKevinReviewInboxLogic() {
  const row = [{date: '2026-11-19', ticketStatus:'On sale'}];
  const event = (id, title, date) => ({
    id, summary: title, status: 'confirmed',
    start:{date}, end:{date:'2026-11-22'}
  });
  const oneDay = (id,title,date) => ({
    id, summary:title, start:{date},
    end:{date: new Date(new Date(date + 'T12:00:00Z')
      .getTime() + 86400000).toISOString().slice(0,10)}
  });
  const run = (events, rows, inbox) => kevinReviewProposals_(events, rows, inbox);
  const booked = oneDay('cal-1', 'GIG New booking', '2026-11-21');
  const checks = {
    freshGigQueued: run([booked], row, []).length === 1,
    testExcluded: run([oneDay('cal-test', 'NEW TEST TRST TEST GIG','2026-11-18')], row, []).length === 0,
    explicitGigTestExcluded: run([oneDay('cal-test2','GIG TEST ONLY','2026-11-18')],row,[]).length === 0,
    holidayExcluded: run([oneDay('holiday','Holiday','2026-11-20')],row,[]).length === 0,
    identicalInboxKeySkipped: run([booked],row,[{id:'cal-1',date:'2026-11-21'}]).length === 0,
    existingDateNotOverwritten: run([oneDay('new-id','GIG different booking','2026-11-19')],row,[]).length === 0,
    sameDateMultipleDistinctIds: run([
      oneDay('cal-2','GIG One','2026-11-21'),
      oneDay('cal-3','GIG Two','2026-11-21')
    ],row,[]).length === 2
  };
  Logger.log(JSON.stringify(checks,null,2));
  if (Object.values(checks).some(x => !x))
    throw new Error('Review inbox fixture failure: ' + JSON.stringify(checks));
  return checks;
}

/**
 * Controlled write test, safe if explicitly run. Creates a private test row
 * and verifies duplicate suppression, then removes ONLY that exact test row.
 * Never inserts or deletes rows in the Gig Register.
 */
function testKevinReviewInboxWrite() {
  const ss = SpreadsheetApp.openById(KEVIN_SYNC.spreadsheetId);
  const tab = kevinEnsureReviewTab_(ss);
  const id = 'KEVIN_SYNC_FIXTURE_DO_NOT_PUBLISH';
  const date = '2099-01-01';
  const key = kevinInboxKey_(id, date);
  const testProposal = {
    key, id, date, title: 'GIG Fixture verification',
    location: 'Fixture only, not real', note: 'Automated temporary fixture'
  };
  const first = kevinAppendInboxProposals_([testProposal]);
  const second = kevinAppendInboxProposals_([testProposal]);
  const rows = tab.getDataRange().getDisplayValues();
  const matches = [];
  rows.forEach((r,i) => { if (r[0] === id && r[1] === date) matches.push(i+1); });
  // Remove only our uniquely identified row, which must have been freshly inserted.
  if (first.added === 1 && matches.length === 1) tab.deleteRow(matches[0]);
  const passed = first.added === 1 && second.added === 0 &&
    second.alreadyThere === 1 && matches.length === 1;
  Logger.log(JSON.stringify({passed, first, second,
    fixtureCleanedUp: first.added === 1 && matches.length === 1},null,2));
  if (!passed) throw new Error('Controlled write check failed. Inspect review tab.');
  return true;
}
