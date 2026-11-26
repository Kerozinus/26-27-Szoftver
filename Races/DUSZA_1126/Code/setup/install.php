<?php
/**
 * Telepítő: létrehozza az adatbázis-táblákat és feltölti a bemutató adatokat
 * (felhasználók, térképek, programok, ranglista-eredmények).
 *
 * Használat (a projekt gyökeréből):
 *   php setup/install.php           – táblák létrehozása + bemutató adatok (ha még üres)
 *   php setup/install.php --reset   – MINDEN adat törlése, majd újratelepítés
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Csak parancssorból futtatható.');
}

require __DIR__ . '/../public/api/lib/bootstrap.php';

$reset = in_array('--reset', $argv, true);
$cfg = require __DIR__ . '/../public/api/config.php';
$sqlite = $cfg['driver'] === 'sqlite';
if ($sqlite && !is_dir(dirname($cfg['sqlite_path']))) {
    mkdir(dirname($cfg['sqlite_path']), 0775, true);
}
$pdo = db();

if ($reset) {
    foreach (['runs', 'programs', 'maps', 'users'] as $t) {
        $pdo->exec("DROP TABLE IF EXISTS $t");
    }
    echo "Régi táblák törölve.\n";
}

$id = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY';
$fk = $sqlite ? 'INTEGER' : 'INT UNSIGNED';
$text = $sqlite ? 'TEXT' : 'MEDIUMTEXT';
$tail = $sqlite ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci';

$pdo->exec("CREATE TABLE IF NOT EXISTS users (
    id $id,
    username VARCHAR(30) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_admin TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL
)$tail");

$pdo->exec("CREATE TABLE IF NOT EXISTS maps (
    id $id,
    name VARCHAR(60) NOT NULL UNIQUE,
    owner_id $fk NOT NULL,
    rows_n TINYINT NOT NULL,
    cols_n TINYINT NOT NULL,
    map_text TEXT NOT NULL,
    gold_total SMALLINT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
)$tail");

$pdo->exec("CREATE TABLE IF NOT EXISTS programs (
    id $id,
    user_id $fk NOT NULL,
    name VARCHAR(60) NOT NULL,
    code $text NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)$tail");

$pdo->exec("CREATE TABLE IF NOT EXISTS runs (
    id $id,
    user_id $fk NOT NULL,
    map_id $fk NOT NULL,
    code $text NOT NULL,
    status VARCHAR(20) NOT NULL,
    error_code VARCHAR(40) NULL,
    error_line INT NULL,
    gold INT NOT NULL,
    steps INT NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE
)$tail");

if (!$sqlite) {
    // Index a ranglista-lekérdezéshez (ha már létezik, a hibát elnyeljük).
    try {
        $pdo->exec('CREATE INDEX idx_runs_map ON runs (map_id, gold, steps)');
    } catch (PDOException) {
    }
} else {
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_runs_map ON runs (map_id, gold, steps)');
}
echo "Táblák rendben.\n";

if ((int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0) {
    echo "Az adatbázisban már vannak adatok, a bemutató adatokat nem töltöm be újra.\n";
    echo "(Teljes újratelepítés: php setup/install.php --reset)\n";
    exit(0);
}

// ---------------------------------------------------------------------------
// Bemutató adatok
// ---------------------------------------------------------------------------

$seed = require __DIR__ . '/seed-data.php';
$pdo->beginTransaction();

$userIds = [];
$st = $pdo->prepare('INSERT INTO users (username, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?)');
foreach ($seed['users'] as [$name, $pass, $admin]) {
    $st->execute([$name, password_hash($pass, PASSWORD_DEFAULT), $admin ? 1 : 0, now()]);
    $userIds[$name] = (int) $pdo->lastInsertId();
}

$mapIds = [];
$parsedMaps = [];
$st = $pdo->prepare('INSERT INTO maps (name, owner_id, rows_n, cols_n, map_text, gold_total, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
foreach ($seed['maps'] as [$name, $owner, $mapText]) {
    $p = MineScript::parseMap($mapText);
    if (!$p['ok']) {
        throw new RuntimeException("Hibás bemutató térkép: $name – " . $p['errors'][0]['message']);
    }
    $m = $p['map'];
    $st->execute([$name, $userIds[$owner], $m['rows'], $m['cols'], MineScript::serializeMap($m['rows'], $m['cols'], $m['grid']),
        MineScript::countGold($m['grid']), now(), now()]);
    $mapIds[$name] = (int) $pdo->lastInsertId();
    $parsedMaps[$name] = $m;
}

$programs = [];
$st = $pdo->prepare('INSERT INTO programs (user_id, name, code, updated_at) VALUES (?, ?, ?, ?)');
foreach ($seed['programs'] as [$owner, $name, $code]) {
    $chk = MineScript::parseProgram($code);
    if (!$chk['ok']) {
        throw new RuntimeException("Hibás bemutató program: $name – sor {$chk['errors'][0]['line']}: {$chk['errors'][0]['message']}");
    }
    $st->execute([$userIds[$owner], $name, $code, now()]);
    $programs[$name] = $code;
}

// A ranglista-eredményeket a valódi értelmező számolja ki.
$st = $pdo->prepare('INSERT INTO runs (user_id, map_id, code, status, error_code, error_line, gold, steps, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
$minutes = count($seed['runs']) * 7;
foreach ($seed['runs'] as [$who, $mapName, $progName]) {
    $code = $programs[$progName];
    $r = MineScript::run($code, $parsedMaps[$mapName]);
    $st->execute([$userIds[$who], $mapIds[$mapName], $code, $r['status'], $r['errorCode'], $r['errorLine'],
        $r['gold'], $r['steps'], gmdate('Y-m-d H:i:s', time() - 60 * $minutes)]);
    $minutes -= 7;
    printf("  %-6s %-22s %-24s arany: %d, lépés: %d %s\n", $who, $mapName, $progName, $r['gold'], $r['steps'], $r['errorCode'] ?? '');
}

$pdo->commit();
echo "\nBemutató adatok betöltve.\nBelépési adatok:\n";
foreach ($seed['users'] as [$name, $pass, $admin]) {
    echo "  $name / $pass" . ($admin ? '  (adminisztrátor)' : '') . "\n";
}
