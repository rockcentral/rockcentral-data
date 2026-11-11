/**
 * ANTHONY WILLIAMS: REGISTER-LED PUBLIC PUBLISHER
 * VERSION: 0.5.3 (11 November 2026)
 *
 * No venue, show, time or ticket information is hardcoded here.
 * Private register is the source for APPROVED public fields.
 * Public sheet columns A:I remain exactly as the live website expects.
 * Column J stores a SHA-256-derived opaque link, never raw calendar IDs.
 *
 * Requires Code.gs v0.2.2 and AnthonyPublicBridge v0.3.1.
 * Replaces AnthonyAutoPublisher v0.4.2; do NOT retain both scripts.
 * No automatic trigger in v0.5.0. Test + preview before first write.
 */
const AW_REGISTER_PUBLISH_VERSION='0.5.3';
const AW_PUBLIC_KEY_HEADER='Listing Sync ID';
function awV05OpaqueId_(rawKey) {
  const digest=Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, String(rawKey||''));
  return digest.map(x=>('0'+(x&255).toString(16)).slice(-2)).join('');
}

function awV05Clean_(v) {return String(v===null||v===undefined?'':v).trim();}
function awV05Venue_(v) {return awV05Clean_(v).toLowerCase().replace(/[^a-z0-9]/g,'');}
function awV05Postcode_(v) {
  const m=awV05Clean_(v).toUpperCase().match(/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/);
  return m?m[0].replace(/\s+/g,''):'';
}
function awV05Role_(title) {
  const t=awV05Clean_(title).toLowerCase();
  const hits=[
    [/\b(?:mc|compere|host)\b/,'MC'],
    [/\b(?:opener|opening)\b/,'Opener'],
    [/\bmiddle\b/,'Middle'],
    [/\b(?:closer|closing|headliner|headline)\b/,'Closer']
  ].filter(x=>x[0].test(t));
  return hits.length===1?hits[0][1]:'';
}
function awV05PublicRows_(sheet) {
  const data=sheet.getDataRange().getDisplayValues();
  if(!data.length ||
      AW_PUBLIC_HEADERS.some((header,i)=>data[0][i]!==header) ||
      data[0][9]!==AW_PUBLIC_KEY_HEADER)
    throw new Error('Public sheet A:J headers do not match v0.5.0 contract.');
  return data.slice(1).map((v,i)=>({
    row:i+2,date:awV05Clean_(v[0]),time:awV05Clean_(v[1]),
    location:awV05Clean_(v[2]),venue:awV05Clean_(v[3]),
    address:awV05Clean_(v[4]),url:awV05Clean_(v[5]),
    status:awV05Clean_(v[6]),role:awV05Clean_(v[7]),
    notes:awV05Clean_(v[8]),key:awV05Clean_(v[9])
  })).filter(x=>x.date||x.key);
}
function awV05Read_() {
  const sheet=SpreadsheetApp.openById(AW_PUBLIC_FEED.sheetId)
    .getSheetByName(AW_PUBLIC_FEED.tab);
  if(!sheet)throw new Error('Public gigs tab missing');
  return {sheet,rows:awV05PublicRows_(sheet)};
}
function awV05Proposal_(privateRow,today) {
  const v=privateRow.v, col=AW_COL;
  const key=awV05Clean_(v[col.key]), date=awV05Clean_(v[col.date]);
  if(!key||!date||date<today)return {state:'SKIP',reason:'Past or invalid booking'};
  if(awV05Clean_(v[col.sync])!=='Active')
    return {state:'HOLD',reason:'Calendar booking missing or inactive'};
  if(awV05Clean_(v[col.review])!=='Approved'||
     awV05Clean_(v[col.publish])!=='Yes')
    return {state:'HOLD',reason:'Awaiting private-register approval'};
  if(/\b(?:fixture|test|cancelled|canceled|provisional|tentative)\b/i.test(v[col.title]||''))
    return {state:'HOLD',reason:'Test, cancelled or provisional'};
  const venue=awV05Clean_(v[col.publicVenue]);
  const location=awV05Clean_(v[col.publicLocation]);
  const time=awV05Clean_(v[col.publicTime]);
  const ticket=awV05Clean_(v[col.ticketUrl]);
  const status=awV05Clean_(v[col.ticketStatus]);
  const role=awV05Role_(v[col.title]);
  if(!venue||!location) return {state:'HOLD',reason:'Public venue and town required'};
  if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    return {state:'HOLD',reason:'Invalid public show time'};
  if(!['Live','Info soon','Hidden'].includes(status))
    return {state:'HOLD',reason:'Invalid public status'};
  if(ticket&&!/^https:\/\/[^\s/]+\.[^\s/]+(?:\/[^\s]*)?$/i.test(ticket))
    return {state:'HOLD',reason:'Invalid ticket URL'};
  if(status==='Live'&&!ticket)
    return {state:'HOLD',reason:'Live requires verified ticket URL'};
  if(!role)return {state:'HOLD',reason:'No single clear performance role'};
  return {state:'READY',key,details:{
    date,time,location,venue,
    address:awV05Clean_(v[col.location]),ticket,status,role,
    // Private calendar titles and fee notes are NEVER copied.
    notes:awV05Clean_(v[col.publicTitle])||'Comedy night · details to follow'
  }};
}
function awV05SameGig_(a,b) {
  if(a.date!==b.date)return false;
  if(awV05Venue_(a.venue) && awV05Venue_(a.venue)===awV05Venue_(b.venue))return true;
  const ap=awV05Postcode_(a.address), bp=awV05Postcode_(b.address);
  return !!(ap&&bp&&ap===bp);
}
function awV05Plan_(privateRows,publicRows,today) {
  const add=[],review=[],linked=[],skipped=[];
  const seen=new Set(), byKey=new Map();
  publicRows.forEach(r=>{
    if(!r.key)return;
    if(!byKey.has(r.key))byKey.set(r.key,[]);
    byKey.get(r.key).push(r);
  });
  privateRows.forEach(r=>{
    const v=r.v,key=awV05Clean_(v[AW_COL.key]);
    if(seen.has(key)){review.push({privateRow:r.sheetRow,reason:'Duplicate private key'});return;}
    seen.add(key);
    const state=awV05Proposal_(r,today);
    const existing=byKey.get(awV05OpaqueId_(key))||[];
    if(existing.length>1){
      review.push({privateRow:r.sheetRow,reason:'Public performance key is duplicated'});
      return;
    }
    if(existing.length===1) {
      linked.push({privateRow:r.sheetRow,publicRow:existing[0].row,key,
        check:existing[0].date!==awV05Clean_(v[AW_COL.date])
          ?'DATE_CHANGED_NEEDS_REVIEW'
          :state.state==='HOLD'?'PUBLIC_LISTING_NEEDS_REVIEW':'ALREADY_LINKED'});
      return;
    }
    if(state.state==='SKIP'){skipped.push(r.sheetRow);return;}
    if(state.state==='HOLD'){review.push({privateRow:r.sheetRow,reason:state.reason});return;}
    const d=state.details;
    const collision=publicRows.find(x=>awV05SameGig_(x,d));
    if(collision){
      review.push({privateRow:r.sheetRow,
        reason:'Existing legacy listing on same date/venue requires key linking',
        publicRow:collision.row});
      return;
    }
    if(publicRows.some(x=>x.date===d.date&&(!x.venue||!x.location))) {
      review.push({privateRow:r.sheetRow,
        reason:'Ambiguous same-date public listing; manual check required'});
      return;
    }
    // Also compare against new rows queued in this very run.
    if(add.some(x=>awV05SameGig_(x.details,d))){
      review.push({privateRow:r.sheetRow,reason:'Duplicate within proposed publication batch'});
      return;
    }
    add.push({privateRow:r.sheetRow,key,details:d});
  });
  return {add,review,linked,skipped};
}
function previewAnthonyRegisterPublisher() {
  const publicData=awV05Read_();
  const plan=awV05Plan_(awReadRegister_().rows,
    publicData.rows,awIso_(new Date()));
  const report={
    version:AW_REGISTER_PUBLISH_VERSION,mode:'SAFE_READ_ONLY_PREVIEW',
    wouldPublish:plan.add.length,
    alreadyLinked:plan.linked.length,
    needsReview:plan.review.length,
    publishProposals:plan.add.slice(0,12),
    reviewSample:plan.review.slice(0,15),
    linkedSample:plan.linked.slice(0,8),
    publicWrites:0,calendarWrites:0
  };
  Logger.log(JSON.stringify(report,null,2));
  return report;
}
function awV05WriteRows_(items) {
  return items.map(x=>{const d=x.details;
    return [d.date,d.time,d.location,d.venue,d.address,
      d.ticket,d.status,d.role,d.notes,awV05OpaqueId_(x.key)];
  });
}
function publishAnthonyApprovedGigs() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(15000))throw new Error('Publisher is running');
  try{
    const current=awV05Read_();
    const plan=awV05Plan_(awReadRegister_().rows,current.rows,awIso_(new Date()));
    const batch=awV05WriteRows_(plan.add);
    if(batch.length) {
      const sheet=current.sheet,first=sheet.getLastRow()+1;
      // Fail BEFORE writing if any target Role cell has invalid validation.
      const validations=sheet.getRange(first,7,batch.length,2).getDataValidations();
      for(let i=0;i<validations.length;i++) {
        if(!validations[i][0]||validations[i][1])
          throw new Error('Public validation problem at G/H row '+(first+i));
      }
      sheet.getRange(first,1,batch.length,10).setValues(batch);
      SpreadsheetApp.flush();
      const stored=sheet.getRange(first,1,batch.length,10).getDisplayValues();
      batch.forEach((v,i)=>{
        if(stored[i][9]!==v[9]||stored[i][3]!==v[3]||
           stored[i][6]!==v[6]||stored[i][7]!==v[7])
          throw new Error('Publish verification failed at row '+(first+i));
      });
    }
    const result={
      version:AW_REGISTER_PUBLISH_VERSION,
      mode:'APPROVED_NEW_ENTRIES_ONLY',
      published:batch.length,
      held:plan.review.length,
      existingPublicRowsModified:0,
      publicKeys:plan.add.map(x=>x.key)
    };
    Logger.log(JSON.stringify(result,null,2));
    return result;
  } finally {lock.releaseLock();}
}
function testAnthonyRegisterPublisher() {
  const now='2026-11-11';
  const sample=(key,title='Example MC')=>{
    const v=Array(AW_SYNC.columns).fill('');
    v[AW_COL.key]=key;v[AW_COL.date]='2027-02-26';
    v[AW_COL.title]=title;v[AW_COL.location]='Example Hall, Exampletown';
    v[AW_COL.sync]='Active';v[AW_COL.review]='Approved';
    v[AW_COL.publish]='Yes';v[AW_COL.publicVenue]='Example Hall';
    v[AW_COL.publicLocation]='Exampletown';v[AW_COL.publicTime]='20:00';
    v[AW_COL.ticketStatus]='Info soon';
    return {sheetRow:2,v};
  };
  const p=sample('calendar-uid|slot:1');
  const d=awV05Proposal_(p,now).details;
  const legacy={row:9,date:d.date,venue:d.venue,location:d.location,
    address:d.address,key:''};
  const linked={...legacy,key:awV05OpaqueId_('calendar-uid|slot:1')};
  const tests={
    approvedProposesOne:awV05Plan_([p],[],now).add.length===1,
    pendingReviewBlocked:(()=>{const x=sample('a');x.v[AW_COL.review]='Needs review';
      return awV05Plan_([x],[],now).add.length===0;})(),
    notForPublicationBlocked:(()=>{const x=sample('a');x.v[AW_COL.publish]='No';
      return awV05Plan_([x],[],now).add.length===0;})(),
    inactiveHeld:(()=>{const x=sample('a');x.v[AW_COL.sync]='Missing from calendar';
      return awV05Plan_([x],[],now).add.length===0;})(),
    legacyDateVenueNotDuplicated:awV05Plan_([p],[legacy],now).add.length===0,
    existingLinkIdempotent:awV05Plan_([p],[linked],now).add.length===0,
    differentVenueSameDateAllowed:awV05Plan_([p],[{
      ...legacy,venue:'Another Theatre',address:'A different postcode, YO18 1AB'
    }],now).add.length===1,
    moveRequiresReview:(()=>{const x=sample('calendar-uid|slot:1');
      x.v[AW_COL.date]='2027-03-05';
      return awV05Plan_([x],[linked],now).linked[0].check==='DATE_CHANGED_NEEDS_REVIEW';})(),
    noPrivateTitlePublished:!JSON.stringify(awV05WriteRows_([{key:'a',details:d}]))
      .includes('Example MC'),
    liveWithoutTicketHeld:(()=>{const x=sample('a');x.v[AW_COL.ticketStatus]='Live';
      return awV05Proposal_(x,now).state==='HOLD';})(),
    mixedRoleHeld:awV05Proposal_(sample('b','MC and opener'),now).state==='HOLD',
    duplicateKeyHeld:awV05Plan_([p,sample('calendar-uid|slot:1')],[],now).review.length===1,
    opaquePublicKeyDiffersFromCalendarUID:
      awV05OpaqueId_('calendar-uid|slot:1')!=='calendar-uid|slot:1',
    unapprovedLinkedMoveStillFlagged:(()=>{
      const x=sample('calendar-uid|slot:1');
      x.v[AW_COL.date]='2027-03-05';x.v[AW_COL.review]='Date changed';
      return awV05Plan_([x],[linked],now).linked[0].check==='DATE_CHANGED_NEEDS_REVIEW';
    })()
  };
  Logger.log(JSON.stringify({version:AW_REGISTER_PUBLISH_VERSION,tests},null,2));
  if(Object.values(tests).some(v=>!v))
    throw new Error('Register publisher tests failed');
  return tests;
}
