<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('otuzan:db-check', function () {
    \Illuminate\Support\Facades\DB::select('SELECT 1');
    $this->info('Laravel connected to '.config('database.connections.mysql.database').' on port '.config('database.connections.mysql.port'));
})->purpose('Check the Otu-Zan database connection');

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');
