<?php
/**
 * Adatbázis-beállítások. A telepítéskor ezt kell a szerverhez igazítani
 * (vagy környezeti változókkal felülírni).
 */
return [
    // 'mysql' (éles) vagy 'sqlite' (helyi próbához)
    'driver' => getenv('RS_DB_DRIVER') ?: 'mysql',
    'host' => getenv('RS_DB_HOST') ?: '127.0.0.1',
    'port' => (int) (getenv('RS_DB_PORT') ?: 3306),
    'database' => getenv('RS_DB_NAME') ?: 'robotszimulator',
    'username' => getenv('RS_DB_USER') ?: 'robotszimulator',
    'password' => getenv('RS_DB_PASS') ?: 'ValtoztasdMeg123!',
    // csak sqlite esetén
    'sqlite_path' => getenv('RS_DB_SQLITE') ?: __DIR__ . '/../../data/robotszimulator.sqlite',
];
