# Otu-Zan

React frontend with a Laravel 12 API and a MySQL/MariaDB database managed through phpMyAdmin.

## Run this checkout on Windows

1. Start **Apache** and **MySQL** in the XAMPP Control Panel.
2. Run `npm.cmd start`. It starts and checks Laravel automatically before it launches React, so the sign-in page cannot open without its local API.

- Frontend: http://localhost:3000
- Laravel API: http://localhost:5000/api/health
- phpMyAdmin: http://localhost/phpmyadmin/index.php?route=/database/structure&db=otu-zan-db
- Database: `otu-zan-db` on `127.0.0.1:3306`
- Database credentials and application key: ignored `laravel/.env`
- Frontend API URL: ignored root `.env`
- Background launcher log: ignored `.local/laravel.log`
- Laravel application log: `laravel/storage/logs/laravel.log`

The launcher uses XAMPP PHP at `C:/xampp/php/php.exe`, or PHP on PATH. Override with `PHP_BINARY` if needed. It checks database connectivity and will not replace another service already using port 5000. Use `npm.cmd run backend:start` to run Laravel in the foreground instead. `npm start` stops with a clear XAMPP instruction if the database cannot be reached rather than starting a frontend that cannot sign in.

## Setup on another computer

Requires Node.js, PHP 8.2+, Composer, and MySQL/MariaDB (XAMPP includes PHP, MariaDB and phpMyAdmin).

1. Run `npm install` in the project root.
2. Start XAMPP Apache and MySQL. Import `backend/database/schema.sql` through phpMyAdmin to create the seven application tables.
3. Run `composer install` inside `laravel`.
4. Copy `laravel/.env.example` to `laravel/.env` and set database credentials, frontend origin and staff registration codes.
5. Inside `laravel`, run `php artisan key:generate` and `php artisan migrate`.
6. Copy root `.env.example` to `.env`, then start the backend and frontend as above.

Laravel migrations adopt existing Users records and add the address and API-token storage. Existing bcrypt passwords and account IDs are preserved. Staff accounts use backend roles `driver` and `admin`; local default access codes are `DRIVER2024` and `ADMIN2024`.

## Backend and verification

Laravel implements registration, login, current account, logout, the admin-only rider directory, and health endpoints. API responses retain the React frontend's existing format. Bearer authentication uses Laravel Sanctum with tokens valid for two hours. Sign in again after migrating from the old Node backend; old JWT sessions are not Laravel tokens.

- `npm run backend:db-check`: verify Laravel database access
- `npm run backend:migrate`: apply Laravel migrations
- `npm run backend:test`: Laravel tests using a separate in-memory SQLite database
- `npm test -- --watchAll=false`: React tests
- `npm run build`: frontend production build

## Migration notes

This checkout was moved from the separate MySQL instance on port 3307 to XAMPP on port 3306. All seven tables were copied and row counts verified. Other XAMPP databases were left in place. The old database files and migration backups remain in ignored `.local` storage; they are no longer the active database. The former Express implementation under `backend` remains as a migration reference; all backend npm commands now run Laravel.

Orders and assignment still use the existing browser-storage implementation. Status updates propagate within the app and across tabs in the same browser profile. Moving that workflow to server-side storage and cross-device delivery is separate from this authentication/database migration.
