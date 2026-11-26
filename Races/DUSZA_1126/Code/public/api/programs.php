<?php
/**
 * A felhasználó saját, mentett programjai (plusz szolgáltatás).
 *
 *   GET  programs.php?action=list
 *   GET  programs.php?action=get&id=1
 *   POST programs.php?action=save    – {id?, name, code}
 *   POST programs.php?action=delete  – {id}
 */

declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';
start_api();
$user = require_user();

function own_program(int $id, int $uid): array
{
    $st = db()->prepare('SELECT id, name, code, updated_at FROM programs WHERE id = ? AND user_id = ?');
    $st->execute([$id, $uid]);
    $p = $st->fetch();
    if (!$p) {
        fail('A program nem található.', 404);
    }
    $p['id'] = (int) $p['id'];
    return $p;
}

switch (action()) {
    case 'list':
        $st = db()->prepare('SELECT id, name, updated_at FROM programs WHERE user_id = ? ORDER BY name');
        $st->execute([$user['id']]);
        $list = array_map(fn ($p) => ['id' => (int) $p['id']] + $p, $st->fetchAll());
        json_out(['programs' => $list]);

    case 'get':
        json_out(['program' => own_program(int_param($_GET, 'id'), $user['id'])]);

    case 'save':
        $b = body();
        $name = str_param($b, 'name', 1, 60, 'A program neve');
        $code = $b['code'] ?? '';
        if (!is_string($code) || strlen($code) > 20000) {
            fail('A program túl hosszú (legfeljebb 20 000 karakter).');
        }
        if (!empty($b['id'])) {
            $p = own_program(int_param($b, 'id'), $user['id']);
            db()->prepare('UPDATE programs SET name = ?, code = ?, updated_at = ? WHERE id = ?')
                ->execute([$name, $code, now(), $p['id']]);
            json_out(['program' => own_program($p['id'], $user['id'])]);
        }
        $st = db()->prepare('SELECT id FROM programs WHERE user_id = ? AND LOWER(name) = LOWER(?)');
        $st->execute([$user['id'], $name]);
        if ($existing = $st->fetch()) {
            // Azonos nevű program: felülírjuk (mentés másként egy már létező névre).
            db()->prepare('UPDATE programs SET code = ?, updated_at = ? WHERE id = ?')
                ->execute([$code, now(), $existing['id']]);
            json_out(['program' => own_program((int) $existing['id'], $user['id'])]);
        }
        db()->prepare('INSERT INTO programs (user_id, name, code, updated_at) VALUES (?, ?, ?, ?)')
            ->execute([$user['id'], $name, $code, now()]);
        json_out(['program' => own_program((int) db()->lastInsertId(), $user['id'])], 201);

    case 'delete':
        $p = own_program(int_param(body(), 'id'), $user['id']);
        db()->prepare('DELETE FROM programs WHERE id = ?')->execute([$p['id']]);
        json_out(['ok' => true]);

    default:
        fail('Ismeretlen művelet.', 404);
}
