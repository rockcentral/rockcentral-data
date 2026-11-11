/**
 * ANTHONY WILLIAMS: AUTOMATIC PUBLIC GIG PUBLISHER
 * VERSION: 0.4.1 (11 November 2026)
 * Fix: postcode-and-address duplicate detection, including Wittering.
 *
 * Keeps existing public gig rows and ticket links unchanged.
 * Only publishes new gigs when a reliable public venue and town can be
 * extracted from the calendar's LOCATION field or a pre-verified catalogue.
 * Unknown/ambiguous gigs are NOT published, and no calendar-derived time
 * is represented as a show start. New unverified gigs are "Info soon".
 *
 * Requires Code.gs v0.2.2 and AnthonyPublicBridge v0.3.1.
 * Test before using any write/trigger function.
 */
const AW_PUBLISH_VERSION='0.4.1';
const AW_VERIFIED_GIGS=Object.freeze({
  // Researched against the promoter's own public event page.
  'mjvlc8pkv10181gbdce89drafg@google.com|slot:1': {
    date:'2027-02-26',time:'20:00',location:'Malton',
    venue:'The Milton Rooms',
    address:'2-4 Market Place, Malton, North Yorkshire, YO17 7LX',
    ticketUrl:'https://hilaritybites.co.uk/show/malton-february-26th-2027/',
    status:'Live',role:'MC',
    notes:'Hilarity Bites Comedy Club · Dom Woodward & Kelly Rickard'
  }
});

function awNormaliseVenue_(text) {
  return String(text||'').toLowerCase().replace(/[^a-z0-9]/g,'');
}
function awUKPostcode_(text) {
  const m=String(text||'').toUpperCase().match(/\b(?:GIR\s?0AA|(?:[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}))\b/);
  return m ? m[0].replace(/\s+/g,'') : '';
}
function awLikelySamePublicGig_(publicRow, d) {
  const oldVenue=awNormaliseVenue_(publicRow.venue);
  const newVenue=awNormaliseVenue_(d.venue);
  if(oldVenue && newVenue && oldVenue===newVenue) return true;
  const oldPostcode=awUKPostcode_(publicRow.address);
  const newPostcode=awUKPostcode_(d.address);
  if(oldPostcode && newPostcode && oldPostcode===newPostcode) return true;
  // Distinct public venue names can be alternate labels for the same building.
  // No automated write is allowed when the address is too ambiguous.
  return false;
}
function awRoleFromTitle_(title) {
  const t=String(title||'').toLowerCase();
  if (/\b(?:mc|compere|host)\b/.test(t)) return 'MC';
  if (/\b(?:opener|opening)\b/.test(t)) return 'Opener';
  if (/\bmiddle\b/.test(t)) return 'Middle';
  if (/\b(?:closer|closing|headliner|headline)\b/.test(t)) return 'Closer';
  return '';
}
function awPublicDetailsFromLocation_(row) {
  const v=row.v, title=v[AW_COL.title]||'';
  // Do not publish entries that represent multiple simultaneous shows.
  if (awCombinedBooking_({title})) return null;
  const location=String(v[AW_COL.location]||'');
  const chunks=location.split(',').map(x=>x.trim()).filter(Boolean);
  const postcode=/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i;
  if (chunks.length<3 || !postcode.test(chunks[chunks.length-1])) return null;
  const role=awRoleFromTitle_(title);
  if (!role) return null;
  const venue=chunks[0], postcodeChunk=chunks[chunks.length-1];
  // For structured "Venue, Town, Postcode" or "Venue, Street, Town, Postcode"
  // do not guess when longer or ambiguous geographic parts are supplied.
  if (chunks.length>4) return null;
  const town=chunks[chunks.length-2];
  if (!venue || !town || !/^[A-Za-z][A-Za-z '\-]{2,}$/.test(town) ||
      /\b(?:road|street|lane|avenue|close|way)\b/i.test(town)) return null;
  return {
    date:v[AW_COL.date],time:'',location:town,venue,
    address:location,ticketUrl:'',status:'Info soon',role,
    notes:'Comedy night · more information to follow'
  };
}
function awAutoPublicDetails_(row) {
  const v=row.v,key=v[AW_COL.key];
  if(v[AW_COL.sync]!=='Active' || v[AW_COL.date]<awIso_(new Date())) return null;
  if(/\b(?:test|fixture)\b/i.test(v[AW_COL.title]||'') ||
    /\b(?:cancelled|canceled|tentative|provisional|hold)\b/i.test(v[AW_COL.title]||''))return null;
  const verified=AW_VERIFIED_GIGS[key];
  if(verified) return {...verified};
  return awPublicDetailsFromLocation_(row);
}
function awAutoPublishPlan_(workingRows,publicRows) {
  const plan=[],held=[];
  workingRows.forEach(row=>{
    const v=row.v,key=v[AW_COL.key];
    if(v[AW_COL.sync]!=='Active' || v[AW_COL.date]<awIso_(new Date())) return;
    const d=awAutoPublicDetails_(row);
    if(!d){held.push({privateRow:row.sheetRow,date:v[AW_COL.date],reason:'Insufficient verified public details'});return;}
    const sameDate=publicRows.filter(x=>x.date===d.date);
    // Same date, different venue: safe to add if venue is unambiguous;
    // exact same venue already on public feed: skip, never edit existing row.
    if(sameDate.some(x=>awLikelySamePublicGig_(x,d)))return;
    if(sameDate.some(x=>!x.venue || !x.location || 
        (awNormaliseVenue_(x.location)===awNormaliseVenue_(d.location) &&
         !x.venue))) {
      held.push({privateRow:row.sheetRow,date:d.date,reason:'Ambiguous existing public booking on same date'});
      return;
    }
    plan.push({key,privateRow:row.sheetRow,public:d});
  });
  return {plan,held};
}
function previewAnthonyAutoPublisher() {
  const r=awAutoPublishPlan_(awReadRegister_().rows,awReadPublicFeed_());
  const report={
    version:AW_PUBLISH_VERSION,mode:'PREVIEW_NO_WRITES',
    wouldAdd:r.plan.length,holdForReview:r.held.length,
    proposedRows:r.plan.slice(0,20),
    heldSample:r.held.slice(0,15),
    publicSheetWrites:0,calendarWrites:0
  };
  Logger.log(JSON.stringify(report,null,2));
  return report;
}
function awPublicRowsForWrite_(items) {
  return items.map(item=>{
    const d=item.public;
    return [d.date,d.time,d.location,d.venue,d.address,
      d.ticketUrl,d.status,d.role,d.notes];
  });
}
/**
 * Manually invocable, or called by a time trigger AFTER validation.
 * Appends ONLY brand new rows, never overwrites existing public listings.
 */
function publishAnthonyConfirmedGigs() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(15000))throw new Error('Another publisher is running');
  try {
    const spreadsheet=SpreadsheetApp.openById(AW_PUBLIC_FEED.sheetId);
    const sheet=spreadsheet.getSheetByName(AW_PUBLIC_FEED.tab);
    const current=awReadPublicFeed_();
    const p=awAutoPublishPlan_(awReadRegister_().rows,current);
    const batch=awPublicRowsForWrite_(p.plan);
    if(batch.length)
      sheet.getRange(sheet.getLastRow()+1,1,batch.length,9).setValues(batch);
    const report={
      version:AW_PUBLISH_VERSION,mode:'PUBLICATION_OF_CONFIDENT_NEW_GIGS_ONLY',
      added:batch.length,held:p.held.length,
      existingPublicRowsChanged:0,calendarWrites:0,
      publishedRows:p.plan.map(x=>({key:x.key,date:x.public.date,venue:x.public.venue}))
    };
    Logger.log(JSON.stringify(report,null,2));
    return report;
  }finally{lock.releaseLock();}
}
function dailyAnthonyGigWorkflow() {
  // Calendar sync writes private source fields. Public publisher only adds
  // gigs with independently verified or sufficiently structured details.
  const privateResult=syncAnthonyCalendarToRegister();
  const publicResult=publishAnthonyConfirmedGigs();
  Logger.log(JSON.stringify({
    version:AW_PUBLISH_VERSION,
    privateAdded:privateResult.added,publicAdded:publicResult.added,
    needsReview:publicResult.held
  },null,2));
}
/** Install exactly one 6am London trigger, only after testing in production. */
function enableAnthonyDailyGigWorkflow() {
  const fn='dailyAnthonyGigWorkflow';
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===fn)
    .forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger(fn).timeBased().everyDays(1).atHour(6)
    .inTimezone('Europe/London').create();
  Logger.log('Installed 6am Europe/London daily workflow, version '+AW_PUBLISH_VERSION);
}
function testAnthonyAutoPublisher() {
  const row=(key,title,date,location)=>({
    sheetRow:2,
    v:(()=>{
      const v=Array(AW_SYNC.columns).fill('');
      v[AW_COL.key]=key;v[AW_COL.title]=title;v[AW_COL.date]=date;
      v[AW_COL.location]=location;v[AW_COL.sync]='Active';return v;
    })()
  });
  const d='2027-02-26';
  const malton=row('mjvlc8pkv10181gbdce89drafg@google.com|slot:1',
    'Hilarity Bites - Milton Rooms - MC',d,'The Milton Rooms, Market Place, Malton, YO17 7LX');
  const normal=row('other','MC Comedy Night', '2027-05-20','Town Hall, Lancaster, LA1 1AA');
  const privateFixture=row('fixture','GIG Fixture Comedy Club','2027-05-20','Town Hall, Lancaster, LA1 1AA');
  const published={date:d,venue:'The Milton Rooms',location:'Malton',sheetRow:3};
  const checks={
    verifiedMaltonHasProperStart:awAutoPublicDetails_(malton).time==='20:00',
    publicMaltonNotDuplicated:awAutoPublishPlan_([malton],[published]).plan.length===0,
    structuredGigInfoSoon:awAutoPublicDetails_(normal)?.status==='Info soon',
    noInventedStartTime:awAutoPublicDetails_(normal)?.time==='',
    testGigsHeld:awAutoPublicDetails_(privateFixture)===null,
    noVenueMeansNoPublish:awAutoPublicDetails_(row('x','MC Comedy Night','2027-05-20',''))===null,
    otherSameDateGigCanCoexist:awAutoPublishPlan_([normal],[published]).plan.length===1,
    repeatIdempotent:awAutoPublishPlan_([normal],[{date:normal.v[AW_COL.date],
      venue:'Town Hall',location:'Lancaster'}]).plan.length===0,
    witteringPostcodeDuplicateBlocked:awAutoPublishPlan_([
      row('wittering','MC – Hats Funny Comedy, Wittering SAS Club','2026-11-14',
        'Wittering Parish Hall, Peterborough, PE8 6BD')
    ],[{
      date:'2026-11-14',venue:'Wittering SAS Club (Parish Hall)',
      address:'Wittering Parish Hall, Peterborough, PE8 6BD',
      location:'Wittering'
    }]).plan.length===0,
    thornburyNewListingStillProposed:awAutoPublishPlan_([
      row('thornbury','Armstrong Theatre Thornbury - Clean opener 20','2027-08-27',
        'The Armstrong Theatre, Thornbury, Bristol BS35 2BJ')
    ],[]).plan.length===1,
    sameDateDifferentPostcodesAllowed:awAutoPublishPlan_([normal],[{
      date:'2027-05-20',venue:'Other Hall',location:'Lancaster',
      address:'Somewhere else, Lancaster, LA1 2ZZ'
    }]).plan.length===1
  };
  Logger.log(JSON.stringify({version:AW_PUBLISH_VERSION,checks},null,2));
  if(Object.values(checks).some(x=>!x))
    throw new Error('Auto publisher fixture failed: '+JSON.stringify(checks));
  return checks;
}
