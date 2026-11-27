<?php
declare(strict_types=1);
require dirname(__DIR__, 3) . '/.comedian-builder/core.php';
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
startSiteSession();
$db=siteDB();
$error='';$notice='';
if ($_SERVER['REQUEST_METHOD']==='POST') {
    $action=(string)($_POST['action']??'');
    try {
        checkCsrf();
        if ($action==='login') {
            $ip=substr((string)($_SERVER['REMOTE_ADDR']??'unknown'),0,60);
            $row=$db->prepare('SELECT failures,first_attempt FROM failed_logins WHERE ip=?');$row->execute([$ip]);$failed=$row->fetch();
            if ($failed && time()-(int)$failed['first_attempt']<900 && (int)$failed['failures']>=8) throw new RuntimeException('Too many attempts. Try again in 15 minutes.');
            $hashFile=dirname(__DIR__,3).'/.comedian-builder/richard-admin.hash';
            $hash=is_file($hashFile)?trim(file_get_contents($hashFile)):'';
            $pw=(string)($_POST['password']??'');
            if (!$hash || !password_verify($pw,$hash)) {
                $first=(!$failed || time()-(int)$failed['first_attempt']>=900)?time():(int)$failed['first_attempt'];
                $number=(!$failed || $first===time())?1:((int)$failed['failures']+1);
                $db->prepare('INSERT INTO failed_logins(ip,failures,first_attempt) VALUES(?,?,?) ON CONFLICT(ip) DO UPDATE SET failures=excluded.failures,first_attempt=excluded.first_attempt')->execute([$ip,$number,$first]);
                throw new RuntimeException('Incorrect password');
            }
            $db->prepare('DELETE FROM failed_logins WHERE ip=?')->execute([$ip]);
            session_regenerate_id(true);$_SESSION['editor']=true;
            header('Location: /Richard/studio/');exit;
        }
        requireEditor();
        if ($action==='logout') { $_SESSION=[];session_destroy();header('Location: /Richard/studio/');exit; }
        if ($action==='change_password') {
            $hashPath=dirname(__DIR__,3).'/.comedian-builder/richard-admin.hash';
            $oldHash=is_file($hashPath)?trim(file_get_contents($hashPath)):'';
            $old=(string)($_POST['current_password']??'');
            $new=(string)($_POST['new_password']??'');
            if (!$oldHash || !password_verify($old,$oldHash)) throw new RuntimeException('Current password is incorrect');
            if (strlen($new)<14 || strlen($new)>128 || $new!==($_POST['confirm_password']??'')) throw new RuntimeException('New password must match and contain at least 14 characters');
            $temporary=$hashPath.'.'.bin2hex(random_bytes(6)).'.tmp';
            if(file_put_contents($temporary,password_hash($new,PASSWORD_DEFAULT)."\n",LOCK_EX)===false)throw new RuntimeException('Could not update password');
            chmod($temporary,0600);
            if(!rename($temporary,$hashPath))throw new RuntimeException('Could not activate new password');
            session_regenerate_id(true);
            header('Location: /Richard/studio/?saved=password');exit;
        }
        if ($action==='sections') {
            saveSections((array)($_POST['sections']??[]));
            header('Location: /Richard/studio/?saved=sections');exit;
        }
        if ($action==='upload') {
            header('Content-Type: application/json; charset=utf-8');
            $url=uploadSiteImage($_FILES['image']??[]);
            echo json_encode(['url'=>$url], JSON_THROW_ON_ERROR);exit;
        }
        if ($action==='article') {
            $id=max(0,(int)($_POST['id']??0));
            $existing=null;
            if ($id) { $st=$db->prepare('SELECT * FROM articles WHERE id=?');$st->execute([$id]);$existing=$st->fetch();if(!$existing) throw new RuntimeException('Article not found'); }
            $title=trim((string)($_POST['title']??''));
            $slug=slugify((string)($_POST['slug']??'')) ?: slugify($title);
            if ($title==='' || mb_strlen($title)>160 || $slug==='') throw new RuntimeException('Enter a valid article title and URL slug');
            // Published URLs remain stable when articles are edited.
            if ($existing && $existing['status']==='published') $slug=$existing['slug'];
            $status=($_POST['status']??'draft')==='published'?'published':'draft';
            $body=cleanRichText((string)($_POST['body']??''));
            if ($status==='published' && trim(strip_tags($body))==='') throw new RuntimeException('Write some article text before publishing');
            $image=(string)($existing['featured_image']??'');
            if (isset($_FILES['cover_upload']) && ($_FILES['cover_upload']['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_NO_FILE) $image=uploadSiteImage($_FILES['cover_upload']);
            if (!empty($_POST['remove_image'])) $image='';
            $published=$status==='published'?($existing['published_at']??gmdate('Y-m-d H:i:s')):null;
            if ($id) {
                $db->prepare('UPDATE articles SET title=?,slug=?,body=?,featured_image=?,status=?,published_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
                    ->execute([$title,$slug,$body,$image,$status,$published,$id]);
            } else {
                $db->prepare('INSERT INTO articles(title,slug,body,featured_image,status,published_at) VALUES(?,?,?,?,?,?)')
                    ->execute([$title,$slug,$body,$image,$status,$published]);
            }
            header('Location: /Richard/studio/?saved=article');exit;
        }
        if ($action==='gig') {
            $id=max(0,(int)($_POST['id']??0));$date=(string)($_POST['date']??'');$time=(string)($_POST['time']??'');
            $venue=trim((string)($_POST['venue']??''));$town=trim((string)($_POST['town']??''));
            $url=trim((string)($_POST['ticket_url']??''));$status=($_POST['status']??'draft')==='published'?'published':'draft';
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$date) || !checkdate((int)substr($date,5,2),(int)substr($date,8,2),(int)substr($date,0,4))) throw new RuntimeException('Select a valid gig date');
            if ($time!=='' && !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/D',$time)) throw new RuntimeException('Use a 24-hour time');
            if ($venue==='' || mb_strlen($venue)>180 || mb_strlen($town)>140) throw new RuntimeException('Enter a valid venue and town');
            if ($url!=='' && safeUrl($url)==='') throw new RuntimeException('Ticket link must be a valid http or https URL');
            if ($id) {
                $test=$db->prepare('SELECT id FROM gigs WHERE id=?');$test->execute([$id]);if(!$test->fetch())throw new RuntimeException('Gig not found');
                $db->prepare('UPDATE gigs SET date=?,time=?,venue=?,town=?,ticket_url=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')->execute([$date,$time,$venue,$town,$url,$status,$id]);
            } else {
                $db->prepare('INSERT INTO gigs(date,time,venue,town,ticket_url,status) VALUES(?,?,?,?,?,?)')->execute([$date,$time,$venue,$town,$url,$status]);
            }
            header('Location: /Richard/studio/?saved=gig');exit;
        }
        throw new RuntimeException('Unknown action');
    } catch (Throwable $e) {
        if ($action==='upload') { http_response_code(422);header('Content-Type: application/json');echo json_encode(['error'=>$e->getMessage()]);exit; }
        $error=$e instanceof PDOException ? 'That URL slug is already in use, or the database rejected the change.' : $e->getMessage();
    }
}
$token=csrfToken();$sections=siteSections();
$editArticle=null;$editGig=null;
if(isEditor() && isset($_GET['article'])) {$st=$db->prepare('SELECT * FROM articles WHERE id=?');$st->execute([(int)$_GET['article']]);$editArticle=$st->fetch()?:null;}
if(isEditor() && isset($_GET['gig'])) {$st=$db->prepare('SELECT * FROM gigs WHERE id=?');$st->execute([(int)$_GET['gig']]);$editGig=$st->fetch()?:null;}
$articles=isEditor()?$db->query('SELECT id,title,slug,status,published_at FROM articles ORDER BY updated_at DESC,id DESC')->fetchAll():[];
$gigs=isEditor()?$db->query('SELECT id,date,time,venue,town,status FROM gigs ORDER BY date DESC,id DESC')->fetchAll():[];
?><!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Richard Morton | Website Studio</title>
<style>
:root{--bg:#121416;--panel:#202328;--line:#41454b;--text:#f9f6ef;--muted:#bbb9b3;--accent:#ff922b}
*{box-sizing:border-box}body{background:var(--bg);color:var(--text);font:16px/1.55 system-ui,Arial;margin:0}
a{color:var(--accent)}a:hover{text-decoration:underline}
header{padding:20px 0;border-bottom:1px solid var(--line)}
.wrap{width:min(1080px,calc(100% - 32px));margin:auto}
.top{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
h1{font-size:clamp(27px,4vw,38px);letter-spacing:-.05em;margin:24px 0 4px}h2{font-size:23px;margin:0 0 14px}h3{margin:0 0 6px}
p.small,small{color:var(--muted)}.panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:22px;margin:20px 0}
input,textarea,button,select{font:inherit}input[type=text],input[type=password],input[type=date],input[type=time],input[type=url],textarea,select{display:block;width:100%;padding:11px 12px;background:#14171a;color:var(--text);border:1px solid #6b7179;border-radius:5px}
label.field{display:block;font-weight:650;margin:15px 0 6px}button,.button{display:inline-block;cursor:pointer;background:var(--accent);color:#20150b;border:0;border-radius:5px;padding:10px 16px;font-weight:750;text-decoration:none}
.secondary{background:#383c42;color:#fff}.ghost{background:transparent;color:var(--text);border:1px solid #696e74}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.stack{display:flex;align-items:center;flex-wrap:wrap;gap:9px}.space{justify-content:space-between}
.checkbox{display:flex;gap:12px;align-items:flex-start;padding:10px 0}.checkbox input{width:21px;height:21px;accent-color:var(--accent);flex:none}
hr{border:0;border-top:1px solid var(--line);margin:22px 0}
.notice{padding:13px 16px;background:#294036;border:1px solid #4e9a73;border-radius:6px}
.error{padding:13px 16px;background:#4b2525;border:1px solid #a94c4c;border-radius:6px}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:11px;border-bottom:1px solid #454950;text-align:left}th{color:var(--muted)}
.editor{min-height:230px;background:#fff;color:#171717;padding:18px;border-radius:0 0 5px 5px;outline:0;line-height:1.65}
.editor:focus{outline:3px solid var(--accent)}.toolbar{display:flex;flex-wrap:wrap;gap:5px;border:1px solid #666;background:#34383c;padding:8px;border-radius:5px 5px 0 0}
.toolbar button{padding:6px 10px;background:#555;color:#fff}.toolbar button:hover{background:#777}
.editor img{max-width:100%;height:auto}img.cover{max-height:140px;max-width:100%;border-radius:4px}
@media(max-width:700px){.grid{grid-template-columns:1fr}.panel{padding:15px}table{font-size:12px}td,th{padding:8px 5px}}
</style></head><body>
<header><div class="wrap top"><strong>RICHARD MORTON <span style="color:var(--accent)">/ Website Studio</span></strong><div class="stack">
<a href="/Richard/" target="_blank">View website</a><?php if(isEditor()): ?><form method="post"><input type="hidden" name="csrf" value="<?=esc($token)?>"><input type="hidden" name="action" value="logout"><button class="secondary">Sign out</button></form><?php endif ?></div></div></header>
<main class="wrap"><h1><?=isEditor()?'Manage Richard’s website':'Website Studio'?></h1>
<p class="small"><?=isEditor()?'Write news, control sections and publish confirmed gigs. Changes are saved to the real site content database.':'Sign in to manage Richard’s website.'?></p>
<?php if($error):?><p class="error" role="alert"><?=esc($error)?></p><?php endif ?>
<?php if(isset($_GET['saved'])):?><p class="notice" role="status">Changes saved successfully.</p><?php endif ?>
<?php if(!isEditor()):?>
<section class="panel" style="max-width:480px"><h2>Editor sign in</h2><form method="post"><input type="hidden" name="csrf" value="<?=esc($token)?>"><input type="hidden" name="action" value="login">
<label class="field" for="password">Password</label><input id="password" type="password" name="password" required autocomplete="current-password">
<p><button type="submit">Sign in</button></p></form><p class="small">This pilot uses a single secure editor account, not a full membership system.</p></section>
<?php else:?>
<section class="panel" id="sections"><h2>Website sections</h2><p class="small">Switch sections on or off without changing the page design. Home and contact stay visible.</p>
<form method="post"><input type="hidden" name="csrf" value="<?=esc($token)?>"><input type="hidden" name="action" value="sections">
<div class="grid"><?php foreach(['reviews'=>'Reviews and testimonials','watch'=>'Watch Richard','music'=>'Music and The Rich Morton Sound','timeline'=>'Career timeline (coming next)','news'=>'Latest News','gigs'=>'Live dates'] as $key=>$label):?>
<label class="checkbox"><input type="checkbox" name="sections[<?=esc($key)?>]" value="1" <?=$sections[$key]?'checked':''?> <?=$key==='timeline'?'disabled':''?>><span><?=esc($label)?></span></label>
<?php endforeach ?></div><button type="submit">Save section visibility</button></form>
</section>
<section class="panel" id="articles"><div class="stack space"><h2>Latest News</h2><a href="/Richard/news/" target="_blank">View public news</a></div>
<p class="small">Drafts stay private. Publish when ready and share the permanent article URL. The homepage shows the newest published items when Latest News is enabled.</p>
<?php if($articles):?><div style="overflow:auto"><table><thead><tr><th>Article</th><th>Status</th><th>Link</th><th>Edit</th></tr></thead><tbody>
<?php foreach($articles as $a):?><tr><td><?=esc($a['title'])?></td><td><?=esc(ucfirst($a['status']))?></td><td><?=$a['status']==='published'?'<a target="_blank" href="/Richard/news/'.esc($a['slug']).'/">Open ↗</a>':'Private draft'?></td><td><a href="?article=<?=(int)$a['id']?>#article-editor">Edit</a></td></tr><?php endforeach ?>
</tbody></table></div><?php endif ?>
<hr><h3 id="article-editor"><?=$editArticle?'Edit article':'Write an article'?></h3>
<form method="post" enctype="multipart/form-data" id="article-form"><input type="hidden" name="csrf" value="<?=esc($token)?>"><input type="hidden" name="action" value="article"><input type="hidden" name="id" value="<?=(int)($editArticle['id']??0)?>">
<label class="field">Title<input type="text" name="title" maxlength="160" value="<?=esc($editArticle['title']??'')?>" required></label>
<label class="field">Shareable URL slug<input type="text" name="slug" maxlength="90" value="<?=esc($editArticle['slug']??'')?>" placeholder="my-latest-news" <?=($editArticle && $editArticle['status']==='published')?'readonly':''?>></label>
<?php if($editArticle && $editArticle['status']==='published'):?><p class="small">Published article URLs are fixed so existing shares keep working.</p><?php endif ?>
<label class="field">Article text</label>
<div class="toolbar" role="toolbar" aria-label="Article formatting">
<button type="button" data-cmd="bold"><b>Bold</b></button><button type="button" data-cmd="italic"><em>Italic</em></button>
<button type="button" data-block="p">Paragraph</button><button type="button" data-block="h2">Heading</button>
<button type="button" data-cmd="insertUnorderedList">Bullets</button><button type="button" data-cmd="insertOrderedList">Numbers</button>
<button type="button" id="add-link">Add link</button><button type="button" id="add-inline-image">Insert image</button>
</div>
<div id="editor" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Article text" class="editor"><?=($editArticle['body']??'') /* already server sanitised on save */?></div>
<input type="hidden" id="body-hidden" name="body">
<input type="file" id="inline-image-file" accept="image/jpeg,image/png,image/webp" hidden>
<label class="field">Featured image (optional)<input type="file" name="cover_upload" accept="image/jpeg,image/png,image/webp"></label>
<?php if(!empty($editArticle['featured_image'])):?><p><img class="cover" src="<?=esc($editArticle['featured_image'])?>" alt="Current featured image"><label class="checkbox"><input type="checkbox" name="remove_image" value="1"> Remove featured image</label></p><?php endif ?>
<label class="field">Publishing status<select name="status"><option value="draft" <?=($editArticle['status']??'draft')==='draft'?'selected':''?>>Save as private draft</option><option value="published" <?=($editArticle['status']??'')==='published'?'selected':''?>>Publish on website</option></select></label>
<div class="stack" style="margin-top:15px"><button type="submit">Save article</button><?php if($editArticle):?><a class="button ghost" href="/Richard/studio/#article-editor">New article</a><?php endif ?></div>
</form></section>
<section class="panel" id="gigs"><h2>Gig listings</h2><p class="small">Only confirmed gigs marked Published appear on the public website, and only when Live dates is enabled.</p>
<?php if($gigs):?><div style="overflow:auto"><table><thead><tr><th>Date</th><th>Venue</th><th>Town</th><th>Status</th><th></th></tr></thead><tbody>
<?php foreach($gigs as $g):?><tr><td><?=esc($g['date'].' '.$g['time'])?></td><td><?=esc($g['venue'])?></td><td><?=esc($g['town'])?></td><td><?=esc(ucfirst($g['status']))?></td><td><a href="?gig=<?=(int)$g['id']?>#gig-editor">Edit</a></td></tr><?php endforeach ?>
</tbody></table></div><?php endif ?>
<hr><h3 id="gig-editor"><?=$editGig?'Edit gig':'Add a gig'?></h3>
<form method="post"><input type="hidden" name="csrf" value="<?=esc($token)?>"><input type="hidden" name="action" value="gig"><input type="hidden" name="id" value="<?=(int)($editGig['id']??0)?>">
<div class="grid"><label class="field">Date<input type="date" name="date" value="<?=esc($editGig['date']??'')?>" required></label><label class="field">Start time, if known<input type="time" name="time" value="<?=esc($editGig['time']??'')?>"></label></div>
<div class="grid"><label class="field">Venue<input type="text" name="venue" value="<?=esc($editGig['venue']??'')?>" required maxlength="180"></label><label class="field">Town / city<input type="text" name="town" value="<?=esc($editGig['town']??'')?>" maxlength="140"></label></div>
<label class="field">Direct ticket link (optional)<input type="url" name="ticket_url" value="<?=esc($editGig['ticket_url']??'')?>" placeholder="https://"></label>
<label class="field">Status<select name="status"><option value="draft" <?=($editGig['status']??'draft')==='draft'?'selected':''?>>Private draft</option><option value="published" <?=($editGig['status']??'')==='published'?'selected':''?>>Published</option></select></label>
<div class="stack" style="margin-top:15px"><button>Save gig</button><?php if($editGig):?><a href="/Richard/studio/#gig-editor" class="button ghost">New gig</a><?php endif ?></div>
</form></section>
<section class="panel"><h2>Editor password</h2><p class="small">Richard can change the initial password here before taking over editing.</p>
<form method="post"><input type="hidden" name="csrf" value="<?=esc($token)?>"><input type="hidden" name="action" value="change_password">
<div class="grid"><label class="field">Current password<input type="password" name="current_password" required autocomplete="current-password"></label>
<label class="field">New password (14 characters minimum)<input type="password" name="new_password" minlength="14" required autocomplete="new-password"></label></div>
<label class="field">Confirm new password<input type="password" name="confirm_password" minlength="14" required autocomplete="new-password"></label><p><button type="submit">Change password</button></p>
</form></section>
<?php endif ?>
</main>
<script>
const editor=document.querySelector('#editor');
if(editor){
 const form=document.querySelector('#article-form');
 form.addEventListener('submit',()=>{document.querySelector('#body-hidden').value=editor.innerHTML});
 document.querySelectorAll('[data-cmd]').forEach(b=>b.addEventListener('click',()=>{editor.focus();document.execCommand(b.dataset.cmd,false,null)}));
 document.querySelectorAll('[data-block]').forEach(b=>b.addEventListener('click',()=>{editor.focus();document.execCommand('formatBlock',false,b.dataset.block)}));
 document.querySelector('#add-link').addEventListener('click',()=>{const url=prompt('Link to a website (https://...)');if(url&&/^https?:\/\/\S+$/i.test(url)){editor.focus();document.execCommand('createLink',false,url)}});
 const choose=document.querySelector('#inline-image-file');
 document.querySelector('#add-inline-image').addEventListener('click',()=>choose.click());
 choose.addEventListener('change',async()=>{
  if(!choose.files.length)return;
  const data=new FormData();data.append('action','upload');data.append('csrf',<?=json_encode($token)?>);data.append('image',choose.files[0]);
  try{const res=await fetch('/Richard/studio/',{method:'POST',body:data,credentials:'same-origin'});
  const result=await res.json();if(!res.ok)throw Error(result.error||'Upload failed');
  const alt=prompt('Describe this image for accessibility:')||'Article image';
  const element=document.createElement('img');element.src=result.url;element.alt=alt;
  editor.focus();document.execCommand('insertHTML',false,element.outerHTML);
  }catch(e){alert(e.message)}choose.value='';
 });
}
</script></body></html>
