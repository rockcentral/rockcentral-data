/**
 * Kevin Daniel gig calendar synchronisation, phase 1: READ ONLY.
 * Install as a Google Apps Script project run by an account with access to
 * the shared calendar and working Google Sheet.
 * Requires OAuth scopes declared in appsscript.json.
 * NO spreadsheet, calendar, or website writes.
 */
const KEVIN_SYNC = Object.freeze({
  calendarId: '045f8e76bf0e26a6741344d8173f4c97e0d278ac8776d05a62f952a7964d89fe@group.calendar.google.com',
  spreadsheetId: '1Dr89sbwDhBmb0FozJ4H7hj-Pvs2sWlI1IScSP2wvSao',
  tab: 'Gig Register',
  daysAhead: 400,
  daysBehind: 7,
  timezone: 'Europe/London'
});

function previewKevinGigSync() {
  const today = new Date();
  const start = new Date(today.getTime() - KEVIN_SYNC.daysBehind * 86400000);
  const end = new Date(today.getTime() + KEVIN_SYNC.daysAhead * 86400000);
  const report = compareKevinBuiltIn_(fetchKevinBuiltInEvents_(start, end),
                                       readKevinRegister_(), start, end);
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

/**
 * Built-in CalendarApp avoids the separate Google Cloud Calendar API.
 * IMPORTANT: CalendarApp IDs are iCalUIDs, unlike the existing register's
 * Calendar API event IDs. Therefore this prototype matches dates only,
 * reports possible matches for review, and NEVER writes event IDs.
 */
function fetchKevinBuiltInEvents_(start, end) {
  const calendar = CalendarApp.getCalendarById(KEVIN_SYNC.calendarId);
  if (!calendar) throw new Error("Kevin's shared calendar is not accessible.");
  const tz = KEVIN_SYNC.timezone;
  return calendar.getEvents(start, end).map(e => {
    const allDay = e.isAllDayEvent();
    const begin = allDay ? e.getAllDayStartDate() : e.getStartTime();
    const finish = allDay ? e.getAllDayEndDate() : e.getEndTime();
    const fmt = d => Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    return {
      // iCalUID, NOT the register's Calendar API ID
      id: e.getId(),
      summary: e.getTitle(),
      // Check test marker privately; never include full booking notes in reports.
      testOnly: /\btest\s+only\b|\btest\s+event\b/i.test(e.getDescription() || ''),
      location: e.getLocation(),
      status: 'confirmed',
      start: allDay ? { date: fmt(begin) } :
        { dateTime: Utilities.formatDate(begin, tz, "yyyy-MM-dd'T'HH:mm:ss") },
      end: allDay ? { date: fmt(finish) } :
        { dateTime: Utilities.formatDate(finish, tz, "yyyy-MM-dd'T'HH:mm:ss") }
    };
  });
}

/** Safe date-only reconciliation. No IDs or verified fields are written. */
function compareKevinBuiltIn_(events, rows, start, end) {
  const from = Utilities.formatDate(start, KEVIN_SYNC.timezone, 'yyyy-MM-dd');
  const through = Utilities.formatDate(end, KEVIN_SYNC.timezone, 'yyyy-MM-dd');
  const gigEvents = events.filter(isGig_);
  const proposals = [];
  const seenRows = {};
  let matchedByDate = 0;
  let ambiguousMatches = 0;
  gigEvents.forEach(event => {
    const dates = eventDates_(event);
    const candidates = rows.filter(r => dates.indexOf(r.date) !== -1 &&
                                      r.ticketStatus !== 'Cancelled');
    if (candidates.length === 0) {
      proposals.push({
        action: event.testOnly || /\btest\b/i.test(event.summary) ? 'TEST_GIG_DETECTED' : 'REVIEW_POSSIBLE_NEW_GIG', dates: dates,
        calendarTitle: event.summary, calendarLocation: event.location || '',
        note: 'Date has no active register gig. Human review; DO NOT add automatically.'
      });
      return;
    }
    candidates.forEach(r => { seenRows[r.row] = true; });
    matchedByDate++;
    const candidateIds = [...new Set(candidates.map(r => r.id || 'legacy:' + r.row))];
    if (candidateIds.length > 1) {
      ambiguousMatches++;
      proposals.push({
        action: 'REVIEW_AMBIGUOUS_DATE_MATCH', dates: dates,
        calendarTitle: event.summary,
        candidateRows: candidates.map(r => r.row),
        note: 'Multiple existing bookings on same date. Do not merge automatically.'
      });
    }
    const missingDates = dates.filter(d => !candidates.some(r => r.date === d));
    if (missingDates.length) proposals.push({
      action: 'REVIEW_ADDITIONAL_DATE', dates: missingDates,
      calendarTitle: event.summary, candidateRows: candidates.map(r => r.row),
      note: 'Calendar spans a date not in matched register rows.'
    });
  });
  const unobserved = rows.filter(r => r.id && r.date >= from &&
    r.date < through && r.ticketStatus !== 'Cancelled' && !seenRows[r.row]);
  // Omission is NOT a cancellation: source calendars and recurrence may differ.
  unobserved.forEach(r => proposals.push({
    action: 'REVIEW_NOT_FOUND_BY_DATE', date: r.date, registerRow: r.row,
    venue: r.venue, note: 'Do not cancel, unpublish or overwrite automatically.'
  }));
  return {
    mode: 'DRY_RUN_ONLY', matching: 'DATE_ONLY_PROVISIONAL',
    warning: 'CalendarApp uses different event identifiers from working register. No ID changes permitted.',
    generatedAt: new Date().toISOString(),
    calendarRange: { from: from, throughExclusive: through },
    calendarEventsRead: events.length, gigEventsRead: gigEvents.length,
    registerRowsRead: rows.length, matchedByDate: matchedByDate,
    ambiguousMatches: ambiguousMatches, proposalCount: proposals.length,
    proposals: proposals, spreadsheetWrites: 0, calendarWrites: 0
  };
}

function readKevinRegister_() {
  const ss = SpreadsheetApp.openById(KEVIN_SYNC.spreadsheetId);
  const sheet = ss.getSheetByName(KEVIN_SYNC.tab);
  if (!sheet) throw new Error('Missing Gig Register tab');
  const values = sheet.getDataRange().getDisplayValues();
  const expected = {
    2: 'Date', 3: 'Venue', 22: 'Ticket Status', 23: 'Publish?',
    25: 'Calendar Event ID', 26: 'Performance Key'
  };
  Object.keys(expected).forEach(i => {
    if ((values[0][Number(i)] || '').trim() !== expected[i])
      throw new Error('Unexpected column ' + (Number(i) + 1) +
        ': expected ' + expected[i]);
  });
  return values.slice(1).map((v, i) => ({
    row: i + 2,
    date: toIsoDate_(v[2]),
    venue: v[3] || '',
    publicVenue: v[18] || '',
    ticketStatus: v[22] || '',
    publish: v[23] || '',
    id: v[25] || '',
    key: v[26] || ''
  })).filter(r => r.date);
}

function toIsoDate_(value) {
  const s = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Allow Google Sheets locale display "13/11/2026" only if unambiguous.
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' +
    m[1].padStart(2, '0') : '';
}

function isGig_(event) {
  const title = event.summary || '';
  return /^\s*(?:GIG\b|MY SHOW\b)/i.test(title) ||
    /\btest\b.*\bgig\b/i.test(title);
}

function eventDates_(event) {
  const start = (event.start && (event.start.date || event.start.dateTime) || '').slice(0, 10);
  let end = (event.end && (event.end.date || event.end.dateTime) || '').slice(0, 10);
  if (!start) return [];
  // For all-day events Google Calendar end date is exclusive.
  if (!(event.start && event.start.date)) return [start];
  if (!end || end <= start) return [start];
  const dates = [];
  let d = new Date(start + 'T12:00:00Z');
  const final = new Date(end + 'T12:00:00Z');
  while (d < final && dates.length < 40) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

function compareKevinGigSync_(events, rows, start, end) {
  const from = start.toISOString().slice(0, 10);
  const through = end.toISOString().slice(0, 10);
  const byId = {};
  rows.forEach(row => {
    if (row.id) (byId[row.id] = byId[row.id] || []).push(row);
  });

  const seen = {};
  const proposals = [];
  let ignoredNonGigs = 0;
  const unique = {};
  events.forEach(event => {
    if (unique[event.id]) return; // Google paging safety
    unique[event.id] = true;
    if (!isGig_(event)) { ignoredNonGigs++; return; }
    if (event.status === 'cancelled') return;
    if (event.attendees && event.attendees.some(a => a.self && a.responseStatus === 'declined'))
      return;
    const dates = eventDates_(event);
    if (!dates.length) return;
    const existing = byId[event.id] || [];
    seen[event.id] = true;
    if (!existing.length) {
      proposals.push({
        action: 'REVIEW_NEW_GIG', eventId: event.id, dates: dates,
        title: event.summary || '', location: event.location || '',
        note: 'Propose unpublished register row(s) only; never publish automatically.'
      });
      return;
    }
    // A single event may map to two nights, or two shows on one date.
    const hasDateOutsideEvent = existing.some(r => dates.indexOf(r.date) < 0);
    if (hasDateOutsideEvent) {
      proposals.push({
        action: 'REVIEW_DATE_CHANGE', eventId: event.id,
        registerRows: existing.map(r => r.row),
        registerDates: existing.map(r => r.date), calendarDates: dates,
        note: 'Do not overwrite event dates, public fields or ticket links.'
      });
    } else if (dates.some(date => !existing.some(r => r.date === date))) {
      proposals.push({
        action: 'REVIEW_ADDITIONAL_PERFORMANCE', eventId: event.id,
        registerRows: existing.map(r => r.row),
        calendarDates: dates,
        note: 'Calendar can contain multi-day bookings. Human review required.'
      });
    }
  });

  // Missing events are warnings, never automatic cancellations.
  // Do not flag beyond the scanning window or historical/legacy rows.
  rows.filter(r => r.id && r.date >= from && r.date < through && !seen[r.id])
    .forEach(r => proposals.push({
      action: 'REVIEW_MISSING_EVENT', eventId: r.id, registerRow: r.row,
      date: r.date, venue: r.venue,
      note: 'Check calendar before changing anything. Do not unpublish or delete.'
    }));

  return {
    mode: 'DRY_RUN_ONLY',
    generatedAt: new Date().toISOString(),
    calendarRange: { from: from, throughExclusive: through },
    calendarEventsRead: events.length,
    registerRowsRead: rows.length,
    ignoredNonGigs: ignoredNonGigs,
    proposalCount: proposals.length,
    proposals: proposals,
    spreadsheetWrites: 0,
    calendarWrites: 0
  };
}

/** Local fixture checks, no Google access or writes. */
function testKevinGigSyncRules() {
  const base = [{ row: 2, id: 'fixture-1', date: '2026-11-17',
    venue: 'Test Venue', publicVenue: 'Verified Venue', publish: 'No',
    ticketStatus: 'Info soon' }];
  const event = (id, title, date, end) => ({
    id: id, summary: title, status: 'confirmed',
    start: { date: date }, end: { date: end }
  });
  const windowStart = new Date('2026-11-11T00:00:00Z');
  const windowEnd = new Date('2026-12-01T00:00:00Z');
  const check = (events, rows) =>
    compareKevinGigSync_(events, rows, windowStart, windowEnd);
  const results = {
    newGig: check([event('fixture-2', 'GIG TEST ONLY', '2026-11-18', '2026-11-19')], base)
      .proposals.some(x => x.action === 'REVIEW_NEW_GIG'),
    existingUnchanged: check([event('fixture-1', 'GIG TEST ONLY', '2026-11-17', '2026-11-18')], base)
      .proposalCount === 0,
    changedDate: check([event('fixture-1', 'GIG TEST ONLY', '2026-11-18', '2026-11-19')], base)
      .proposals.some(x => x.action === 'REVIEW_DATE_CHANGE'),
    nonGigIgnored: check([event('fixture-2', 'Holiday', '2026-11-18', '2026-11-19')], [])
      .proposalCount === 0,
    multiDayPreserved: check([event('fixture-1', 'GIG TWO NIGHTS', '2026-11-17', '2026-11-19')],
      base.concat([{ ...base[0], row: 3, date: '2026-11-18' }])).proposalCount === 0,
    sameDateDoublePreserved: check([event('fixture-1', 'GIG TWO SHOWS', '2026-11-17', '2026-11-18')],
      base.concat([{ ...base[0], row: 3 }])).proposalCount === 0,
    kevinTestDetected: compareKevinBuiltIn_(
      [{...event('fixture-2', 'NEW TEST TRST TEST GIG', '2026-11-18', '2026-11-19'), testOnly: true}],
      base, windowStart, windowEnd
    ).proposals.some(x => x.action === 'TEST_GIG_DETECTED')
  };
  if (Object.values(results).some(v => !v)) throw new Error('Fixture failure: ' + JSON.stringify(results));
  Logger.log(JSON.stringify(results, null, 2));
  return results;
}
