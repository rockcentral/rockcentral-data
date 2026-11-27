<?php
declare(strict_types=1);
require dirname(__DIR__, 2) . '/.comedian-builder/core.php';
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=45');
echo json_encode([
 'sections'=>siteSections(),
 'articles'=>publicArticles('richard',3),
 'gigs'=>siteSections()['gigs'] ? publicGigs() : [],
 'timeline'=>siteSections()['timeline'] ? publicTimeline() : []
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
