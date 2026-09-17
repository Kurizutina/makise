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
    'max_age' => 0,
    'supports_credentials' => false,
];
