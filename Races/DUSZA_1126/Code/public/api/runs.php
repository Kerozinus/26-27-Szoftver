<?php
/**
 * Futtatások és ranglista.
 *
 *   POST runs.php?action=submit       – {mapId, code}: a szerver maga futtatja le
 *                                       a programot, és az ő eredményét rögzíti.
 *   GET  runs.php?action=leaderboard&mapId=1[&all=1]
 *   GET  runs.php?action=mine&mapId=1 – a saját legutóbbi futtatások
 */

declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';
start_api();
$user = require_user();

switch (action()) {
    case 'submit':
        $b = body();
        $map = load_map(int_param($b, 'mapId'));
        $code = $b['code'] ?? null;
        if (!is_string($code) || strlen($code) > 20000) {
            fail('Hibás vagy túl hosszú program.');
        }
        $parsedMap = MineScript::parseMap($map['map_text']);
        $result = MineScript::run($code, $parsedMap['map']);
        if ($result['status'] === 'SYNTAX_ERROR') {
            fail('A program szintaktikailag hibás, nem futtatható.', 422, ['errors' => $result['errors']]);
        }
        db()->prepare(
            'INSERT INTO runs (user_id, map_id, code, status, error_code, error_line, gold, steps, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $user['id'], $map['id'], $code, $result['status'], $result['errorCode'], $result['errorLine'],
            $result['gold'], $result['steps'], now(),
        ]);
        $runId = (int) db()->lastInsertId();
        json_out(['run' => ['id' => $runId] + $result, 'rank' => rank_of($map['id'], $user['id'])]);

    case 'leaderboard':
        $mapId = int_param($_GET, 'mapId');
        $map = load_map($mapId);
        $all = !empty($_GET['all']);
        json_out([
            'map' => ['id' => $map['id'], 'name' => $map['name'], 'gold_total' => $map['gold_total']],
            'entries' => leaderboard($mapId, $all),
        ]);

    case 'mine':
        $mapId = int_param($_GET, 'mapId');
        $st = db()->prepare(
            'SELECT id, status, error_code, error_line, gold, steps, created_at FROM runs
              WHERE user_id = ? AND map_id = ? ORDER BY id DESC LIMIT 20'
        );
        $st->execute([$user['id'], $mapId]);
        json_out(['runs' => array_map('normalize_run', $st->fetchAll())]);

    case 'code':
        // Egy saját futtatás kódjának visszatöltése.
        $st = db()->prepare('SELECT code FROM runs WHERE id = ? AND user_id = ?');
        $st->execute([int_param($_GET, 'id'), $user['id']]);
        $row = $st->fetch();
        if (!$row) {
            fail('A futtatás nem található.', 404);
        }
        json_out(['code' => $row['code']]);

    default:
        fail('Ismeretlen művelet.', 404);
}

function normalize_run(array $r): array
{
    foreach (['id', 'gold', 'steps', 'error_line', 'rank', 'user_id'] as $k) {
        if (isset($r[$k])) {
            $r[$k] = (int) $r[$k];
        }
    }
    return $r;
}

/**
 * Rangsor: több arany előrébb, azonos aranynál kevesebb lépés, utána a korábbi
 * eredmény. Alapból felhasználónként csak a legjobb futtatás szerepel.
 */
function leaderboard(int $mapId, bool $all): array
{
    $order = 'r.gold DESC, r.steps ASC, r.created_at ASC, r.id ASC';
    if ($all) {
        $sql = "SELECT r.id, r.user_id, u.username, r.status, r.error_code, r.gold, r.steps, r.created_at
                  FROM runs r JOIN users u ON u.id = r.user_id
                 WHERE r.map_id = ? ORDER BY $order LIMIT 200";
    } else {
        $sql = "SELECT * FROM (
                  SELECT r.id, r.user_id, u.username, r.status, r.error_code, r.gold, r.steps, r.created_at,
                         ROW_NUMBER() OVER (PARTITION BY r.user_id ORDER BY $order) AS rn
                    FROM runs r JOIN users u ON u.id = r.user_id
                   WHERE r.map_id = ?
                ) best WHERE rn = 1 ORDER BY gold DESC, steps ASC, created_at ASC, id ASC LIMIT 200";
    }
    $st = db()->prepare($sql);
    $st->execute([$mapId]);
    $rows = $st->fetchAll();
    $out = [];
    $rank = 0;
    $prev = null;
    foreach ($rows as $i => $r) {
        unset($r['rn']);
        $key = $r['gold'] . '/' . $r['steps'];
        if ($key !== $prev) {
            $rank = $i + 1; // azonos arany és lépésszám: azonos helyezés
            $prev = $key;
        }
        $r['rank'] = $rank;
        $out[] = normalize_run($r);
    }
    return $out;
}

function rank_of(int $mapId, int $userId): ?int
{
    foreach (leaderboard($mapId, false) as $e) {
        if ($e['user_id'] === $userId) {
            return $e['rank'];
        }
    }
    return null;
}
