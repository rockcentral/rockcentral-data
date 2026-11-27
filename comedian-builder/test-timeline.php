<?php
declare(strict_types=1);
require __DIR__ . '/core.php';
function check(bool $value,string $label):void {
    if(!$value){fwrite(STDERR,"FAIL {$label}\n");exit(1);}
    echo "PASS {$label}\n";
}
$site='timelinetest';
$db=siteDB($site);
$db->exec("DELETE FROM timeline");
$db->prepare("DELETE FROM settings WHERE name='sections'")->execute();
check(!siteSections($site)['timeline'],'default timeline invisible');
check(!count(publicTimeline($site)),'empty public timeline');
$threw=false;
try {saveSections(['timeline'=>1],$site);} catch(RuntimeException $e){$threw=str_contains($e->getMessage(),'Publish at least one');}
check($threw,'cannot enable empty timeline');
$insert=$db->prepare('INSERT INTO timeline(year,date_label,title,caption,image,image_alt,sort_order,status) VALUES (?,?,?,?,?,?,?,?)');
$photo='/Richard/media/'.str_repeat('a',32).'.jpg';
$insert->execute([1994,'1994','An unpublished memory','Draft text',$photo,'Image caption',0,'draft']);
check(!count(publicTimeline($site)),'draft excluded from public list');
$insert->execute([1992,'Autumn 1992','Radio and stage','Caption containing <script>alert("test")</script>',$photo,'A historical theatre photograph',2,'published']);
$insert->execute([1986,'','Panic Brothers','First show',$photo,'Two performers with guitars',0,'published']);
$insert->execute([1992,'Spring 1992','Tour highlight','Another milestone',$photo,'Stage photograph',1,'published']);
$rows=publicTimeline($site);
check(count($rows)===3,'only published milestone images in feed');
check(array_column($rows,'title')===['Panic Brothers','Tour highlight','Radio and stage'],'year and manual sort order');
check($rows[0]['year']===1986 && $rows[0]['date_label']==='','typed year and optional date detail');
check($rows[2]['caption']!=='' && str_contains($rows[2]['caption'],'<script>'),'raw caption retained for safe textContent rendering, not HTML injection');
saveSections(['timeline'=>1,'reviews'=>1],$site);
check(siteSections($site)['timeline'],'timeline can enable after publication');
saveSections([], $site);
check(!siteSections($site)['timeline'],'timeline can hide without deleting published history');
check(count(publicTimeline($site))===3,'toggling visibility retains records');
check(count(publicGigs($site))===0,'existing gig feature unaffected');
echo "ALL_TIMELINE_TESTS_PASSED\n";
