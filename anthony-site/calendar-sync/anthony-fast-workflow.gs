/**
 * ROCKCENTRAL / ANTHONY GIGS - FAST TRIGGERS
 * VERSION 0.9.0 (12 November 2026)
 *
 * Extends the EXISTING tested workflow; does not alter publication rules.
 * - Every 15 minutes: calendar -> private register -> email -> approved new gigs.
 * - Immediately after a manual Google Sheet edit: publish approved new gigs.
 * - API/chat edits do not fire onEdit; 15-minute job catches those too.
 *
 * Requires Code.gs v0.2.6, AnthonyAutoPublisher.gs v0.5.3,
 * AnthonyGigAlerts.gs v0.8.6, AnthonyDailyWorkflow.gs v0.8.4.
 * Does NOT create triggers automatically when pasted. Run tests first,
 * then enableAnthonyFastGigTriggers exactly once.
 */
const AW_FAST_VERSION='0.9.0';
const AW_FAST_HANDLER='dailyAnthonySafeWorkflow';
const AW_FAST_EDIT_HANDLER='onAnthonyGigRegisterEdit';
const AW_FAST_INTERVAL_MINUTES=15;

function awFastIsRelevantEdit_(sheetName,spreadsheetId,firstRow,firstCol,
                                 lastCol) {
  return sheetName===AW_SYNC.tab &&
    spreadsheetId===AW_SYNC.workingSheetId &&
    firstRow>1 && lastCol>=AW_COL.review+1 &&
    firstCol<=AW_COL.ticketStatus+1;
}

function awFastApprovedEditedRows_(range, sheet) {
  const first=range.getRow();
  const last=first+range.getNumRows()-1;
  if (last<2)return [];
  const top=Math.max(2,first);
  // Inspect only edited rows, not unrelated approved bookings.
  const values=sheet.getRange(top,1,last-top+1,AW_SYNC.columns)
    .getDisplayValues();
  return values.map((v,i)=>({
    row:top+i,
    approved:v[AW_COL.review]==='Approved' && v[AW_COL.publish]==='Yes',
    active:v[AW_COL.sync]==='Active'
  })).filter(x=>x.approved && x.active).map(x=>x.row);
}

/**
 * Installable Google Sheets onEdit trigger. Fires only for HUMAN edits
 * inside the private register, not Google Sheets API or Apps Script writes.
 */
function onAnthonyGigRegisterEdit(e) {
  if(!e || !e.range) {
    Logger.log('onEdit requires an installable edit event; no changes made.');
    return {version:AW_FAST_VERSION,reason:'NO_EDIT_EVENT'};
  }
  const range=e.range, sheet=range.getSheet();
  const firstCol=range.getColumn();
  const lastCol=firstCol+range.getNumColumns()-1;
  if(!awFastIsRelevantEdit_(sheet.getName(),sheet.getParent().getId(),
    range.getRow(),firstCol,lastCol))return {version:AW_FAST_VERSION,ignored:true};
  const approvedRows=awFastApprovedEditedRows_(range,sheet);
  if(!approvedRows.length)return {version:AW_FAST_VERSION,ignored:true};

  try {
    const privateRows=awReadRegister_().rows;
    const publicData=awV05Read_();
    const plan=awV05Plan_(privateRows,publicData.rows,awIso_(new Date()));
    const urgent=awAlertUrgentItems_(plan,privateRows,[]);
    if(urgent.length) {
      // If ANY existing published gig is in conflict, do not publish another.
      // The 15-minute job sends the deduplicated urgent email.
      Logger.log(JSON.stringify({version:AW_FAST_VERSION,
        status:'BLOCKED_BY_EXISTING_PUBLIC_CONFLICT',
        urgent:urgent.length,calendarWrites:0,publicWrites:0}));
      return {version:AW_FAST_VERSION,blocked:urgent.length};
    }
    const toPublish=plan.add.filter(x=>approvedRows.includes(x.privateRow));
    // No blanket publishing on an unrelated edit; the 15-min fallback
    // handles previously approved entries without a manual edit.
    if(!toPublish.length) {
      Logger.log(JSON.stringify({version:AW_FAST_VERSION,
        status:'NO_READY_EDITED_GIG',editedRows:approvedRows}));
      return {version:AW_FAST_VERSION,published:0};
    }
    // Re-read and re-plan under the publisher's lock; preserves all
    // validation, duplicate and linked-row protections.
    const result=publishAnthonyApprovedGigs();
    Logger.log(JSON.stringify({version:AW_FAST_VERSION,
      mode:'MANUAL_EDIT_PUBLISH',
      editedRows:approvedRows,published:result.published}));
    return {version:AW_FAST_VERSION,published:result.published};
  } catch(error) {
    try{awAlertWorkflowFailure_(error);}
    catch(mailError){Logger.log('ALERT DELIVERY ERROR: '+mailError.message);}
    throw error;
  }
}

/**
 * Replace the old once-daily trigger with a 15-minute trigger PLUS
 * a spreadsheet onEdit trigger, without modifying code's business rules.
 * Other unrelated Apps Script triggers are left completely untouched.
 *
 * Creates both new triggers BEFORE deleting old ones. A failed
 * installation cleans up only its own newly created triggers, keeping
 * the original daily trigger in place.
 */
function enableAnthonyFastGigTriggers() {
  const previous=ScriptApp.getProjectTriggers().filter(t=>
    [AW_FAST_HANDLER,AW_FAST_EDIT_HANDLER,
      'dailyAnthonyGigWorkflow'].includes(t.getHandlerFunction()));
  const made=[];
  try {
    made.push(ScriptApp.newTrigger(AW_FAST_HANDLER)
      .timeBased().everyMinutes(AW_FAST_INTERVAL_MINUTES).create());
    made.push(ScriptApp.newTrigger(AW_FAST_EDIT_HANDLER)
      .forSpreadsheet(AW_SYNC.workingSheetId).onEdit().create());
  } catch(error) {
    made.forEach(t=>{try{ScriptApp.deleteTrigger(t);}catch(ignore){}});
    throw error;
  }
  let removed=0;
  previous.forEach(t=>{ScriptApp.deleteTrigger(t);removed++;});
  const result={version:AW_FAST_VERSION,
    mode:'FAST_TRIGGERS_ENABLED',
    calendarCheckEveryMinutes:AW_FAST_INTERVAL_MINUTES,
    publishOnManualRegisterEdit:true,
    apiEditFallbackMinutes:AW_FAST_INTERVAL_MINUTES,
    replacedWorkflowTriggers:removed,
    newTriggers:2,otherTriggersUntouched:true};
  Logger.log(JSON.stringify(result,null,2));
  return result;
}

/**
 * Safe read-only setup check before installing.
 * Does not synchronise calendar, send emails or write either sheet.
 */
function previewAnthonyFastGigTriggers() {
  const triggers=ScriptApp.getProjectTriggers().map(t=>({
    handler:t.getHandlerFunction(),
    eventType:String(t.getEventType())}));
  const result={version:AW_FAST_VERSION,mode:'READ_ONLY_PREVIEW',
    existingWorkflowTriggers:triggers.filter(t=>
      [AW_FAST_HANDLER,AW_FAST_EDIT_HANDLER,
        'dailyAnthonyGigWorkflow'].includes(t.handler)),
    otherTriggerCount:triggers.filter(t=>
      ![AW_FAST_HANDLER,AW_FAST_EDIT_HANDLER,
        'dailyAnthonyGigWorkflow'].includes(t.handler)).length,
    noWrites:true,noEmails:true};
  Logger.log(JSON.stringify(result,null,2));return result;
}

function testAnthonyFastGigRules() {
  const tab=AW_SYNC.tab,id=AW_SYNC.workingSheetId;
  const valid=(r,first,last)=>awFastIsRelevantEdit_(tab,id,r,first,last);
  const checks={
    approvalCellDetected:valid(12,10,10),
    publishCellDetected:valid(12,11,11),
    publicDetailsDetected:valid(12,12,17),
    bulkEditDetected:valid(12,8,17),
    sourceTitleIgnored:!valid(12,5,5),
    calendarFieldsIgnored:!valid(12,1,9),
    headerIgnored:!valid(1,10,10),
    unrelatedSheetIgnored:!awFastIsRelevantEdit_('Other',id,12,10,11),
    otherSpreadsheetIgnored:!awFastIsRelevantEdit_(tab,'other',12,10,11),
    publicSheetNotAttached:id!==AW_PUBLIC_FEED.sheetId,
    fifteenMinuteInterval:AW_FAST_INTERVAL_MINUTES===15
  };
  Logger.log(JSON.stringify({version:AW_FAST_VERSION,checks},null,2));
  if(Object.values(checks).some(x=>!x))
    throw new Error('Fast gig trigger tests failed');
  return checks;
}
