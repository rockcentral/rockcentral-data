/**
 * ANTHONY GIGS - PROGRESSIVE PUBLICATION
 * VERSION 1.0.0, 12 November 2026
 *
 * One calendar booking -> provisional public listing -> verified enrichment.
 * Adds a new 15-minute handler and an installable private-register onEdit
 * handler. Does not overwrite the existing v0.5.3 publisher or daily workflow.
 *
 * Dependencies: Code.gs v0.2.6, AnthonyAutoPublisher.gs v0.5.3,
 * AnthonyGigAlerts.gs v0.8.6.
 * Install only after testAnthonyProgressiveRules() passes and the read-only
 * preview has been inspected. Running this source merely saves functions.
 */
const AW_PROGRESS_VERSION='1.0.0';
const AW_PROGRESS_VERIFIED_TAG='[ROCKCENTRAL_RESEARCH_VERIFIED]';
const AW_PROGRESS_PROVISIONAL_TAG='[ROCKCENTRAL_AUTO_PROVISIONAL]';
const AW_PROGRESS_RUN_FN='anthonyProgressive15MinuteWorkflow';
const AW_PROGRESS_EDIT_FN='onAnthonyProgressiveRegisterEdit';

function awProgText_(x){return awV05Clean_(x);}
function awProgPlaceholder_(x){return !awProgText_(x)||/^(?:venue\s+tbc|tbc|to\s+be\s+confirmed|info\s+soon)$/i.test(awProgText_(x));}
function awProgGeneric_(x){return !awProgText_(x)||/^(?:comedy\s+night|gig)(?:\s*[·\-:]\s*(?:details\s+to\s+follow|info\s+soon))?$/i.test(awProgText_(x));}
function awProgEqual_(x,y){return awProgText_(x)===awProgText_(y);}

/** Fail closed on ambiguous titles; never infer a geographical town from a venue name. */
function awProgTown_(title){
  const t=awProgText_(title);
  if(/\b(?:test|fixture|cancelled|canceled|hold|provisional|tentative|tbc|placeholder|double|holiday|private)\b/i.test(t))return '';
  const m=t.match(/^gig\s*(?:[-:]\s*)?(.+?)\s*(?:[-/]\s*|\s+)(mc|compere|host|opener|opening|middle|closer|closing|headliner|headline)\s*$/i);
  if(!m)return '';
  const place=m[1].trim().replace(/^[-:/\s]+|[-:/\s]+$/g,'');
  if(!/^[a-z]+(?:[ '-][a-z]+){0,2}$/i.test(place)||place.length>35)return '';
  if(/\b(?:live|at|the|for|with|club|pub|bar|brewery|lounge|room|hall|stadium|theatre|apollo|venue|house|arts|monkey|show|comedy|night|fest|festival|gig)\b/i.test(place))return '';
  return place.replace(/\b[a-z]/gi,c=>c.toUpperCase());
}
function awProgCanProvisional_(r,today){
  const v=r.v,venue=awProgTown_(v[AW_COL.title]);
  return venue && v[AW_COL.sync]==='Active' &&
    v[AW_COL.bookingState]==='Confirmed' &&
    v[AW_COL.date]>=today &&
    v[AW_COL.review]==='Needs review' &&
    v[AW_COL.publish]==='No' &&
    awV05Role_(v[AW_COL.title]);
}
/** Auto-approve only keys newly inserted by THIS invocation. Never revive old rejected rows. */
function awProgApproveNew_(beforeKeys,working){
  const approved=[];
  const now=awIso_(new Date());
  for(const row of working.rows){
    const v=row.v,key=v[AW_COL.key],town=awProgCanProvisional_(row,now);
    if(!key||beforeKeys.has(key)||!town)continue;
    const newValues=[
      'Approved','Yes','Comedy night · details to follow',
      'Venue TBC',town,'','','Info soon'
    ];
    working.sheet.getRange(row.sheetRow,AW_COL.review+1,1,8)
      .setValues([newValues]);
    const previous=awProgText_(v[AW_COL.note]);
    working.sheet.getRange(row.sheetRow,AW_COL.note+1)
      .setValue((previous?previous+'\n':'')+AW_PROGRESS_PROVISIONAL_TAG+
        ' Auto-approved from structured confirmed calendar booking; public venue and ticket details await research.');
    approved.push({row:row.sheetRow,date:v[AW_COL.date],town});
  }
  if(approved.length)SpreadsheetApp.flush();
  return approved;
}
/**
 * The normal sync reopens review when calendar location/description changes.
 * A research agent may enrich those two fields safely. Accept ONLY if immutable
 * booking fields stayed equal, the calendar description has the explicit
 * verified-research tag, and the row had already been approved and published.
 * All date, time, title, status, and role changes still require review.
 */
function awProgRestoreResearchApprovals_(beforeRows,working,changedKeys){
  const index=new Map(beforeRows.map(r=>[r.v[AW_COL.key],r.v]));
  const changed=new Set(changedKeys||[]);
  const restored=[];
  for(const row of working.rows){
    const v=row.v,old=index.get(v[AW_COL.key]);
    if(!old||!changed.has(v[AW_COL.key]))continue;
    if(old[AW_COL.review]!=='Approved'||old[AW_COL.publish]!=='Yes'||
       old[AW_COL.sync]!=='Active'||v[AW_COL.sync]!=='Active'||
       v[AW_COL.review]!=='Needs review')continue;
    if(!awProgText_(v[AW_COL.description]).includes(AW_PROGRESS_VERIFIED_TAG))
      continue;
    const stable=[AW_COL.date,AW_COL.endDate,AW_COL.title,
      AW_COL.time,AW_COL.allDay,AW_COL.bookingState];
    if(stable.some(k=>!awProgEqual_(v[k],old[k])))continue;
    // Only location and description may have changed.
    working.sheet.getRange(row.sheetRow,AW_COL.review+1).setValue('Approved');
    restored.push(v[AW_COL.key]);
  }
  if(restored.length)SpreadsheetApp.flush();
  return restored;
}

function awProgPossibleCollision_(p,d){
  if(p.date!==d.date)return false;
  const sameTown=awV05Venue_(p.location)===awV05Venue_(d.location);
  if(!sameTown)return false;
  // Two different venues on the same date can be genuine different bookings.
  const ambiguousVenue=awProgPlaceholder_(p.venue)||awProgPlaceholder_(d.venue);
  if(ambiguousVenue)return true;
  return awV05Venue_(p.venue)===awV05Venue_(d.venue)||
    (!!awV05Postcode_(p.address)&&awV05Postcode_(p.address)===awV05Postcode_(d.address));
}
function awProgTrusted_(row){
  return awProgText_(row.v[AW_COL.note]).includes(AW_PROGRESS_VERIFIED_TAG);
}
/** Merge without erasing already verified fields or silently moving venues. */
function awProgMerge_(p,d,row){
  const trusted=awProgTrusted_(row);
  if(p.date!==d.date)return {state:'HOLD',reason:'Public performance date differs from register'};
  if(p.role&&d.role&&p.role!==d.role)
    return {state:'HOLD',reason:'Published performance role differs'};
  if(p.location&&d.location&&awV05Venue_(p.location)!==awV05Venue_(d.location))
    return {state:'HOLD',reason:'Published town differs; review required'};
  if(!awProgPlaceholder_(p.venue)&&!awProgPlaceholder_(d.venue)&&
     awV05Venue_(p.venue)!==awV05Venue_(d.venue))
    return {state:'HOLD',reason:'Published venue differs; review required'};
  if(p.url&&d.ticket&&p.url!==d.ticket&&!trusted)
    return {state:'HOLD',reason:'Different live ticket URL needs verified research'};
  if(p.time&&d.time&&p.time!==d.time&&!trusted)
    return {state:'HOLD',reason:'Different advertised start needs verification'};
  const venue=awProgPlaceholder_(p.venue)&&!awProgPlaceholder_(d.venue)?d.venue:p.venue;
  const time=d.time&&(!p.time||trusted)?d.time:p.time;
  const url=d.ticket&&(!p.url||trusted)?d.ticket:p.url;
  let status=p.status;
  if(d.status==='Hidden')status='Hidden';
  else if(d.status==='Live'&&url)status='Live';
  else if(p.status==='Hidden'&&d.status!=='Hidden'&&trusted)status=d.status;
  else if(!status)status=d.status;
  if(status==='Live'&&!url)return {state:'HOLD',reason:'Live status without ticket URL'};
  const address=d.address&&(!p.address||trusted)?d.address:p.address;
  const notes=(d.notes&&!awProgGeneric_(d.notes)&&(awProgGeneric_(p.notes)||trusted))
    ?d.notes:p.notes||d.notes;
  const values=[p.date,time,p.location||d.location,venue,address,
    url,status,p.role||d.role,notes,p.key];
  const old=[p.date,p.time,p.location,p.venue,p.address,p.url,
    p.status,p.role,p.notes,p.key];
  return {state:values.some((x,i)=>!awProgEqual_(x,old[i]))?'UPDATE':'UNCHANGED',
    values};
}
function awProgPlan_(privateRows,publicRows,today){
  const byKey=new Map(),linked=[],add=[],update=[],review=[];
  const privSeen=new Set();
  for(const p of publicRows){
    if(!p.key)continue;
    if(!byKey.has(p.key))byKey.set(p.key,[]);
    byKey.get(p.key).push(p);
  }
  for(const r of privateRows){
    const key=awProgText_(r.v[AW_COL.key]);
    if(!key)continue;
    if(privSeen.has(key)){review.push({privateRow:r.sheetRow,reason:'Duplicate private performance key'});continue;}
    privSeen.add(key);
    const opaque=awV05OpaqueId_(key),existing=byKey.get(opaque)||[];
    const proposal=awV05Proposal_(r,today);
    if(existing.length>1){
      review.push({privateRow:r.sheetRow,reason:'Duplicate public performance key'});continue;
    }
    if(existing.length===1){
      const p=existing[0];
      linked.push({privateRow:r.sheetRow,publicRow:p.row,key,
        check:p.date!==awProgText_(r.v[AW_COL.date])
          ?'DATE_CHANGED_NEEDS_REVIEW'
          :proposal.state==='HOLD'?'PUBLIC_LISTING_NEEDS_REVIEW':'ALREADY_LINKED'});
      if(proposal.state!=='READY')continue;
      const merge=awProgMerge_(p,proposal.details,r);
      if(merge.state==='UPDATE')update.push({row:p.row,privateRow:r.sheetRow,values:merge.values,key});
      if(merge.state==='HOLD')review.push({privateRow:r.sheetRow,
        publicRow:p.row,reason:merge.reason});
      continue;
    }
    if(proposal.state!=='READY'){
      if(proposal.state==='HOLD')review.push({privateRow:r.sheetRow,reason:proposal.reason});
      continue;
    }
    const d=proposal.details;
    if(publicRows.some(p=>awProgPossibleCollision_(p,d))||
       add.some(x=>awProgPossibleCollision_({date:x.details.date,
           location:x.details.location,venue:x.details.venue,
           address:x.details.address},d))){
      review.push({privateRow:r.sheetRow,
        reason:'Possible duplicate booking already listed on same date and town'});
      continue;
    }
    add.push({privateRow:r.sheetRow,key,details:d});
  }
  return {linked,add,update,review};
}
/** The single writer for additions and progressive updates; lock protects idempotency. */
function awProgPublish_(){
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(15000))throw new Error('Progressive publisher is already running');
  try{
    const pub=awV05Read_(),rows=awReadRegister_().rows;
    const plan=awProgPlan_(rows,pub.rows,awIso_(new Date()));
    // Preflight validation before any public modification.
    const sheet=pub.sheet,items=awV05WriteRows_(plan.add);
    const first=sheet.getLastRow()+1;
    if(items.length){
      const validations=sheet.getRange(first,7,items.length,2).getDataValidations();
      for(let i=0;i<validations.length;i++)
        if(!validations[i][0]||validations[i][1])
          throw new Error('Public G/H validation missing at row '+(first+i));
    }
    for(const u of plan.update)
      sheet.getRange(u.row,1,1,10).setValues([u.values]);
    if(items.length)sheet.getRange(first,1,items.length,10).setValues(items);
    if(plan.update.length||items.length){
      SpreadsheetApp.flush();
      for(const u of plan.update){
        const got=sheet.getRange(u.row,1,1,10).getDisplayValues()[0];
        if(got[9]!==u.values[9]||got[5]!==u.values[5]||
           got[6]!==u.values[6])
          throw new Error('Public update verification failed row '+u.row);
      }
      if(items.length){
        const stored=sheet.getRange(first,1,items.length,10).getDisplayValues();
        items.forEach((v,i)=>{
          if(stored[i][9]!==v[9]||stored[i][6]!==v[6])
            throw new Error('Public add verification failed row '+(first+i));
        });
      }
    }
    return {version:AW_PROGRESS_VERSION,published:items.length,
      updated:plan.update.length,held:plan.review.length,
      newRows:plan.add.map((x,i)=>({row:first+i,
        date:x.details.date,town:x.details.location,venue:x.details.venue})),
      updatedRows:plan.update.map(x=>x.row)};
  }finally{lock.releaseLock();}
}
function awProgNotify_(result){
  if(!result.published&&!result.updated)return;
  const lines=[
    result.published+' new gig(s) published and '+result.updated+' existing listing(s) updated.',
    'New: '+(result.newRows.length?result.newRows.map(x=>
      x.date+' · '+x.town+' · '+x.venue+' (public row '+x.row+')').join('; '):'none'),
    'Updated public rows: '+(result.updatedRows.length?result.updatedRows.join(', '):'none'),
    'Listings only use approved private details. Missing event links remain Info soon.'
  ];
  awAlertSend_('RockCentral: gigs published or updated',lines);
}
function anthonyProgressive15MinuteWorkflow(){
  try{
    const before=awReadRegister_().rows;
    const beforeKeys=new Set(before.map(r=>r.v[AW_COL.key]));
    const source=syncAnthonyCalendarToRegister();
    let working=awReadRegister_();
    const restored=awProgRestoreResearchApprovals_(
      before,working,source.changedKeys||[]);
    working=awReadRegister_();
    const newApproved=awProgApproveNew_(beforeKeys,working);
    working=awReadRegister_();
    const pub=awV05Read_();
    const plan=awProgPlan_(working.rows,pub.rows,awIso_(new Date()));
    const filteredSource={...source,changedKeys:(source.changedKeys||[])
      .filter(k=>!restored.includes(k))};
    const alerts=awAlertProcess_(working.rows,pub.rows,plan,filteredSource);
    // An urgent issue affects its OWN row, not unrelated eligible bookings.
    // awProgPlan_ only writes active approved rows with matching identity.
    const result=awProgPublish_();
    awProgNotify_(result);
    awAlertClearFailure_();
    const summary={version:AW_PROGRESS_VERSION,
      detected:source.added,provisionalApproved:newApproved.length,
      trustedResearchApprovalsRestored:restored.length,
      published:result.published,updated:result.updated,
      held:result.held,reviewAlerts:alerts.newReviewAlerts,
      urgentAlerts:alerts.newUrgentAlerts,
      calendarWrites:0};
    Logger.log(JSON.stringify(summary,null,2));return summary;
  }catch(error){
    try{awAlertWorkflowFailure_(error);}
    catch(mailError){Logger.log('ALERT DELIVERY ERROR: '+mailError.message);}
    throw error;
  }
}
function onAnthonyProgressiveRegisterEdit(e){
  if(!e||!e.range)return {ignored:true};
  const range=e.range,sheet=range.getSheet();
  if(sheet.getParent().getId()!==AW_SYNC.workingSheetId||
    sheet.getName()!==AW_SYNC.tab||range.getRow()<2||
    range.getColumn()>AW_COL.ticketStatus+1||
    range.getColumn()+range.getNumColumns()-1<AW_COL.review+1)
    return {ignored:true};
  try{
    const result=awProgPublish_();
    awProgNotify_(result);
    return result;
  }catch(error){
    try{awAlertWorkflowFailure_(error);}
    catch(mailError){Logger.log('ALERT DELIVERY ERROR: '+mailError.message);}
    throw error;
  }
}
function previewAnthonyProgressiveTriggers(){
  const triggers=ScriptApp.getProjectTriggers().map(t=>({
    handler:t.getHandlerFunction(),type:String(t.getEventType())}));
  const report={version:AW_PROGRESS_VERSION,readOnly:true,
    priorWorkflowTriggers:triggers.filter(x=>
      ['dailyAnthonySafeWorkflow','dailyAnthonyGigWorkflow',
        'onAnthonyGigRegisterEdit',AW_PROGRESS_RUN_FN,
        AW_PROGRESS_EDIT_FN].includes(x.handler)),
    otherTriggers:triggers.filter(x=>
      !['dailyAnthonySafeWorkflow','dailyAnthonyGigWorkflow',
        'onAnthonyGigRegisterEdit',AW_PROGRESS_RUN_FN,
        AW_PROGRESS_EDIT_FN].includes(x.handler))};
  Logger.log(JSON.stringify(report,null,2));return report;
}
function enableAnthonyProgressiveTriggers(){
  const handlers=['dailyAnthonySafeWorkflow','dailyAnthonyGigWorkflow',
    'onAnthonyGigRegisterEdit',AW_PROGRESS_RUN_FN,AW_PROGRESS_EDIT_FN];
  const old=ScriptApp.getProjectTriggers()
    .filter(t=>handlers.includes(t.getHandlerFunction()));
  const made=[];
  try{
    made.push(ScriptApp.newTrigger(AW_PROGRESS_RUN_FN)
      .timeBased().everyMinutes(15).create());
    made.push(ScriptApp.newTrigger(AW_PROGRESS_EDIT_FN)
      .forSpreadsheet(AW_SYNC.workingSheetId).onEdit().create());
  }catch(error){
    made.forEach(t=>{try{ScriptApp.deleteTrigger(t);}catch(ignored){}});
    throw error;
  }
  old.forEach(t=>ScriptApp.deleteTrigger(t));
  const result={version:AW_PROGRESS_VERSION,
    enabled:true,intervalMinutes:15,newTriggers:2,
    replaced:old.length,otherTriggersUnchanged:true};
  Logger.log(JSON.stringify(result,null,2));return result;
}
/** Pure logic tests, no calendar or sheets writes, no emails. */
function testAnthonyProgressiveRules(){
  const t=awProgTown_;
  const base={date:'2026-12-05',time:'',location:'Ribchester',
    venue:'Venue TBC',address:'',url:'',status:'Info soon',role:'MC',
    notes:'Comedy night · details to follow',key:'opaque'};
  const proposal={date:base.date,time:'20:00',location:'Ribchester',
    venue:'The Ribchester Arms',address:'Blackburn Road, Ribchester, PR3 3ZP',
    ticket:'https://tickets.example.com/a',status:'Live',role:'MC',
    notes:'Next Stop Comedy at The Ribchester Arms'};
  const fake={v:Array(AW_SYNC.columns).fill('')};
  const upgraded=awProgMerge_(base,proposal,fake);
  const stable=awProgMerge_({...base,venue:proposal.venue,
    time:proposal.time,url:proposal.ticket,status:'Live',notes:proposal.notes,
    address:proposal.address},{...proposal,time:'',ticket:'',status:'Info soon'},fake);
  const conflict=awProgMerge_({...base,venue:'Other Pub'},proposal,fake);
  const checks={
    plainTownRecognised:t('Gig Ribchester MC')==='Ribchester',
    hyphenatedTownRecognised:t('GIG - High Wycombe - Opener')==='High Wycombe',
    fictionalVenueNotTown:!t('Gig - LIVE AT THE APOLLO closer'),
    knownVenueNotTown:!t('GIG - Blue Monkey / MC'),
    testNotPublished:!t('Gig Ribchester MC Test'),
    vagueTitleNotPublished:!t('Ribchester somewhere'),
    strongMatchUpgrades:upgraded.state==='UPDATE'&&
      upgraded.values[3]===proposal.venue&&
      upgraded.values[5]===proposal.ticket&&upgraded.values[6]==='Live',
    noTicketRegression:stable.state==='UNCHANGED',
    conflictingVenueHeld:conflict.state==='HOLD',
    sameTownProvisionalCollision:awProgPossibleCollision_(base,{
      ...proposal,venue:'Another Pub'}),
    differentTownAllowed:!awProgPossibleCollision_(base,{
      ...proposal,location:'Preston'}),
    noDateMove:awProgMerge_(base,{...proposal,date:'2026-12-06'},fake).state==='HOLD',
    newRolesStaySingle:awV05Role_('Gig Ribchester MC and opener')===''
  };
  Logger.log(JSON.stringify({version:AW_PROGRESS_VERSION,checks},null,2));
  if(Object.values(checks).some(v=>!v))
    throw new Error('Progressive gig rules failed: '+JSON.stringify(checks));
  return checks;
}
