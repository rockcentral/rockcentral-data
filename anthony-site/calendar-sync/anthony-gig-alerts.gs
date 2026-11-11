/**
 * ANTHONY GIG ALERTS
 * VERSION 0.8.0 (11 November 2026)
 * Requires Code.gs v0.2.6, AnthonyAutoPublisher.gs v0.5.3,
 * AnthonyDailyWorkflow.gs v0.8.0.
 * Private alert content only. No calendar or website writes.
 */
const AW_ALERT_VERSION='0.8.0';
const AW_ALERT_TO='alerts@rockcentralpromotions.com';
const AW_ALERT_STATE_KEY='aw_alert_v080_review_baseline';
const AW_ALERT_URGENT_KEY='aw_alert_v080_urgent_baseline';
const AW_ALERT_FAILURE_KEY='aw_alert_v080_failure';
const AW_ALERT_REGISTER_URL='https://docs.google.com/spreadsheets/d/' +
  AW_SYNC.workingSheetId + '/edit';
const AW_ALERT_PUBLIC_URL='https://docs.google.com/spreadsheets/d/' +
  AW_PUBLIC_FEED.sheetId + '/edit';
function awAlertPlain_(s){
  return String(s||'').replace(/<[^>]*>/g,' ')
    .replace(/£\s*\d+(?:\.\d{2})?/g,'[fee private]')
    .replace(/\s+/g,' ').trim().slice(0,180);
}
function awAlertPublicTag_(row){
  return row.v[AW_COL.date]+' · '+awAlertPlain_(row.v[AW_COL.title]);
}
function awAlertReviewItems_(privateRows,publicRows,today){
  const linked=new Set(publicRows.filter(p=>p.key).map(p=>p.key));
  const result=[];
  for(const row of privateRows){
    const v=row.v;
    if(!v[AW_COL.key] || v[AW_COL.date]<today ||
       v[AW_COL.sync]!=='Active' ||
       linked.has(awV05OpaqueId_(v[AW_COL.key])) ||
       v[AW_COL.review]==='Ignored')continue;
    const proposal=awV05Proposal_(row,today);
    if(proposal.state==='SKIP')continue;
    const desc=proposal.state==='READY'?
      'Approved and awaiting publisher run':
      proposal.reason;
    const id=awV05OpaqueId_(v[AW_COL.key]);
    result.push({id,text:'Register row '+row.sheetRow+
      ': '+awAlertPublicTag_(row)+' | '+desc});
  }
  return result.sort((a,b)=>a.id.localeCompare(b.id));
}
function awAlertUrgentItems_(plan,privateRows,changedKeys){
  const index=new Map(privateRows.map(r=>[r.sheetRow,r]));
  const changed=new Set(changedKeys||[]);
  const result=[];
  for(const link of plan.linked){
    const row=index.get(link.privateRow);
    if(!row)continue;
    const v=row.v;
    const reasons=[];
    if(link.check==='DATE_CHANGED_NEEDS_REVIEW')reasons.push('Calendar date differs from published date');
    if(v[AW_COL.sync]!=='Active')reasons.push('Booking is '+v[AW_COL.sync]);
    if(changed.has(link.key))reasons.push('Calendar booking details have changed');
    if(v[AW_COL.review]==='Date changed')reasons.push('Date change has not been reviewed');
    if(!reasons.length)continue;
    result.push({id:awV05OpaqueId_(link.key)+'|'+reasons.join(', '),
      text:'Public row '+link.publicRow+', private row '+row.sheetRow+
      ': '+awAlertPublicTag_(row)+' | '+reasons.join('; ')});
  }
  return result.sort((a,b)=>a.id.localeCompare(b.id));
}
function awAlertStored_(name){
  const raw=PropertiesService.getScriptProperties().getProperty(name);
  if(!raw)return null;
  try{const parsed=JSON.parse(raw);
    return Array.isArray(parsed)?parsed:null;
  }catch(e){return null;}
}
function awAlertSave_(name,items){
  PropertiesService.getScriptProperties().setProperty(name,JSON.stringify(items));
}
function awAlertSend_(subject,lines){
  const body=lines.join('\n')+
    '\n\nPrivate gig register:\n'+AW_ALERT_REGISTER_URL+
    '\n\nPublic gig feed:\n'+AW_ALERT_PUBLIC_URL+
    '\n\nAutomated alert from Anthony Gig Sync v'+AW_ALERT_VERSION+
    '. Please check source details before updating any public listing.';
  MailApp.sendEmail({to:AW_ALERT_TO,subject,body,name:'RockCentral Gig Alerts'});
}
function awAlertProcess_(privateRows,publicRows,plan,source){
  const today=awIso_(new Date());
  const review=awAlertReviewItems_(privateRows,publicRows,today);
  const urgent=awAlertUrgentItems_(plan,privateRows,source.changedKeys||[]);
  const properties=PropertiesService.getScriptProperties();
  const previousReview=awAlertStored_(AW_ALERT_STATE_KEY);
  const previousUrgent=awAlertStored_(AW_ALERT_URGENT_KEY);
  // Initial snapshot is intentionally silent to avoid emailing legacy backlog.
  if(previousReview===null)awAlertSave_(AW_ALERT_STATE_KEY,review.map(x=>x.id));
  if(previousUrgent===null)awAlertSave_(AW_ALERT_URGENT_KEY,[]);
  const oldReview=new Set(previousReview||review.map(x=>x.id));
  const oldUrgent=new Set(previousUrgent||[]);
  const newReviews=review.filter(x=>!oldReview.has(x.id));
  const newUrgent=urgent.filter(x=>!oldUrgent.has(x.id));
  if(newUrgent.length){
    awAlertSend_('[URGENT] RockCentral: published gig needs attention',
      ['The daily gig workflow found '+newUrgent.length+' new urgent issue(s).',
      'The public website has NOT been changed for these issues.','',
      ...newUrgent.map(x=>'- '+x.text)]);
  }
  if(newReviews.length) {
    awAlertSend_('RockCentral: '+newReviews.length+' new gig(s) need review',
      ['New or newly unmatched bookings need public details/approval.','',
      ...newReviews.map(x=>'- '+x.text)]);
  }
  // Commit notification state only after mail succeeds.
  // Preserve recurring urgent identities while active; resolve clears them.
  awAlertSave_(AW_ALERT_STATE_KEY,review.map(x=>x.id));
  awAlertSave_(AW_ALERT_URGENT_KEY,urgent.map(x=>x.id));
  return {newReviewAlerts:newReviews.length,newUrgentAlerts:newUrgent.length,
    reviewOutstanding:review.length,urgentOutstanding:urgent.length};
}
function initialiseAnthonyAlertBaseline(){
  const privateRows=awReadRegister_().rows;
  const publicRows=awV05Read_().rows;
  const plan=awV05Plan_(privateRows,publicRows,awIso_(new Date()));
  const review=awAlertReviewItems_(privateRows,publicRows,awIso_(new Date()));
  const urgent=awAlertUrgentItems_(plan,privateRows,[]);
  const props=PropertiesService.getScriptProperties();
  // Never accidentally overwrite a baseline after the live system starts.
  if(props.getProperty(AW_ALERT_STATE_KEY)||props.getProperty(AW_ALERT_URGENT_KEY))
    throw new Error('Alert baseline already set. No changes made.');
  awAlertSave_(AW_ALERT_STATE_KEY,review.map(x=>x.id));
  awAlertSave_(AW_ALERT_URGENT_KEY,urgent.map(x=>x.id));
  Logger.log(JSON.stringify({version:AW_ALERT_VERSION,
    mode:'ONE_TIME_SILENT_BASELINE',outstandingReview:review.length,
    urgentExisting:urgent.length,emailsSent:0},null,2));
}
function sendAnthonyAlertTestEmail(){
  awAlertSend_('[TEST] RockCentral gig alerts enabled',
    ['This is a test of the gig workflow notifications.',
      'Recipient: '+AW_ALERT_TO,
      'Future urgent and new-booking notifications will come here.',
      'This test does not change gig data or the website.']);
  Logger.log(JSON.stringify({version:AW_ALERT_VERSION,
    mode:'TEST_EMAIL_SENT',to:AW_ALERT_TO},null,2));
}
function awAlertWorkflowFailure_(error){
  const message=awAlertPlain_(error&&error.message || error);
  const id=Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,message))
    .slice(0,60);
  if(PropertiesService.getScriptProperties().getProperty(AW_ALERT_FAILURE_KEY)===id)
    return;
  awAlertSend_('[ERROR] RockCentral daily gig workflow failed',
    ['The scheduled gig workflow did not complete.',
      'Reason: '+message,
      'Please inspect Apps Script > Executions.',
      'Do not assume the public site updated successfully.']);
  PropertiesService.getScriptProperties().setProperty(AW_ALERT_FAILURE_KEY,id);
}
function awAlertClearFailure_(){
  PropertiesService.getScriptProperties().deleteProperty(AW_ALERT_FAILURE_KEY);
}
function testAnthonyAlertRules(){
  const v=Array(AW_SYNC.columns).fill('');
  v[AW_COL.key]='fictional|slot:1';
  v[AW_COL.date]='2027-05-04';
  v[AW_COL.title]='GIG - Fictional Town - MC - Test Company';
  v[AW_COL.sync]='Active';v[AW_COL.review]='Needs review';
  v[AW_COL.publish]='No';
  const row={sheetRow:2,v};
  const tests={
    unlinkedNeedsReview:awAlertReviewItems_([row],[],'2027-01-01').length===1,
    linkedNotRealerted:awAlertReviewItems_([row],[{
      key:awV05OpaqueId_(v[AW_COL.key])}],'2027-01-01').length===0,
    holdNotReported:(()=>{const x={sheetRow:2,v:[...v]};x.v[AW_COL.sync]='Hold';
      return awAlertReviewItems_([x],[],'2027-01-01').length===0;})(),
    privateFeeHidden:!awAlertPlain_('MC £200 - Example').includes('£200'),
    cancelledLinkedUrgent:(()=>{
      const x={sheetRow:2,v:[...v]};x.v[AW_COL.sync]='Cancelled';
      const p={linked:[{privateRow:2,publicRow:10,key:v[AW_COL.key],
        check:'PUBLIC_LISTING_NEEDS_REVIEW'}]};
      return awAlertUrgentItems_(p,[x],[]).length===1;
    })()
  };
  Logger.log(JSON.stringify({version:AW_ALERT_VERSION,tests},null,2));
  if(Object.values(tests).some(x=>!x))throw new Error('Alert tests failed');
  return tests;
}
