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
  const report = compareKevinGigSync_(fetchKevinEvents_(start, end),
                                      readKevinRegister_(), start, end);
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

// Only Google Calendar read via REST. No event creation or mutation.
function fetchKevinEvents_(start, end) {
  const root = 'https://www.googleapis.com/calendar/v3/calendars/' +
    encodeURIComponent(KEVIN_SYNC.calendarId) + '/events';
  const token = ScriptApp.getOAuthToken();
  const all = [];
  let pageToken = '';
  do {
    const params = {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      maxResults: 250,
      singleEvents: true,
      showDeleted: false
    };
    if (pageToken) params.pageToken = pageToken;
    const query = Object.keys(params).map(k =>
      encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
    const response = UrlFetchApp.fetch(root + '?' + query, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) {
      throw new Error('Calendar read failed: HTTP ' + response.getResponseCode() +
        ', ' + response.getContentText().slice(0, 300));
    }
    const body = JSON.parse(response.getContentText());
    all.push.apply(all, body.items || []);
    pageToken = body.nextPageToken || '';
  } while (pageToken);
  return all;
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
  return /^\s*(?:GIG\b|MY SHOW\b)/i.test(event.summary || '');
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
      base.concat([{ ...base[0], row: 3 }])).proposalCount === 0
  };
  if (Object.values(results).some(v => !v)) throw new Error('Fixture failure: ' + JSON.stringify(results));
  Logger.log(JSON.stringify(results, null, 2));
  return results;
}
