<?php
/**
 * Felhasználókezelés.
 *   GET  auth.php?action=me        – a bejelentkezett felhasználó (vagy null)
 *   POST auth.php?action=register  – {username, password} szabad regisztráció
 *   POST auth.php?action=login     – {username, password}
 *   POST auth.php?action=logout
 */

declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';
start_api();

function public_user(?array $u): ?array
{
    return $u ? ['id' => $u['id'], 'username' => $u['username'], 'isAdmin' => $u['is_admin']] : null;
}

switch (action()) {
    case 'me':
        json_out(['user' => public_user(current_user())]);

    case 'register':
        $b = body();
        $username = str_param($b, 'username', 3, 30, 'A felhasználónév');
        if (!preg_match('/^[\p{L}\p{N}_.\-]+$/u', $username)) {
            fail('A felhasználónév csak betűt, számot, pontot, kötőjelet és aláhúzást tartalmazhat.');
        }
        $password = $b['password'] ?? '';
        if (!is_string($password) || mb_strlen($password) < 6 || mb_strlen($password) > 200) {
            fail('A jelszó legalább 6 karakter legyen.');
        }
        $st = db()->prepare('SELECT 1 FROM users WHERE LOWER(username) = LOWER(?)');
        $st->execute([$username]);
        if ($st->fetch()) {
            fail('Ez a felhasználónév már foglalt.', 409);
        }
        $st = db()->prepare('INSERT INTO users (username, password_hash, is_admin, created_at) VALUES (?, ?, 0, ?)');
        $st->execute([$username, password_hash($password, PASSWORD_DEFAULT), now()]);
        session_regenerate_id(true);
        $_SESSION['uid'] = (int) db()->lastInsertId();
        json_out(['user' => public_user(current_user())], 201);

    case 'login':
        $b = body();
        $username = is_string($b['username'] ?? null) ? trim($b['username']) : '';
        $password = is_string($b['password'] ?? null) ? $b['password'] : '';
        $st = db()->prepare('SELECT id, password_hash FROM users WHERE LOWER(username) = LOWER(?)');
        $st->execute([$username]);
        $row = $st->fetch();
        if (!$row || !password_verify($password, $row['password_hash'])) {
            usleep(300000); // lassítja a jelszópróbálgatást
            fail('Hibás felhasználónév vagy jelszó.', 401);
        }
        session_regenerate_id(true);
        $_SESSION['uid'] = (int) $row['id'];
        json_out(['user' => public_user(current_user())]);

    case 'logout':
        $_SESSION = [];
        session_destroy();
        json_out(['ok' => true]);

    default:
        fail('Ismeretlen művelet.', 404);
}
