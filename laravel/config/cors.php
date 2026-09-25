<?php

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [env('FRONTEND_URL', 'http://localhost:3000')],
    // react-scripts uses the next free port (for example 3001) when 3000 is
    // occupied. Permit loopback development origins so that fallback does not
    // turn a successful API response into a browser-level CORS fetch failure.
    'allowed_origins_patterns' => [
        '#^https?://localhost(?::\\d+)?$#',
        '#^https?://127\\.0\\.0\\.1(?::\\d+)?$#',
    ],
    'allowed_headers' => ['Accept', 'Authorization', 'Content-Type'],
    'exposed_headers' => [],
    // Was 0 (never cache) - every single authenticated request (nearly
    // everything in this app) triggered its own separate OPTIONS preflight
    // round trip first, doubling real request volume against the Windows
    // dev server's single-threaded queue (see CLAUDE.md/TODO.md on
    // php artisan serve's concurrency limits). Chrome/Brave cap the actual
    // cache duration at 2 hours (7200s) regardless of a larger value, so
    // this is the practical ceiling, not an arbitrarily large number.
    'max_age' => 7200,
    'supports_credentials' => false,
];
