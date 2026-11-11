/**
 * ANTHONY GIG WORKFLOW / LEGACY BACKFILL
 * VERSION 0.8.2 (11 November 2026)
 * No hardcoded gig or venue information.
 * Requires Code.gs v0.2.6 and AnthonyAutoPublisher v0.5.3.
 * This file does not change the calendar or public listing details.
 */
const AW_WORKFLOW_VERSION='0.8.2';
function awV07BackfillPlan_(privateRows,publicRows){
  const keyed=new Map();
  for(const p of publicRows)if(p.key){
    if(!keyed.has(p.key))keyed.set(p.key,[]);
    keyed.get(p.key).push(p);
  }
  const actions=[],held=[];
  for(const row of privateRows){
    const v=row.v,id=awV05OpaqueId_(v[AW_COL.key]||'');
    const matching=keyed.get(id)||[];
    if(!matching.length)continue;
    if(matching.length!==1){held.push({row:row.sheetRow,reason:'Duplicated public key'});continue;}
    const p=matching[0];
    if(v[AW_COL.date]!==p.date || v[AW_COL.sync]!=='Active'){
      held.push({row:row.sheetRow,reason:'Date or active status differs from public',publicRow:p.row});
      continue;
    }
    const newPublic=[
      'Approved','Yes',
      p.notes||'Comedy night · details to follow',p.venue,p.location,
      p.time,p.url,p.status
    ];
    if(!p.venue||!p.location||!['Live','Info soon','Hidden'].includes(p.status)){
      held.push({row:row.sheetRow,reason:'Incomplete existing published information',publicRow:p.row});
      continue;
    }
    const oldPublic=v.slice(AW_COL.review,AW_COL.ticketStatus+1);
    // Fully approved rows can retain intentionally shorter show titles.
    // If their critical public fields match, they need no backfill.
    if(v[AW_COL.review]==='Approved' && v[AW_COL.publish]==='Yes' &&
       String(v[AW_COL.publicVenue]||'')===String(p.venue||'') &&
       String(v[AW_COL.publicLocation]||'')===String(p.location||'') &&
       String(v[AW_COL.publicTime]||'')===String(p.time||'') &&
       String(v[AW_COL.ticketUrl]||'')===String(p.url||'') &&
       String(v[AW_COL.ticketStatus]||'')===String(p.status||''))continue;
    // If public fields were previously customised and differ, avoid overwriting
    // that manual work without an explicit review.
    const existingDetails=oldPublic.slice(2);
    const defaultUnreviewed=v[AW_COL.review]==='Needs review' &&
      v[AW_COL.publish]==='No';
    if(existingDetails.some((x,i)=>x && 
       !(defaultUnreviewed && i===5 && x==='Info soon') &&
       String(x)!==String(newPublic[i+2]))){
      held.push({row:row.sheetRow,reason:'Private public fields conflict with live published fields',publicRow:p.row});
      continue;
    }
    if(oldPublic.some((x,i)=>String(x||'')!==String(newPublic[i]||''))){
      actions.push({privateRow:row.sheetRow,publicRow:p.row,values:newPublic,
        date:p.date,venue:p.venue});
    }
  }
  return {actions,held};
}
function previewAnthonyLegacyBackfill(){
  const plan=awV07BackfillPlan_(awReadRegister_().rows,awV05Read_().rows);
  const report={version:AW_WORKFLOW_VERSION,mode:'PRIVATE_ONLY_PREVIEW',
    wouldEnrich:plan.actions.length,heldForReview:plan.held.length,
    sample:plan.actions.slice(0,15).map(x=>({
      privateRow:x.privateRow,publicRow:x.publicRow,date:x.date,venue:x.venue
    })),holds:plan.held.slice(0,15),
    publicWrites:0,calendarWrites:0};
  Logger.log(JSON.stringify(report,null,2));return report;
}
function backfillAnthonyPrivateRegister(){
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(15000))throw new Error('Backfill already running');
  try{
    const working=awReadRegister_();
    const plan=awV07BackfillPlan_(working.rows,awV05Read_().rows);
    for(const a of plan.actions){
      working.sheet.getRange(a.privateRow,AW_COL.review+1,1,8)
        .setValues([a.values]);
    }
    SpreadsheetApp.flush();
    for(const a of plan.actions){
      const values=working.sheet.getRange(a.privateRow,AW_COL.review+1,1,8)
        .getDisplayValues()[0];
      if(values[3]!==a.values[3]||values[1]!=='Yes')
        throw new Error('Private backfill verification failure at row '+a.privateRow);
    }
    const report={version:AW_WORKFLOW_VERSION,
      mode:'PRIVATE_REGISTER_ONLY',enriched:plan.actions.length,
      held:plan.held.length,publicWrites:0,calendarWrites:0};
    Logger.log(JSON.stringify(report,null,2));return report;
  }finally{lock.releaseLock();}
}
function dailyAnthonySafeWorkflow(){
  try {
    const source=syncAnthonyCalendarToRegister();
    const privateRows=awReadRegister_().rows;
    const publicData=awV05Read_();
    const plan=awV05Plan_(privateRows,publicData.rows,awIso_(new Date()));
    // Send deduplicated notifications BEFORE deciding to publish.
    const alerts=awAlertProcess_(privateRows,publicData.rows,plan,source);
    if(alerts.urgentOutstanding>0) {
      // These gigs need a human decision; fail closed without spamming
      // a second technical error email for the same condition.
      const error=new Error('Published gig(s) need review: '+
        alerts.urgentOutstanding+' active urgent issue(s).');
      error.awAlertAlreadySent=true;
      throw error;
    }
    const publish=publishAnthonyApprovedGigs();
    awAlertClearFailure_();
    const report={version:AW_WORKFLOW_VERSION,
      mode:'DAILY_SAFE_SYNC_WITH_ALERTS',
      newCalendarRows:source.added,
      movedCalendarRows:source.moved,
      missingFromCalendar:source.missingFlagged,
      publicNewApprovedRows:publish.published,
      reviewOutstanding:alerts.reviewOutstanding,
      newReviewAlerts:alerts.newReviewAlerts,
      newUrgentAlerts:alerts.newUrgentAlerts,
      calendarWrites:0,
      existingPublicRowsModified:0};
    Logger.log(JSON.stringify(report,null,2));return report;
  } catch(error) {
    if(!error.awAlertAlreadySent){
      try {awAlertWorkflowFailure_(error);}
      catch(mailError) {
        Logger.log('ALERT DELIVERY ERROR: '+mailError.message);
      }
    }
    throw error;
  }
}
function enableAnthonySafeDailyTrigger(){
  const fn='dailyAnthonySafeWorkflow';
  const existing=ScriptApp.getProjectTriggers().filter(t=>
    t.getHandlerFunction()===fn ||
    t.getHandlerFunction()==='dailyAnthonyGigWorkflow');
  existing.forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger(fn).timeBased().everyDays(1).atHour(6)
    .inTimezone('Europe/London').create();
  Logger.log(JSON.stringify({version:AW_WORKFLOW_VERSION,
    trigger:fn,timezone:'Europe/London',
    oldPublisherTriggersRemoved:existing.length}));
}
function testAnthonyLegacyBackfill(){
  const key='synthetic-calendar-id|slot:1';
  const v=Array(AW_SYNC.columns).fill('');
  v[AW_COL.key]=key;v[AW_COL.date]='2027-07-08';
  v[AW_COL.sync]='Active';v[AW_COL.review]='Needs review';
  v[AW_COL.publish]='No';
  const privateRow={sheetRow:2,v};
  const p={row:5,date:'2027-07-08',
    key:awV05OpaqueId_(key),venue:'Fictional Hall',
    location:'Exampletown',time:'20:00',
    url:'https://example.org/show',status:'Live',notes:'Example show'};
  const plan=awV07BackfillPlan_([privateRow],[p]);
  const wrongDate={...p,date:'2027-07-09'};
  const conflictRow={sheetRow:3,v:[...v]};
  conflictRow.v[AW_COL.publicVenue]='Other Hall';
  const checks={
    linkedExistingApproved:plan.actions.length===1,
    correctVenue:plan.actions[0].values[3]==='Fictional Hall',
    preservesPublicFeed:plan.actions[0].privateRow===2,
    wrongDateHeld:awV07BackfillPlan_([privateRow],[wrongDate]).actions.length===0,
    conflictHeld:awV07BackfillPlan_([conflictRow],[p]).held.length===1,
    noUnlinkedBackfill:awV07BackfillPlan_([privateRow],[]).actions.length===0,
    inheritedInfoSoonMayUpgradeToLive:(()=>{
      const x={sheetRow:3,v:[...v]};
      x.v[AW_COL.ticketStatus]='Info soon';
      return awV07BackfillPlan_([x],[p]).actions.length===1;
    })(),
    approvedShortTitlePreserved:(()=>{
      const x={sheetRow:3,v:[...v]};
      x.v[AW_COL.review]='Approved';x.v[AW_COL.publish]='Yes';
      x.v[AW_COL.publicTitle]='Example';
      x.v[AW_COL.publicVenue]=p.venue;x.v[AW_COL.publicLocation]=p.location;
      x.v[AW_COL.publicTime]=p.time;x.v[AW_COL.ticketUrl]=p.url;
      x.v[AW_COL.ticketStatus]=p.status;
      const z=awV07BackfillPlan_([x],[p]);
      return z.actions.length===0&&z.held.length===0;
    })()
  };
  Logger.log(JSON.stringify({version:AW_WORKFLOW_VERSION,checks},null,2));
  if(Object.values(checks).some(v=>!v))throw new Error('Backfill test failed');
  return checks;
}
