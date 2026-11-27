<?php
declare(strict_types=1);
require dirname(__DIR__, 3) . '/.comedian-builder/core.php';
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
$slug=(string)($_GET['slug']??'');
$entry=null;
if ($slug!=='') {
 if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D',$slug)) {http_response_code(404);}
 else {
  $q=siteDB()->prepare("SELECT title,slug,body,featured_image,published_at FROM articles WHERE status='published' AND slug=?");
  $q->execute([$slug]);$entry=$q->fetch()?:null;
  if (!$entry) http_response_code(404);
 }
}
$articles=$slug===''?publicArticles('richard',100):[];
$title=$entry?$entry['title'].' | Richard Morton':'Latest News | Richard Morton';
?><!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title><?=esc($title)?></title><meta name="description" content="Latest news, stories and updates from Richard Morton, stand-up comedian and musician.">
<style>
:root{--bg:#141517;--surface:#202124;--line:#3e4146;--ink:#f5f1e9;--muted:#c2beb8;--orange:#ff922b}
*{box-sizing:border-box}body{background:var(--bg);color:var(--ink);margin:0;font:17px/1.7 Arial,Helvetica,sans-serif}
a{color:var(--orange)}a:hover{text-decoration:none}header{background:#17181a;border-bottom:1px solid var(--line);padding:18px 0}
.wrap{width:min(880px,calc(100% - 36px));margin:auto}.head{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
.word{font-weight:900;color:#fff;text-decoration:none;letter-spacing:-.03em}header nav{display:flex;gap:20px}
h1{font-size:clamp(36px,7vw,67px);letter-spacing:-.065em;line-height:1.12;margin:43px 0 15px}
h2{letter-spacing:-.04em;font-size:29px;line-height:1.22}.meta{font-size:14px;color:var(--muted)}
article{border-bottom:1px solid var(--line);padding:26px 0 38px}
article a.title{font-size:clamp(24px,4vw,36px);line-height:1.2;font-weight:800;text-decoration:none}
article img.cover,.body img{max-width:100%;height:auto;display:block;border-radius:8px;margin:20px 0}
.body{font-size:18px;line-height:1.8}.body blockquote{border-left:4px solid var(--orange);padding-left:24px;margin:25px 0;color:#ded9d1}.body a{text-decoration:underline}.body h2,.body h3{margin-top:35px}
.excerpt{color:#ccc8c1}.empty{padding:40px 0}
footer{border-top:1px solid var(--line);margin-top:60px;padding:22px 0;color:var(--muted);font-size:14px}
</style></head><body>
<header><div class="wrap head"><a class="word" href="/Richard/">RICHARD MORTON</a><nav><a href="/Richard/">Home</a><a href="/Richard/news/">Latest News</a></nav></div></header>
<main class="wrap">
<?php if($slug!=='' && !$entry):?><h1>Article not found</h1><p>This article is not currently published. <a href="/Richard/news/">Back to Latest News</a>.</p>
<?php elseif($entry):?>
<article><p class="meta"><a href="/Richard/news/">Latest News</a> · <?=esc(date('j F Y',strtotime($entry['published_at'].' UTC')))?></p>
<h1><?=esc($entry['title'])?></h1>
<?php if($entry['featured_image']):?><img class="cover" src="<?=esc($entry['featured_image'])?>" alt="<?=esc($entry['title'])?>"><?php endif ?>
<div class="body"><?=cleanRichText($entry['body'])?></div></article>
<p><a href="/Richard/news/">← All news</a></p>
<?php else:?>
<h1>Latest News</h1><p class="excerpt">News, stories and updates from Richard Morton.</p>
<?php if(!$articles):?><p class="empty">There are no published updates yet.</p><?php endif ?>
<?php foreach($articles as $a):?><article>
<p class="meta"><?=esc(date('j F Y',strtotime($a['date'].' UTC')))?></p>
<?php if($a['image']):?><a href="<?=esc($a['url'])?>"><img class="cover" src="<?=esc($a['image'])?>" alt=""></a><?php endif ?>
<a class="title" href="<?=esc($a['url'])?>"><?=esc($a['title'])?></a><p class="excerpt"><?=esc($a['excerpt'])?></p><a href="<?=esc($a['url'])?>">Read more</a>
</article><?php endforeach ?>
<?php endif ?>
</main><footer><div class="wrap">Richard Morton · Stand-up comedian and musician · Website preview</div></footer>
</body></html>
