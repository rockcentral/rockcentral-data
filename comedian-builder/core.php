<?php
declare(strict_types=1);
/**
 * Comedian Site Builder, pilot 1.
 * Reusable data/content layer. Deployed OUTSIDE the public document root.
 * Per-site databases and credentials are not committed to Git.
 */
function siteKey(string $key): string {
    if (!preg_match('/^[a-z][a-z0-9_-]{1,40}$/D', $key)) throw new RuntimeException('Invalid site key');
    return $key;
}
function siteDB(string $site = 'richard'): PDO {
    static $connections = [];
    $site = siteKey($site);
    if (isset($connections[$site])) return $connections[$site];
    $directory = __DIR__ . '/data';
    if (!is_dir($directory)) mkdir($directory, 0700, true);
    $db = new PDO('sqlite:' . $directory . '/' . $site . '.sqlite', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    $db->exec('PRAGMA busy_timeout=5000');
    $db->exec('PRAGMA journal_mode=WAL');
    $db->exec('CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL)');
    $db->exec("CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE, body TEXT NOT NULL DEFAULT '',
        featured_image TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft'
        CHECK(status IN ('draft','published')), published_at TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )");
    $db->exec("CREATE TABLE IF NOT EXISTS gigs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, time TEXT NOT NULL DEFAULT '',
        venue TEXT NOT NULL, town TEXT NOT NULL DEFAULT '', ticket_url TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )");
    $db->exec('CREATE TABLE IF NOT EXISTS failed_logins (ip TEXT PRIMARY KEY, failures INTEGER NOT NULL, first_attempt INTEGER NOT NULL)');
    return $connections[$site] = $db;
}
function esc(mixed $text): string {
    return htmlspecialchars((string)$text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
function siteSections(string $site = 'richard'): array {
    $defaults = ['about'=>true,'reviews'=>true,'watch'=>true,'music'=>true,'timeline'=>false,'news'=>false,'gigs'=>false,'contact'=>true];
    $q = siteDB($site)->query("SELECT value FROM settings WHERE name='sections'")->fetchColumn();
    $values = $q ? json_decode((string)$q, true) : [];
    if (!is_array($values)) $values = [];
    foreach ($defaults as $key=>$default) $defaults[$key] = ($key === 'about' || $key === 'contact') ? true : (bool)($values[$key] ?? $default);
    return $defaults;
}
function saveSections(array $input, string $site = 'richard'): void {
    $current = siteSections($site);
    foreach (['reviews','watch','music','news','gigs'] as $key) $current[$key] = !empty($input[$key]);
    siteDB($site)->prepare("INSERT INTO settings(name,value) VALUES ('sections',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value")
        ->execute([json_encode($current, JSON_THROW_ON_ERROR)]);
}
function slugify(string $text): string {
    $text = trim(mb_strtolower($text));
    $text = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text) ?: $text;
    $text = preg_replace('/[^a-z0-9]+/', '-', $text) ?? '';
    return trim(substr($text, 0, 90), '-');
}
function safeUrl(string $url): string {
    $url = trim($url);
    return $url !== '' && filter_var($url, FILTER_VALIDATE_URL) && in_array(strtolower((string)parse_url($url, PHP_URL_SCHEME)), ['http','https'], true)
        ? $url : '';
}
/** Whitelist rich text. Never trust incoming editor HTML. */
function cleanRichText(string $html): string {
    $html = mb_substr($html, 0, 120000);
    $doc = new DOMDocument('1.0', 'UTF-8');
    $old = libxml_use_internal_errors(true);
    $doc->loadHTML('<?xml encoding="UTF-8"?><div id="site-content">' . $html . '</div>', LIBXML_NONET | LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
    libxml_clear_errors();
    libxml_use_internal_errors($old);
    $root = $doc->getElementById('site-content');
    if (!$root) return '';
    $allowed = ['p','strong','b','em','i','h2','h3','ul','ol','li','br','blockquote','a','img','div'];
    $danger = ['script','style','iframe','object','embed','svg','form','input','button','textarea','template','link','meta'];
    $walk = function(DOMNode $node) use (&$walk,$allowed,$danger,$doc): void {
        foreach (iterator_to_array($node->childNodes) as $child) {
            if ($child instanceof DOMComment) { $node->removeChild($child); continue; }
            if (!$child instanceof DOMElement) continue;
            $tag = strtolower($child->tagName);
            if (in_array($tag,$danger,true)) { $node->removeChild($child); continue; }
            $walk($child);
            if (!in_array($tag,$allowed,true)) {
                while ($child->firstChild) $node->insertBefore($child->firstChild, $child);
                $node->removeChild($child);
                continue;
            }
            $href = $tag === 'a' ? safeUrl($child->getAttribute('href')) : '';
            $src = $tag === 'img' ? $child->getAttribute('src') : '';
            $alt = $tag === 'img' ? mb_substr($child->getAttribute('alt'),0,180) : '';
            while ($child->attributes->length) $child->removeAttributeNode($child->attributes->item(0));
            if ($tag === 'a' && $href) { $child->setAttribute('href',$href); $child->setAttribute('rel','nofollow noopener noreferrer'); }
            elseif ($tag === 'a') { while($child->firstChild) $node->insertBefore($child->firstChild,$child); $node->removeChild($child); continue; }
            if ($tag === 'img') {
                if (!preg_match('#^/Richard/media/[a-f0-9]{32}\.(?:jpg|jpeg|png|webp)$#D',$src)) { $node->removeChild($child); continue; }
                $child->setAttribute('src',$src);
                $child->setAttribute('alt',$alt);
                $child->setAttribute('loading','lazy');
            }
        }
    };
    $walk($root);
    $result = '';
    foreach ($root->childNodes as $child) $result .= $doc->saveHTML($child);
    return $result;
}
function articleExcerpt(string $html): string {
    return mb_substr(trim(preg_replace('/\s+/u',' ',html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8')) ?: ''),0,180);
}
function publicArticles(string $site='richard', int $limit=30): array {
    $q=siteDB($site)->prepare("SELECT id,title,slug,body,featured_image,published_at FROM articles WHERE status='published' ORDER BY published_at DESC,id DESC LIMIT ?");
    $q->bindValue(1, $limit, PDO::PARAM_INT);$q->execute();
    return array_map(static fn($r)=>[
        'title'=>$r['title'], 'slug'=>$r['slug'], 'url'=>'/Richard/news/'.rawurlencode($r['slug']).'/',
        'excerpt'=>articleExcerpt($r['body']), 'image'=>$r['featured_image'],
        'date'=>$r['published_at']
    ],$q->fetchAll());
}
function publicGigs(string $site='richard'): array {
    $q=siteDB($site)->prepare("SELECT date,time,venue,town,ticket_url FROM gigs WHERE status='published' AND date>=? ORDER BY date,time,id LIMIT 60");
    $q->execute([(new DateTimeImmutable('today',new DateTimeZone('Europe/London')))->format('Y-m-d')]);
    return $q->fetchAll();
}
function csrfToken(): string {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf']=bin2hex(random_bytes(32));
    return (string)$_SESSION['csrf'];
}
function checkCsrf(): void {
    if (!isset($_POST['csrf']) || !is_string($_POST['csrf']) || !hash_equals(csrfToken(),$_POST['csrf'])) {
        http_response_code(403);exit('Invalid form token');
    }
}
function startSiteSession(): void {
    ini_set('session.use_strict_mode','1');
    session_name('richard_studio');
    session_set_cookie_params(['lifetime'=>0,'path'=>'/Richard/studio/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
    session_start();
}
function isEditor(): bool { return !empty($_SESSION['editor']) && $_SESSION['editor']===true; }
function requireEditor(): void {
    if (!isEditor()) { http_response_code(403);exit('Authentication required'); }
}
function uploadSiteImage(array $file): string {
    if (($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK) throw new RuntimeException('Image upload failed');
    if (($file['size']??0)<=0 || $file['size']>4*1024*1024 || !is_uploaded_file((string)$file['tmp_name'])) throw new RuntimeException('Image must be smaller than 4 MB');
    $info=@getimagesize($file['tmp_name']);
    $mime=$info['mime']??'';
    $ext=match($mime){'image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp',default=>''};
    if (!$ext || ($info[0]??0)>6000 || ($info[1]??0)>6000) throw new RuntimeException('Only normal JPEG, PNG and WebP images (up to 6000px) are allowed');
    $root=dirname(__DIR__) . '/public_html/Richard/media';
    if(!is_dir($root) && !mkdir($root,0755,true)) throw new RuntimeException('Media directory unavailable');
    $name=bin2hex(random_bytes(16)).'.'.$ext;
    if (!move_uploaded_file($file['tmp_name'],$root.'/'.$name)) throw new RuntimeException('Cannot save image');
    chmod($root.'/'.$name,0644);
    return '/Richard/media/'.$name;
}
