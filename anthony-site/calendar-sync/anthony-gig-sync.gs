/**
 * Anthony Williams gig import audit, phase 1 (DRY RUN).
 * Reads the private "Gigs" calendar and the PUBLIC gig feed sheet.
 * NEVER WRITES ANYTHING. Do not enable a trigger in this version.
 * For installation under info@rockcentralpromotions.com.
 */
const ANTHONY_SYNC = Object.freeze({
  calendarName: 'Gigs',
  publicSheetId: '12fHnBXl7DU5i0vKiXlMTHRGLUWCSwvDLvmXR_2-Xzp8',
  publicTab: 'Public Gigs',
  timezone: 'Europe/London',
  daysAhead: 400,
  daysBehind: 7
});

function previewAnthonyGigSync() {
  const now = new Date();
  const from = new Date(now.getTime() - ANTHONY_SYNC.daysBehind * 86400000);
  const to = new Date(now.getTime() + ANTHONY_SYNC.daysAhead * 86400000);
  const events = readAnthonyGigCalendar_(from, to);
  const rows = readAnthonyPublicGigs_();
  const report = compareAnthonyGigs_(events, rows, from, to);
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

function readAnthonyGigCalendar_(from, to) {
  const matching = CalendarApp.getCalendarsByName(ANTHONY_SYNC.calendarName);
  if (matching.length !== 1)
    throw new Error('Expected one calendar named Gigs; found ' + matching.length);
  return matching[0].getEvents(from, to).map(e => {
    const fmt = d => Utilities.formatDate(d, ANTHONY_SYNC.timezone, 'yyyy-MM-dd');
    return {
      id: e.getId(),   // iCalUID, do not compare to Google Calendar API event IDs
      title: e.getTitle() || '',
      location: e.getLocation() || '',
      date: fmt(e.isAllDayEvent() ? e.getAllDayStartDate() : e.getStartTime()),
      endDateExclusive: fmt(e.isAllDayEvent() ? e.getAllDayEndDate() : e.getEndTime()),
      allDay: e.isAllDayEvent()
    };
  });
}

function readAnthonyPublicGigs_() {
  const sheet = SpreadsheetApp.openById(ANTHONY_SYNC.publicSheetId)
    .getSheetByName(ANTHONY_SYNC.publicTab);
  if (!sheet) throw new Error('Public Gigs tab not found');
  const values = sheet.getDataRange().getDisplayValues();
  const required = ['Date','Time','Location','Venue','Address','Ticket URL','Status','Role','Notes'];
  if (!values.length || required.some((h,i) => (values[0][i] || '').trim() !== h))
    throw new Error('Unexpected public gig columns; stop without making changes');
  return values.slice(1).map((v,i) => ({
    row: i + 2, date: ukDate_(v[0]), time: v[1] || '',
    location: v[2] || '', venue: v[3] || '',
    address: v[4] || '', ticketUrl: v[5] || '',
    status: v[6] || '', role: v[7] || '', notes: v[8] || ''
  })).filter(r => r.date);
}

function ukDate_(x) {
  const s = String(x || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  return m ? m[3] + '-' + m[2].padStart(2,'0') + '-' +
    m[1].padStart(2,'0') : '';
}

function calendarDates_(e) {
  if (!e.allDay || e.endDateExclusive <= e.date) return [e.date];
  const dates = [], d = new Date(e.date + 'T12:00:00Z');
  const end = new Date(e.endDateExclusive + 'T12:00:00Z');
  while (d < end && dates.length < 31) {
    dates.push(d.toISOString().slice(0,10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

function classifyAnthonyEvent_(e) {
  const t = e.title.toLowerCase().trim();
  if (!t || /\btest only\b|\btest event\b/.test(t)) return 'ignore';
  if (/\bholiday\b|\baway\b|\btravel\b|\bdarts\b|\bbirthday\b|\bcar service\b|\bdoctor\b|\bdentist\b|\bchristmas party\b|\bmeeting\b|\bday off\b/.test(t))
    return 'ignore';
  if (/\bcomedy\b|\bcomedian\b|\bcompere\b|\bmc\b|\bopener\b|\bopening\b|\bmiddle\b|\bcloser\b|\bclosing\b|\bheadline\b|\bheadliner\b|\bstand.?up\b|\bgig\b|\bclub\b|\bwip\b|\blafternoon\b|\brecalculating\b|\bfunhouse\b|\bglee\b|\bjust the tonic\b|\bbelper\b|\bheanor\b|\bripley\b|\brockcentral\b|\bspiky\b/.test(t))
    return 'possible-gig';
  return 'unknown';
}

function compareAnthonyGigs_(events, rows, from, to) {
  const proposals = [];
  const start = Utilities.formatDate(from, ANTHONY_SYNC.timezone, 'yyyy-MM-dd');
  const end = Utilities.formatDate(to, ANTHONY_SYNC.timezone, 'yyyy-MM-dd');
  const relevantRows = rows.filter(r => r.date >= start && r.date <= end);
  let ignored = 0, uncertain = 0, datesAlreadyListed = 0;
  events.forEach(e => {
    const classification = classifyAnthonyEvent_(e);
    if (classification === 'ignore') { ignored++; return; }
    const dates = calendarDates_(e);
    const candidates = relevantRows.filter(r => dates.includes(r.date));
    if (classification === 'unknown') {
      uncertain++;
      proposals.push({
        action: 'REVIEW_UNCLASSIFIED_CALENDAR_ENTRY',
        dates, title: e.title, calendarLocation: e.location,
        matchingPublicRows: candidates.map(r => r.row)
      });
      return;
    }
    if (candidates.length) {
      datesAlreadyListed++;
      proposals.push({
        action: 'REVIEW_POSSIBLE_MATCH',
        dates, title: e.title, calendarLocation: e.location,
        matchingPublicRows: candidates.map(r => ({
          row: r.row, date: r.date, venue: r.venue, status: r.status
        })),
        note: 'A date match is NOT identity proof, especially for double gigs.'
      });
    } else {
      proposals.push({
        action: 'REVIEW_POSSIBLE_NEW_GIG',
        dates, title: e.title, calendarLocation: e.location,
        note: 'Do not publish or add to public sheet without review.'
      });
    }
  });
  return {
    mode: 'DRY_RUN_ONLY',
    matching: 'DATE_ONLY_FOR_REVIEW',
    generatedAt: new Date().toISOString(),
    window: {from: start, through: end},
    calendarEventsRead: events.length, publicGigRowsRead: rows.length,
    publicGigRowsInWindow: relevantRows.length, ignoredNonGigs: ignored,
    unclassifiedEvents: uncertain, dateCandidatesFound: datesAlreadyListed,
    proposedReviewItems: proposals.length,
    proposals,
    spreadsheetWrites: 0, calendarWrites: 0, websiteWrites: 0
  };
}

function testAnthonyGigSync() {
  const e = (title,date) => ({id:title,title,location:'Test Venue',
    date,allDay:false,endDateExclusive:date});
  const r = [{row:2,date:'2026-11-20',venue:'Public Venue',status:'Live',
    ticketUrl:'https://example.com/ticket',role:'MC'}];
  const from = new Date('2026-11-10T00:00:00Z');
  const to = new Date('2026-12-01T00:00:00Z');
  const report = events => compareAnthonyGigs_(events,r,from,to);
  const checks = {
    existingGigFlaggedForReview: report([e('MC Funhouse Comedy','2026-11-20')])
      .proposals[0].action === 'REVIEW_POSSIBLE_MATCH',
    newGigNotPublished: report([e('Closer comedy night','2026-11-21')])
      .proposals[0].action === 'REVIEW_POSSIBLE_NEW_GIG',
    personalAppointmentIgnored: report([e('Travel to Cardiff','2026-11-22')])
      .proposedReviewItems === 0,
    fakeTestIgnored: report([e('TEST ONLY - Comedy Club Booking','2026-11-17')])
      .proposedReviewItems === 0,
    noCalendarChanges: report([]).calendarWrites === 0,
    noSheetChanges: report([]).spreadsheetWrites === 0
  };
  if (Object.values(checks).some(v => !v))
    throw new Error('Fixture failure: ' + JSON.stringify(checks));
  Logger.log(JSON.stringify(checks,null,2));
  return checks;
}
