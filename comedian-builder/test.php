<?php
declare(strict_types=1);
require __DIR__ . '/core.php';
function ok(bool $test,string $label):void {if(!$test){fwrite(STDERR,'FAIL '.$label.PHP_EOL);exit(1);}echo 'PASS '.$label.PHP_EOL;}
$db=siteDB('richardtest');
$s=siteSections('richardtest');
ok($s['news']===false && $s['gigs']===false && $s['music']===true,'default section states');
saveSections(['news'=>'1','music'=>'1','gigs'=>'1'],'richardtest');
$s=siteSections('richardtest');
ok($s['news']===true && $s['gigs']===true && $s['reviews']===false,'section updates and absent checkboxes');
$html=cleanRichText('<h2 onclick="evil()">Hi</h2><script>alert(1)</script><p><a href="javascript:alert(1)">X</a><strong>Safe</strong></p><img src="/Richard/media/0123456789abcdef0123456789abcdef.jpg" onerror="alert(1)">');
ok(str_contains($html,'<h2>Hi</h2>') && str_contains($html,'<strong>Safe</strong>'),'preserves permitted rich text');
ok(!str_contains($html,'script')&&!str_contains($html,'javascript:')&&!str_contains($html,'onerror')&&!str_contains($html,'onclick'),'removes dangerous code and attributes');
ok(str_contains($html,'/Richard/media/0123456789abcdef0123456789abcdef.jpg'),'permits vetted local images');
ok(safeUrl('javascript:alert(1)')==='' && safeUrl('https://example.org/tickets')!=='','safe ticket URLs');
ok(slugify('An Edinburgh Memory!')==='an-edinburgh-memory','slug generation');
$db->prepare("INSERT INTO articles(title,slug,body,status,published_at) VALUES(?,?,?,?,?)")->execute(['Sample','sample',$html,'published','2026-11-27 19:00:00']);
$db->prepare("INSERT INTO gigs(date,time,venue,town,status) VALUES(?,?,?,?,?)")->execute(['2027-02-07','20:30','Example Theatre','London','published']);
ok(count(publicArticles('richardtest'))===1 && publicArticles('richardtest')[0]['url']==='/Richard/news/sample/','public article feed');
ok(count(publicGigs('richardtest'))===1,'public gigs date-filtering');
echo 'ALL_TESTS_PASSED'.PHP_EOL;
