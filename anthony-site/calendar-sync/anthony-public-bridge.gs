/**
 * ANTHONY WILLIAMS: PUBLIC GIG FEED RECONCILIATION
 * VERSION: 0.3.0 (11 November 2026)
 * Added: read-only cross-check between PRIVATE working register and
 *        existing LIVE public gig sheet, without touching live data.
 *
 * Install as a SECOND script file in the Anthony Calendar Gig Sync project.
 * Requires Code.gs v0.2.2 or later, including AW_SYNC and AW_COL.
 *
 * ONLY run previewAnthonyPublicFeedMatches() / testAnthonyPublicFeedMatches().
 * THERE ARE NO WRITE FUNCTIONS IN THIS FILE.
 */
const AW_PUBLIC_BRIDGE_VERSION = '0.3.0';
const AW_PUBLIC_FEED = Object.freeze({
  sheetId:'12fHnBXl7DU5i0vKiXlMTHRGLUWCSwvDLvmXR_2-Xzp8',
  tab:'Public Gigs'
});
const AW_PUBLIC_HEADERS = [
  'Date','Time','Location','Venue','Address','Ticket URL','Status','Role','Notes'
];

function awReadPublicFeed_() {
  const ss = SpreadsheetApp.openById(AW_PUBLIC_FEED.sheetId);
  const sheet = ss.getSheetByName(AW_PUBLIC_FEED.tab);
  if (!sheet) throw new Error('Expected public feed tab missing. Stopped.');
  const data = sheet.getDataRange().getDisplayValues();
  if (!data.length || AW_PUBLIC_HEADERS.some((h,i)=>data[0][i]!==h))
    throw new Error('Public feed header mismatch. Stopped.');
  return data.slice(1).map((v,i)=>({
    sheetRow:i+2,date:String(v[0]||'').trim(),
    time:v[1]||'',location:v[2]||'',venue:v[3]||'',
    address:v[4]||'',ticketUrl:v[5]||'',status:v[6]||'',
    role:v[7]||'',notes:v[8]||''
  })).filter(r=>r.date);
}
function awPublicTokenize_(text) {
  const stop = new Set(['the','club','comedy','gig','for','with','and','at',
    'of','a','in','to','live','night','mc','open','opening','middle',
    'closer','closing','room','funhouse','rockcentral','promotions']);
  return String(text||'').toLowerCase()
    .replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(x=>x.length>2 && !stop.has(x));
}
function awPublicMatch_(row,publicRows) {
  const date = row.v[AW_COL.date];
  const candidates = publicRows.filter(x=>x.date===date);
  if (!candidates.length) return {classification:'NOT_IN_PUBLIC_FEED',matches:[]};
  if (candidates.length>1) return {
    classification:'MULTIPLE_PUBLIC_GIGS_SAME_DATE',
    matches:candidates.map(x=>x.sheetRow)
  };
  const one = candidates[0];
  // Date-only matching is a possibility, NEVER proof.
  const calendarTokens = new Set(awPublicTokenize_(row.v[AW_COL.title]+' '+
    row.v[AW_COL.location]));
  const publicTokens = awPublicTokenize_(one.venue+' '+one.location+' '+one.notes);
  const shared = publicTokens.filter(x=>calendarTokens.has(x));
  return {
    classification:shared.length
      ? 'POSSIBLE_SAME_GIG_REVIEW' : 'SAME_DATE_IDENTITY_UNVERIFIED',
    matches:[one.sheetRow],sharedWords:[...new Set(shared)].slice(0,6),
    publicStatus:one.status,
    hasPublicTicketUrl:!!one.ticketUrl
  };
}
function awReconcilePublic_(workingRows,publicRows,today) {
  const futureWorking=workingRows.filter(r=>
    r.v[AW_COL.date]>=today &&
    r.v[AW_COL.sync]==='Active' &&
    !/\bfixture\b|\btest\b/i.test(r.v[AW_COL.title]||'')
  );
  const futurePublic=publicRows.filter(r=>r.date>=today);
  const reviews=futureWorking.map(r=>({
    privateRow:r.sheetRow,
    date:r.v[AW_COL.date],
    privateCalendarTitle:r.v[AW_COL.title],
    ...awPublicMatch_(r,futurePublic)
  }));
  const counts={};
  reviews.forEach(r=>{counts[r.classification]=(counts[r.classification]||0)+1;});
  const workingDates=new Set(futureWorking.map(r=>r.v[AW_COL.date]));
  const publicWithoutSameDate=futurePublic
    .filter(r=>!workingDates.has(r.date))
    .map(r=>({date:r.date,publicRow:r.sheetRow,venue:r.venue,status:r.status}));
  return {
    version:AW_PUBLIC_BRIDGE_VERSION,
    mode:'READ_ONLY_RECONCILIATION',
    privateFutureRows:futureWorking.length,
    publicFutureRows:futurePublic.length,
    privateMatchCounts:counts,
    publicRowsWithoutDateCandidate:publicWithoutSameDate.length,
    publicWithoutDateSample:publicWithoutSameDate.slice(0,12),
    privateReviewSample:reviews.slice(0,12),
    morePrivateReviewsNotShown:Math.max(0,reviews.length-12),
    warning:'Date/word overlap is never proof. No import, approval or publishing occurs.',
    workingRegisterWrites:0,publicFeedWrites:0,websiteWrites:0
  };
}
function previewAnthonyPublicFeedMatches() {
  const working=awReadRegister_().rows;
  const publicRows=awReadPublicFeed_();
  const today=awIso_(new Date());
  const report=awReconcilePublic_(working,publicRows,today);
  Logger.log(JSON.stringify(report,null,2));
  return report;
}
function testAnthonyPublicFeedMatches() {
  const privateRow=(row,date,title)=>({
    sheetRow:row, v:(()=>{
      const v=Array(AW_SYNC.columns).fill('');
      v[AW_COL.date]=date;v[AW_COL.title]=title;
      v[AW_COL.sync]='Active';return v;
    })()
  });
  const publicRow=(row,date,venue,notes='')=>({
    sheetRow:row,date,venue,notes,location:'Derby',status:'Live',ticketUrl:'https://example.com'
  });
  const date='2027-03-12';
  const sample=privateRow(2,date,'GIG Derby Comedy at Venue A');
  const same=publicRow(2,date,'Venue A','Derby comedy');
  const different=publicRow(3,date,'Venue B','Different promoter');
  const checks={
    sharedContextStillNeedsReview:
      awPublicMatch_(sample,[same]).classification==='POSSIBLE_SAME_GIG_REVIEW',
    sameDateNeverAutoApproved:
      awPublicMatch_(sample,[different]).classification==='SAME_DATE_IDENTITY_UNVERIFIED',
    doublePublicDateHeld:
      awPublicMatch_(sample,[same,different]).classification==='MULTIPLE_PUBLIC_GIGS_SAME_DATE',
    missingPublicDateDetected:
      awPublicMatch_(sample,[]).classification==='NOT_IN_PUBLIC_FEED',
    pastPrivateExcluded:
      awReconcilePublic_([privateRow(3,'2026-11-05','GIG OLD')],[], '2026-11-11')
        .privateFutureRows===0,
    noWriteActions:
      awReconcilePublic_([sample],[same],'2026-11-11').publicFeedWrites===0
  };
  Logger.log(JSON.stringify({version:AW_PUBLIC_BRIDGE_VERSION,checks},null,2));
  if(Object.values(checks).some(v=>!v))
    throw new Error('Reconciliation fixture failure: '+JSON.stringify(checks));
  return checks;
}
