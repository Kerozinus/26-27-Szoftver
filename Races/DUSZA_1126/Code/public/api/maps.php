<?php
/**
 * Térképek. Minden térkép közös (minden felhasználó látja és játszhat rajta),
 * de módosítani/törölni csak a készítője vagy egy adminisztrátor tudja.
 *
 *   GET  maps.php?action=list
 *   GET  maps.php?action=get&id=1
 *   POST maps.php?action=save    – {id?, name, text}  (text = térképfájl formátum)
 *   POST maps.php?action=delete  – {id}
 */

declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';
start_api();
$user = require_user();

function can_edit(array $map, array $user): bool
{
    return $user['is_admin'] || $map['owner_id'] === $user['id'];
}

switch (action()) {
    case 'list':
        $rows = db()->query(
            'SELECT m.id, m.name, m.owner_id, u.username AS owner, m.rows_n, m.cols_n, m.map_text, m.gold_total, m.updated_at,
                    (SELECT COUNT(*) FROM runs r WHERE r.map_id = m.id) AS run_count
               FROM maps m JOIN users u ON u.id = m.owner_id
              ORDER BY m.name'
        )->fetchAll();
        $rows = array_map(function ($m) use ($user) {
            $m = normalize_map($m);
            $m['run_count'] = (int) $m['run_count'];
            $m['can_edit'] = can_edit($m, $user);
            return $m;
        }, $rows);
        json_out(['maps' => $rows]);

    case 'get':
        $m = load_map(int_param($_GET, 'id'));
        $m['can_edit'] = can_edit($m, $user);
        json_out(['map' => $m]);

    case 'save':
        $b = body();
        $name = str_param($b, 'name', 1, 60, 'A térkép neve');
        $text = $b['text'] ?? '';
        if (!is_string($text) || strlen($text) > 2000) {
            fail('Hibás térkép.');
        }
        $parsed = MineScript::parseMap($text);
        if (!$parsed['ok']) {
            fail('A térkép nem felel meg a szabályoknak: ' . $parsed['errors'][0]['message'], 422, ['errors' => $parsed['errors']]);
        }
        $pm = $parsed['map'];
        $canonical = MineScript::serializeMap($pm['rows'], $pm['cols'], $pm['grid']);
        $gold = MineScript::countGold($pm['grid']);

        $dup = db()->prepare('SELECT id FROM maps WHERE LOWER(name) = LOWER(?) AND id <> ?');
        $dup->execute([$name, (int) ($b['id'] ?? 0)]);
        if ($dup->fetch()) {
            fail('Már létezik ilyen nevű térkép.', 409);
        }

        if (!empty($b['id'])) {
            $old = load_map(int_param($b, 'id'));
            if (!can_edit($old, $user)) {
                fail('Ezt a térképet csak a készítője módosíthatja.', 403);
            }
            $pdo = db();
            $pdo->beginTransaction();
            $resultsCleared = false;
            if ($old['map_text'] !== $canonical) {
                // Megváltozott a pálya: a régi eredmények már nem összevethetők.
                $pdo->prepare('DELETE FROM runs WHERE map_id = ?')->execute([$old['id']]);
                $resultsCleared = true;
            }
            $pdo->prepare('UPDATE maps SET name = ?, rows_n = ?, cols_n = ?, map_text = ?, gold_total = ?, updated_at = ? WHERE id = ?')
                ->execute([$name, $pm['rows'], $pm['cols'], $canonical, $gold, now(), $old['id']]);
            $pdo->commit();
            json_out(['map' => load_map($old['id']), 'resultsCleared' => $resultsCleared]);
        }

        $st = db()->prepare('INSERT INTO maps (name, owner_id, rows_n, cols_n, map_text, gold_total, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $t = now();
        $st->execute([$name, $user['id'], $pm['rows'], $pm['cols'], $canonical, $gold, $t, $t]);
        json_out(['map' => load_map((int) db()->lastInsertId())], 201);

    case 'delete':
        $m = load_map(int_param(body(), 'id'));
        if (!can_edit($m, $user)) {
            fail('Ezt a térképet csak a készítője törölheti.', 403);
        }
        $pdo = db();
        $pdo->beginTransaction();
        $pdo->prepare('DELETE FROM runs WHERE map_id = ?')->execute([$m['id']]);
        $pdo->prepare('DELETE FROM maps WHERE id = ?')->execute([$m['id']]);
        $pdo->commit();
        json_out(['ok' => true]);

    default:
        fail('Ismeretlen művelet.', 404);
}
