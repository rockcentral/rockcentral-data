/**
 * ANTHONY WILLIAMS: PRIVATE GIG CALENDAR SYNC
 * VERSION: 0.2.6 (11 November 2026)
 * Changes: private descriptions and states; preserve prior approvals on first migration.
 * Every run logs the version. If the log shows another version, the
 * latest script has not been pasted/saved in Apps Script.
 * Calendar is source of incoming bookings. This does NOT touch
 * the public website, the published feed, or calendar entries.
 *
 * IMPORTANT: The live "Gigs" calendar contains personal entries.
 * Only likely gig titles are imported. Other titles are reported
 * as skipped, not automatically copied to any public listing.
 *
 * Run testAnthonyCalendarSyncRules, then previewAnthonyCalendarSync,
 * then syncAnthonyCalendarToRegister to import privately.
 */
const ANTHONY_SYNC_VERSION = '0.2.6';

const AW_SYNC = Object.freeze({
  calendarId: 'c_0e0019db66d2f8790454b5a421ca31d9f8c938902045761a39e1679dfd87b9fc@group.calendar.google.com',
  workingSheetId: '1f-pkmgRWbZObOkv1o0lBeHKo8CEI75WKczG6NCcSmuE',
  tab: 'Gig Register',
  timezone: 'Europe/London',
  daysBehind: 0,
  daysAhead: 400,
  columns: 23
});

const AW_COL = Object.freeze({
  key:0, id:1, date:2, endDate:3, title:4, location:5, time:6,
  allDay:7, sync:8, review:9, publish:10, publicTitle:11,
  publicVenue:12, publicLocation:13, publicTime:14, ticketUrl:15,
  ticketStatus:16, firstSeen:17, lastSeen:18, missingSince:19, note:20,
  description:21, bookingState:22
});

const AW_HEADERS = [
  'Performance Key','Calendar iCalUID','Performance Date','Calendar End Date',
  'Calendar Title','Calendar Location','Calendar Start','All Day?',
  'Sync Status','Review Status','Publish?','Public Show Title',
  'Public Venue','Public Location','Public Time','Ticket URL',
  'Ticket Status','First Seen','Last Seen','Missing Since','Internal Notes',
  'Calendar Description','Booking State'
];

function awIso_(date) {
  return Utilities.formatDate(date, AW_SYNC.timezone, 'yyyy-MM-dd');
}
function awStamp_() {
  return Utilities.formatDate(new Date(), AW_SYNC.timezone, 'yyyy-MM-dd HH:mm');
}
function awNextDay_(iso) {
  const date = new Date(iso + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate()+1);
  return date.toISOString().slice(0,10);
}
function awCalendar_() {
  const calendar = CalendarApp.getCalendarById(AW_SYNC.calendarId);
  if (!calendar) throw new Error('Cannot access private Gigs calendar');
  return calendar;
}
function awWindow_() {
  const now = new Date();
  // Apps Script project timezone is Europe/London (appsscript.json).
  // Start at local midnight rather than seven days ago or the current hour.
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from);
  to.setDate(to.getDate() + AW_SYNC.daysAhead);
  return { from, to };
}
function awReadEvents_(from, to) {
  return awCalendar_().getEvents(from, to).map(event => {
    const allDay = event.isAllDayEvent();
    const start = allDay ? event.getAllDayStartDate() : event.getStartTime();
    const finish = allDay ? event.getAllDayEndDate() : event.getEndTime();
    return {
      id: event.getId(),
      title: (event.getTitle() || '').trim(),
      location: (event.getLocation() || '').trim(),
      description: (event.getDescription() || '').trim(),
      date: awIso_(start),
      endDate: awIso_(finish),
      time: allDay ? '' : Utilities.formatDate(start, AW_SYNC.timezone,'HH:mm'),
      allDay: allDay
    };
  });
}
function awBookingState_(event) {
  const title=(event.title||'').trim();
  if(/^CANCELLED\s*[-:]/i.test(title))return 'Cancelled';
  if(/^HOLD\s*[-:]/i.test(title))return 'Hold';
  return 'Confirmed';
}
function awCombinedBooking_(event) {
  const t = (event.title || '').toLowerCase();
  return /\bdouble\b|\bdouble.?header\b|\bdouble.?gig\b/.test(t);
}
function awClassify_(event) {
  const title = (event.title || '').toLowerCase();
  if (!title || /\btest\b|\bholiday\b|\baway\b|\btravel\b|\bdarts\b|\bbirthday\b|\bcar service\b|\bdoctor\b|\bdentist\b|\b(?:xmas|christmas)\s+party\b|\bmeeting\b|\bday off\b|\bopen day\b|\bdawn\s+mc\b|\bdates placeholder\b|\bplaceholder\b/.test(title))
    return 'skip';
  if (/^(?:gig|hold|cancelled)\s*[-:]/.test(title))return 'gig';
  if (/\bcomedy\b|\bcomedian\b|\bcompere\b|\bmc\b|\bopener\b|\bopening\b|\bmiddle\b|\bcloser\b|\bclosing\b|\bheadline\b|\bheadliner\b|\bstand.?up\b|\bgig\b|\bclub\b|\bwip\b|\blafternoon\b|\brecalculating\b|\bfunhouse\b|\bglee\b|\bjust the tonic\b|\bbelper\b|\bheanor\b|\bripley\b|\brockcentral\b|\bspiky\b|\bspirit of comedy\b/.test(title))
    return 'gig';
  if (/\b\d{1,2}\s+(?:for|mins?|minutes?)\b|\b(?:nik hill|marty riley|red redmond|steve blood|james beckett|stu napier)\b|\broyal standard\b|\brailway variety\b/.test(title)) return 'gig';
  return 'uncertain';
}
function awDates_(event) {
  if (!event.allDay || event.endDate <= event.date) return [event.date];
  const dates = [];
  let d = event.date;
  while (d < event.endDate && dates.length < 32) {
    dates.push(d);
    d = awNextDay_(d);
  }
  return dates;
}
function awSourceRows_(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length || AW_HEADERS.some((h,i) => values[0][i] !== h))
    throw new Error('Working register header mismatch. No writes performed.');
  return values.slice(1).map((v,i)=>({sheetRow:i+2, v}))
    .filter(x => x.v[AW_COL.key] && x.v[AW_COL.id]);
}
function awReadRegister_() {
  const spreadsheet = SpreadsheetApp.openById(AW_SYNC.workingSheetId);
  const sheet = spreadsheet.getSheetByName(AW_SYNC.tab);
  if (!sheet) throw new Error('Gig Register tab not found');
  return { sheet, rows: awSourceRows_(sheet) };
}

/**
 * Pure reconciliation logic. A stable iCalUID + slot index identifies
 * performances independently of performance date. This supports moves,
 * deletes, restores and multiple distinct bookings on the same date.
 * Recurring events sharing an iCalUID are withheld until manually reviewed.
 */
function awPlan_(events, stored, fromIso, toIso) {
  const source = events.filter(e => awClassify_(e) === 'gig' && e.id);
  const idCount = {};
  source.forEach(e => { idCount[e.id] = (idCount[e.id] || 0) + 1; });
  const ambiguousIds = new Set(Object.keys(idCount).filter(id => idCount[id] > 1));
  const combinedEvents = source.filter(awCombinedBooking_);
  const combinedIds = new Set(combinedEvents.map(e => e.id));
  const existing = new Map(stored.map(x => [x.v[AW_COL.key],x]));
  const seen = new Set();
  const operations = [];
  const stamp = awStamp_();
  source.forEach(e => {
    if (ambiguousIds.has(e.id) || combinedIds.has(e.id)) return;
    const dates = awDates_(e);
    dates.forEach((date,slot) => {
      // A multi-day calendar event may start before today.
      // Only sync performances within the current/future window.
      if (date < fromIso || date >= toIso) return;
      const key = e.id + '|slot:' + (slot+1);
      seen.add(key);
      const old = existing.get(key);
      if (!old) {
        const value = Array(AW_SYNC.columns).fill('');
        value[AW_COL.key] = key;
        value[AW_COL.id] = e.id;
        value[AW_COL.date] = date;
        value[AW_COL.endDate] = e.endDate;
        value[AW_COL.title] = e.title;
        value[AW_COL.location] = e.location;
        value[AW_COL.time] = e.time;
        value[AW_COL.allDay] = e.allDay ? 'Yes' : 'No';
        value[AW_COL.sync] = 'Active';
        value[AW_COL.review] = 'Needs review';
        value[AW_COL.publish] = 'No';
        value[AW_COL.ticketStatus] = 'Info soon';
        value[AW_COL.firstSeen] = stamp;
        value[AW_COL.lastSeen] = stamp;
        value[AW_COL.note] = 'Imported from private calendar; not approved for website';
        value[AW_COL.description] = e.description || '';
        value[AW_COL.bookingState] = awBookingState_(e);
        if(value[AW_COL.bookingState]!=='Confirmed')value[AW_COL.sync]=value[AW_COL.bookingState];
        operations.push({action:'ADD_PRIVATE',key, date, title:e.title, value});
        return;
      }
      const v = old.v;
      const dateChanged = v[AW_COL.date] !== date;
      const sourceChanged = dateChanged ||
        v[AW_COL.endDate] !== e.endDate ||
        v[AW_COL.title] !== e.title ||
        v[AW_COL.location] !== e.location ||
        v[AW_COL.time] !== e.time ||
        v[AW_COL.allDay] !== (e.allDay ? 'Yes' : 'No') ||
        v[AW_COL.description] !== (e.description||'') ||
        v[AW_COL.bookingState] !== awBookingState_(e) ||
        v[AW_COL.sync] !== (awBookingState_(e)==='Confirmed'?'Active':awBookingState_(e));
      if (sourceChanged) operations.push({
        action:dateChanged?'REVIEW_MOVED':'UPDATE_SOURCE',sheetRow:old.sheetRow,
        key, dateBefore:v[AW_COL.date],dateAfter:date,title:e.title,
        event:e, dateChanged,
        migrationOnly:!dateChanged && !v[AW_COL.bookingState] && !v[AW_COL.description] &&
          v[AW_COL.endDate]===e.endDate && v[AW_COL.title]===e.title &&
          v[AW_COL.location]===e.location && v[AW_COL.time]===e.time &&
          v[AW_COL.allDay]===(e.allDay?'Yes':'No') && v[AW_COL.sync]==='Active' &&
          awBookingState_(e)==='Confirmed'
      });
    });
  });
  stored.forEach(old => {
    const v = old.v, id = v[AW_COL.id], date = v[AW_COL.date];
    if (date < fromIso || date >= toIso || ambiguousIds.has(id) || combinedIds.has(id)) return;
    if (!seen.has(v[AW_COL.key]) && v[AW_COL.sync] !== 'Missing from calendar')
      operations.push({
        action:'FLAG_MISSING',sheetRow:old.sheetRow,
        key:v[AW_COL.key],date,title:v[AW_COL.title]
      });
  });
  const unknown = events.filter(e => awClassify_(e) === 'uncertain')
    .map(e=>({date:e.date,title:e.title}));
  return {
    mode:'PREVIEW_OR_PRIVATE_IMPORT',calendarEventsRead:events.length,
    classifiedGigEvents:source.length, uncertainCalendarEvents:unknown,
    recurringUidConflicts:[...ambiguousIds],
    combinedBookingsForReview:combinedEvents.map(e=>({date:e.date,title:e.title})),
    actions:operations,
    note:'No action ever writes public website fields or the public feed.'
  };
}
function awBuildPlan_() {
  const window = awWindow_();
  const events = awReadEvents_(window.from, window.to);
  const r = awReadRegister_();
  return {
    plan:awPlan_(events,r.rows,awIso_(window.from),awIso_(window.to)),
    sheet:r.sheet
  };
}
function previewAnthonyCalendarSync() {
  const p = awBuildPlan_().plan;
  const changes = p.actions.map(({value,event,...other})=>other);
  const counts = {};
  changes.forEach(x=>{ counts[x.action]=(counts[x.action]||0)+1; });
  const report = {
    version:ANTHONY_SYNC_VERSION,
    mode:'DRY_RUN_NO_WRITES',calendarEventsRead:p.calendarEventsRead,
    classifiedGigEvents:p.classifiedGigEvents,
    plannedChangeCounts:counts,
    changesSample:changes.slice(0,12),
    moreChangesNotShown:Math.max(0,changes.length-12),
    uncertainEventCount:p.uncertainCalendarEvents.length,
    uncertainEventSample:p.uncertainCalendarEvents.slice(0,12),
    recurringUidConflicts:p.recurringUidConflicts,
    combinedBookingsForReview:p.combinedBookingsForReview,
    spreadsheetWrites:0,websiteWrites:0,calendarWrites:0
  };
  Logger.log(JSON.stringify(report,null,2));
  return p;
}

/** Manual beta import: only private working-register source columns. */
function syncAnthonyCalendarToRegister() {
  const lock=LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Sync in progress');
  try {
    // Rebuild under lock: avoids duplicates on repeated runs.
    const result=awBuildPlan_(), plan=result.plan, sheet=result.sheet;
    const add=plan.actions.filter(x=>x.action==='ADD_PRIVATE');
    const edits=plan.actions.filter(x=>x.action!=='ADD_PRIVATE');
    if (add.length) {
      sheet.getRange(sheet.getLastRow()+1,1,add.length,AW_SYNC.columns)
        .setValues(add.map(x=>x.value));
    }
    const stamp=awStamp_();
    edits.forEach(item=>{
      const row=item.sheetRow;
      if(item.action==='FLAG_MISSING') {
        sheet.getRange(row,AW_COL.sync+1).setValue('Missing from calendar');
        sheet.getRange(row,AW_COL.review+1).setValue('Missing from calendar');
        sheet.getRange(row,AW_COL.missingSince+1).setValue(stamp);
      } else {
        const e=item.event;
        sheet.getRange(row,AW_COL.date+1,1,AW_COL.allDay-AW_COL.date+1)
          .setValues([[item.dateAfter,e.endDate,e.title,e.location,
                        e.time,e.allDay?'Yes':'No']]);
        sheet.getRange(row,AW_COL.description+1,1,2)
          .setValues([[e.description||'',awBookingState_(e)]]);
        sheet.getRange(row,AW_COL.sync+1)
          .setValue(awBookingState_(e)==='Confirmed'?'Active':awBookingState_(e));
        sheet.getRange(row,AW_COL.lastSeen+1).setValue(stamp);
        sheet.getRange(row,AW_COL.missingSince+1).clearContent();
        if(item.dateChanged) sheet.getRange(row,AW_COL.review+1).setValue('Date changed');
        else if(item.action==='UPDATE_SOURCE') {
          // One-off first import of new private V/W columns should not
          // revoke existing reviewed public details. Genuine later
          // changes still require renewed review.
          if(!item.migrationOnly)
            sheet.getRange(row,AW_COL.review+1).setValue('Needs review');
        }
      }
    });
    const report={
      version:ANTHONY_SYNC_VERSION,
      mode:'PRIVATE_REGISTER_ONLY',calendarEventsRead:plan.calendarEventsRead,
      added:add.length,moved:edits.filter(x=>x.action==='REVIEW_MOVED').length,
      sourceUpdated:edits.filter(x=>x.action==='UPDATE_SOURCE').length,
      missingFlagged:edits.filter(x=>x.action==='FLAG_MISSING').length,
      recurringUidConflicts:plan.recurringUidConflicts,
      combinedBookingsHeld:plan.combinedBookingsForReview.length,
      uncertainEventCount:plan.uncertainCalendarEvents.length,
      publicFieldsWritten:0,websiteWrites:0,calendarWrites:0
    };
    Logger.log(JSON.stringify(report,null,2));
    return Object.assign({},report,{changedKeys:edits.map(x=>x.key)});
  } finally {lock.releaseLock();}
}

/** Does not read or write Google Calendar or Sheets. */
function testAnthonyCalendarSyncRules() {
  const event=(id,date,title='MC Funhouse Comedy')=>({
    id,date,title,location:'Room',time:'19:00',allDay:false,endDate:date
  });
  const empty=[];
  const p=(events,stored)=>awPlan_(events,stored,'2026-11-11','2027-12-01');
  const first=p([event('one','2026-11-18')],empty).actions[0];
  const existing={sheetRow:2,v:first.value};
  const same=p([event('one','2026-11-18')],[existing]).actions;
  const moved=p([event('one','2026-11-19')],[existing]).actions;
  const missing=p([],[existing]).actions;
  const secondSameDate=p([event('one','2026-11-18'),event('two','2026-11-18')],empty).actions;
  const test=p([event('test','2026-11-18','TEST ONLY - Gig')],empty).actions;
  const restored=p([event('one','2026-11-18')],[{
    sheetRow:2,v:Object.assign([...first.value],{[AW_COL.sync]:'Missing from calendar'})
  }]).actions;
  const checks={
    addPrivateOnly:first.action==='ADD_PRIVATE'&&
      first.value[AW_COL.publish]==='No'&&first.value[AW_COL.ticketUrl]==='',
    repeatNoDuplicate:same.length===0,
    moveSameKey:moved.length===1&&moved[0].action==='REVIEW_MOVED'&&
      moved[0].key===first.key,
    deletionFlagNotDelete:missing.length===1&&missing[0].action==='FLAG_MISSING',
    sameDateSeparateKeys:secondSameDate.length===2&&
      secondSameDate[0].key!==secondSameDate[1].key,
    testExcluded:test.length===0,
    restoredDetected:restored.length===1&&restored[0].action==='UPDATE_SOURCE',
    combinedBookingHeld:p([event('double','2026-11-18','Caves / Duffield - RockCentral Promotions (double)')],empty).actions.length===0,
    genuineUnknownFormatRecognised:p([event('short','2026-11-18','20 for Marty Riley in Hudds')],empty).actions.length===1,
    partyExcluded:p([event('party','2026-11-18','Funhouse Xmas party')],empty).actions.length===0,
    placeholderExcluded:p([event('placeholder','2026-11-18','ICF Leicester dates placeholder')],empty).actions.length===0,
    blueMonkeySingleGig:p([event('blue','2027-02-28','GIG - Blue Monkey / MC')],empty).actions.length===1,
    pastGigNotImported:awPlan_([event('old','2026-11-05')],empty,'2026-11-11','2027-12-01').actions.length===0,
    todayGigIncluded:awPlan_([event('today','2026-11-11')],empty,'2026-11-11','2027-12-01').actions.length===1,
    holdImportsPrivately:awPlan_([event('hold','2026-11-18','HOLD - Gloucester - MC')],empty,'2026-11-11','2027-12-01').actions[0].value[AW_COL.sync]==='Hold',
    cancelledImportsPrivately:awPlan_([event('cancelled','2026-11-18','CANCELLED - Gloucester - MC')],empty,'2026-11-11','2027-12-01').actions[0].value[AW_COL.sync]==='Cancelled',
    calendarDescriptionStored:(()=>{const e=event('desc','2026-11-18');e.description='Promoter: Example';return awPlan_([e],empty,'2026-11-11','2027-12-01').actions[0].value[AW_COL.description]==='Promoter: Example';})()
  };
  Logger.log(JSON.stringify({version:ANTHONY_SYNC_VERSION,checks},null,2));
  if(Object.values(checks).some(v=>!v))
    throw new Error('Fixture failure '+JSON.stringify(checks));
  return checks;
}
