/**
 * ANTHONY GIG RECONCILIATION - VERSION 0.6.2 (11 NOV 2026)
 * Read-only preview followed by deliberate link-only write.
 * No hardcoded gig, venue, date, postcode, ticket or act details.
 * Requires Code.gs v0.2.2, AnthonyPublicBridge v0.3.1,
 * AnthonyAutoPublisher v0.5.3 (awV05OpaqueId_ and awV05Read_).
 * NEVER changes public columns A:I or private review/approval fields.
 */
const AW_LINK_VERSION='0.6.2';
const AW_LINK_STOP=new Set([
  'the','and','for','with','comedy','club','gig','mc','opener','opening',
  'closer','closing','middle','headline','headliner','venue','live',
  'night','at','room','a','of','in','to','on','by','from','theatre',
  'pub','hall','rockcentral','promotions','funhouse','stage','lights',
  'sound','mins','min','minutes','pounds','cash','more','info','soon',
  'anthony','williams','show','tickets','ticket','details','follow',
  'year','new','christmas'
]);
function awLinkTokens_(s) {
  return [...new Set(String(s||'').toLowerCase()
    .replace(/£\s*\d+/g,' ').replace(/\b\d+\b/g,' ')
    .replace(/[^a-z]+/g,' ').split(/\s+/)
    .filter(x=>x.length>=3&&!AW_LINK_STOP.has(x)))];
}
function awLinkCandidate_(r,p) {
  const v=r.v;
  if(v[AW_COL.date]!==p.date)return null;
  const calendar=[v[AW_COL.title],v[AW_COL.location]].filter(Boolean).join(' ');
  const publicText=[p.venue,p.location,p.notes].filter(Boolean).join(' ');
  const a=awLinkTokens_(calendar), b=awLinkTokens_(publicText);
  const shared=a.filter(t=>b.includes(t));
  const title=String(v[AW_COL.title]||'').toLowerCase();
  const venue=String(p.venue||'').toLowerCase();
  const titleTokens=awLinkTokens_(title);
  const venueTokens=awLinkTokens_(venue);
  const venueShared=venueTokens.filter(x=>a.includes(x));
  const town=awLinkTokens_(p.location||'');
  const townShared=town.filter(x=>a.includes(x));
  const noteShared=awLinkTokens_(p.notes||'').filter(x=>titleTokens.includes(x));
  const postA=awV05Postcode_(v[AW_COL.location]);
  const postB=awV05Postcode_(p.address);
  const postcodeMatch=!!(postA&&postB&&postA===postB);
  // Date is necessary but cannot alone establish identity.
  const score=(postcodeMatch?9:0)+
    Math.min(venueShared.length,3)*4+
    Math.min(townShared.length,2)*3+
    Math.min(noteShared.length,3)*3+
    Math.min(shared.length,4);
  const grounded=postcodeMatch || venueShared.length>=2 ||
    (venueShared.length>=1 && (townShared.length>=1||noteShared.length>=1)) ||
    (townShared.length>=1 && noteShared.length>=1) ||
    (noteShared.length>=2 && shared.length>=2);
  return {privateRow:r.sheetRow,publicRow:p.row,
    score,grounded,signals:{
      postcodeMatch,venueWords:venueShared,townWords:townShared,
      promoterWords:noteShared
    },date:p.date,calendarTitle:v[AW_COL.title],publicVenue:p.venue};
}
function awLinkPlan_(privateRows,publicRows) {
  const open=publicRows.filter(p=>p.date>=awIso_(new Date())&&!p.key);
  const existingKeys=new Set(publicRows.map(x=>x.key).filter(Boolean));
  const active=privateRows.filter(r=>
    r.v[AW_COL.sync]==='Active' &&
    r.v[AW_COL.date]>=awIso_(new Date()) &&
    !existingKeys.has(awV05OpaqueId_(r.v[AW_COL.key])) &&
    !/\b(?:fixture|test)\b/i.test(r.v[AW_COL.title]||''));
  const options=active
    .flatMap(r=>open.filter(p=>p.date===r.v[AW_COL.date])
      .map(p=>awLinkCandidate_(r,p)).filter(Boolean));
  const matches=[],review=[];
  const occupiedPriv=new Set(),occupiedPub=new Set();
  const best=options.filter(x=>x.grounded && x.score>=8 && (x.signals.postcodeMatch || x.signals.venueWords.length>=2 || (x.signals.venueWords.length>=1 && x.signals.townWords.length>=1) || (x.signals.townWords.length>=1 && x.signals.promoterWords.length>=1)))
    .sort((a,b)=>b.score-a.score||a.privateRow-b.privateRow);
  for(const option of best){
    if(occupiedPriv.has(option.privateRow)||occupiedPub.has(option.publicRow))continue;
    const privatePeers=options.filter(x=>x.privateRow===option.privateRow)
      .sort((a,b)=>b.score-a.score);
    const publicPeers=options.filter(x=>x.publicRow===option.publicRow)
      .sort((a,b)=>b.score-a.score);
    if((privatePeers[1]&&option.score-privatePeers[1].score<3)||
       (publicPeers[1]&&option.score-publicPeers[1].score<3)){
      review.push({...option,reason:'Competing candidate within score margin'});
      continue;
    }
    matches.push(option);
    occupiedPriv.add(option.privateRow);occupiedPub.add(option.publicRow);
  }
  return {matches,review,
    unlinkedPrivate:active.filter(r=>!occupiedPriv.has(r.sheetRow))
      .map(r=>({privateRow:r.sheetRow,date:r.v[AW_COL.date],title:r.v[AW_COL.title]})),
    unlinkedPublic:open.filter(p=>!occupiedPub.has(p.row))
      .map(p=>({publicRow:p.row,date:p.date,venue:p.venue||p.location})),
    allCandidateCount:options.length};
}
function awLinkLoad_(){
  const privateRows=awReadRegister_().rows;
  const {sheet,rows}=awV05Read_();
  return {sheet,privateRows,rows,plan:awLinkPlan_(privateRows,rows)};
}
function previewAnthonyLegacyLinks(){
  const {plan}=awLinkLoad_();
  const report={
    version:AW_LINK_VERSION,mode:'PREVIEW_LINKS_NO_WRITES',
    proposedLinks:plan.matches.length,
    ambiguous:plan.review.length,
    unmatchedPrivate:plan.unlinkedPrivate.length,
    unmatchedPublic:plan.unlinkedPublic.length,
    links:plan.matches.map(x=>({
      privateRow:x.privateRow,publicRow:x.publicRow,date:x.date,
      calendarTitle:x.calendarTitle,publicVenue:x.publicVenue,
      score:x.score,signals:x.signals
    })),
    ambiguousSample:plan.review.slice(0,15),
    unmatchedPrivateSample:plan.unlinkedPrivate.slice(0,20),
    unmatchedPublicSample:plan.unlinkedPublic.slice(0,12),
    publicDetailsModified:0,privateRegisterWrites:0,calendarWrites:0
  };
  Logger.log(JSON.stringify(report,null,2));
  return report;
}
function linkAnthonyLegacyGigs(){
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(15000))throw new Error('Another link job is running');
  try {
    const {sheet,privateRows,plan}=awLinkLoad_();
    const privateByRow=new Map(privateRows.map(r=>[r.sheetRow,r]));
    // Only write J in previously unlinked rows; abort if data changed.
    const writes=plan.matches.map(x=>{
      const privateRow=privateByRow.get(x.privateRow);
      if(!privateRow)throw new Error('Private row no longer exists at '+x.privateRow);
      const key=privateRow.v[AW_COL.key];
      if(!key)throw new Error('Missing private key at '+x.privateRow);
      return {publicRow:x.publicRow,key:awV05OpaqueId_(key),date:x.date};
    });
    // Preflight every target before any write. Check date and blank link.
    for(const x of writes) {
      const cells=sheet.getRange(x.publicRow,1,1,10).getDisplayValues()[0];
      if(String(cells[9]).trim() || cells[0]!==x.date)
        throw new Error('Public listing changed since reconciliation at row '+x.publicRow);
    }
    for(const x of writes) sheet.getRange(x.publicRow,10).setValue(x.key);
    SpreadsheetApp.flush();
    for(const x of writes) if(sheet.getRange(x.publicRow,10).getDisplayValue()!==x.key)
      throw new Error('Link verification failed at row '+x.publicRow);
    const result={version:AW_LINK_VERSION,mode:'LINK_ONLY',
      linked:plan.matches.length,ambiguous:plan.review.length,
      outstandingPrivate:plan.unlinkedPrivate.length,
      publicDetailsModified:0,privateRegisterWrites:0,calendarWrites:0};
    Logger.log(JSON.stringify(result,null,2));
    return result;
  }finally {lock.releaseLock();}
}
function testAnthonyLegacyLinks(){
  const fake=(row,date,title,location='')=>{
    const v=Array(AW_SYNC.columns).fill('');
    v[AW_COL.key]='fixture-'+row;v[AW_COL.date]=date;
    v[AW_COL.title]=title;v[AW_COL.location]=location;
    v[AW_COL.sync]='Active';return {sheetRow:row,v};
  };
  const p=(row,date,venue,location,notes='',address='')=>({
    row,date,venue,location,notes,address,key:''
  });
  const date='2027-07-08';
  const positive=awLinkCandidate_(fake(2,date,'MC at Exampletown Social Club'),
    p(4,date,'Exampletown Social Club','Exampletown'));
  const unrelated=awLinkCandidate_(fake(3,date,'MC at Village Hall, Southport'),
    p(5,date,'Somewhere Else','Liverpool'));
  const checks={
    uniqueVenueTownMatched:positive.grounded&&positive.score>=7,
    unrelatedSameDateRejected:!unrelated.grounded,
    sameVenueDifferentDateIgnored:awLinkCandidate_(
      fake(2,'2027-07-09','MC at Exampletown Social Club'),
      p(4,date,'Exampletown Social Club','Exampletown'))===null,
    oneToOnePreventsCollision:awLinkPlan_([
      fake(2,date,'MC Exampletown Social Club'),
      fake(3,date,'MC Exampletown Social Club')
    ],[p(4,date,'Exampletown Social Club','Exampletown')]).matches.length===0,
    existingLinkedPublicExcluded:awLinkPlan_([
      fake(2,date,'MC at Exampletown Social Club')
    ],[{...p(4,date,'Exampletown Social Club','Exampletown'),key:'already'}]).matches.length===0,
    privateTestExcluded:awLinkPlan_([
      fake(2,date,'GIG Fixture Exampletown Social Club')
    ],[p(4,date,'Exampletown Social Club','Exampletown')]).matches.length===0,
    sameTownOnlyIsNotProof:awLinkPlan_([
      fake(2,date,'Exampletown MC')
    ],[p(4,date,'Other Venue','Exampletown','Exampletown')]).matches.length===0,
    noTownOrVenueNotAutolinked:awLinkPlan_([
      fake(2,date,'Mia Smith MC')
    ],[p(4,date,'Unrelated Hall','Other Town','Mia Smith')]).matches.length===0
  };
  Logger.log(JSON.stringify({version:AW_LINK_VERSION,checks},null,2));
  if(Object.values(checks).some(x=>!x))throw new Error('Link test failed');
  return checks;
}
