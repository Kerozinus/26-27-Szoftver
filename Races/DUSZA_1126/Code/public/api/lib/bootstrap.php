<?php
/**
 * Közös segédfüggvények az API végpontokhoz: adatbázis, munkamenet, JSON.
 */

declare(strict_types=1);

require_once __DIR__ . '/MineScript.php';

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $cfg = require __DIR__ . '/../config.php';
    if ($cfg['driver'] === 'sqlite') {
        $pdo = new PDO('sqlite:' . $cfg['sqlite_path']);
        $pdo->exec('PRAGMA foreign_keys = ON');
    } else {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $cfg['host'], $cfg['port'], $cfg['database']);
        $pdo = new PDO($dsn, $cfg['username'], $cfg['password']);
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
    $pdo->setAttribute(PDO::ATTR_STRINGIFY_FETCHES, false);
    return $pdo;
}

function now(): string
{
    return gmdate('Y-m-d H:i:s');
}

function json_out(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $status = 400, array $extra = []): never
{
    json_out(['error' => $message] + $extra, $status);
}

function body(): array
{
    static $data = null;
    if ($data === null) {
        $raw = file_get_contents('php://input') ?: '';
        $data = $raw === '' ? [] : json_decode($raw, true);
        if (!is_array($data)) {
            fail('Hibás kérés (érvénytelen JSON).');
        }
    }
    return $data;
}

function start_api(): void
{
    set_exception_handler(function (Throwable $e) {
        error_log('[robotszimulator] ' . $e);
        fail('Váratlan szerverhiba történt. Kérlek, próbáld újra!', 500);
    });
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => !empty($_SERVER['HTTPS']),
    ]);
    session_name('RSSESSID');
    session_start();

    // Egyszerű CSRF-védelem: módosító kérést csak a saját felületünk küldhet
    // (egyedi fejléc, amit más oldal űrlapja nem tud beállítani).
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method !== 'GET' && ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'robotszimulator') {
        fail('A kérés elutasítva.', 403);
    }
}

function current_user(): ?array
{
    if (empty($_SESSION['uid'])) {
        return null;
    }
    static $user = false;
    if ($user === false) {
        $st = db()->prepare('SELECT id, username, is_admin FROM users WHERE id = ?');
        $st->execute([$_SESSION['uid']]);
        $user = $st->fetch() ?: null;
        if ($user) {
            $user['id'] = (int) $user['id'];
            $user['is_admin'] = (bool) $user['is_admin'];
        }
    }
    return $user;
}

function require_user(): array
{
    $u = current_user();
    if (!$u) {
        fail('Ehhez be kell jelentkezned.', 401);
    }
    return $u;
}

function action(): string
{
    return (string) ($_GET['action'] ?? '');
}

function str_param(array $src, string $key, int $min, int $max, string $label): string
{
    $v = $src[$key] ?? '';
    if (!is_string($v)) {
        fail("Hibás mező: $label.");
    }
    $v = trim($v);
    $len = mb_strlen($v);
    if ($len < $min || $len > $max) {
        fail("$label hossza $min és $max karakter között legyen.");
    }
    return $v;
}

function int_param(array $src, string $key): int
{
    $v = $src[$key] ?? null;
    if (is_int($v)) {
        return $v;
    }
    if (is_string($v) && ctype_digit($v)) {
        return (int) $v;
    }
    fail("Hiányzó vagy hibás azonosító ($key).");
}

/** Térkép betöltése azonosító alapján (vagy 404). */
function load_map(int $id): array
{
    $st = db()->prepare(
        'SELECT m.id, m.name, m.owner_id, u.username AS owner, m.rows_n, m.cols_n, m.map_text,
                m.gold_total, m.created_at, m.updated_at
           FROM maps m JOIN users u ON u.id = m.owner_id WHERE m.id = ?'
    );
    $st->execute([$id]);
    $m = $st->fetch();
    if (!$m) {
        fail('A térkép nem található.', 404);
    }
    return normalize_map($m);
}

function normalize_map(array $m): array
{
    foreach (['id', 'owner_id', 'rows_n', 'cols_n', 'gold_total'] as $k) {
        if (isset($m[$k])) {
            $m[$k] = (int) $m[$k];
        }
    }
    return $m;
}
