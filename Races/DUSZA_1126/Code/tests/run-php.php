<?php
// Futtatás: php tests/run-php.php
require __DIR__ . '/../public/api/lib/MineScript.php';
$data = json_decode(file_get_contents(__DIR__ . '/cases.json'), true);
$pass = 0; $fail = 0;
$check = function (string $name, bool $ok, string $msg) use (&$pass, &$fail) {
    if ($ok) { $pass++; } else { $fail++; echo "FAIL $name $msg\n"; }
};
foreach ($data['runCases'] as $tc) {
    $m = MineScript::parseMap($data['maps'][$tc['map']]);
    $res = MineScript::run($tc['code'], $m['map']);
    $e = $tc['expect']; $errs = [];
    foreach (['status', 'errorCode', 'errorLine', 'steps', 'gold'] as $k) {
        if (array_key_exists($k, $e) && $e[$k] !== ($res[$k] ?? null)) $errs[] = "$k: várt " . json_encode($e[$k]) . ', kapott ' . json_encode($res[$k] ?? null);
    }
    if (isset($e['output']) && $e['output'] !== $res['output']) $errs[] = 'output: ' . json_encode($res['output']);
    if (isset($e['robot']) && $e['robot'] !== [$res['robot']['r'], $res['robot']['c'], $res['robot']['dir']]) $errs[] = 'robot: ' . json_encode($res['robot']);
    if ($res['status'] === 'SYNTAX_ERROR') $errs[] = json_encode($res['errors'], JSON_UNESCAPED_UNICODE);
    $check($tc['name'], !$errs, implode('; ', $errs));
}
foreach ($data['syntaxCases'] as $tc) {
    $p = MineScript::parseProgram($tc['code']);
    $lines = $p['ok'] ? [] : array_column($p['errors'], 'line');
    $check($tc['name'], !$p['ok'] && $lines === $tc['lines'], 'sorok: ' . json_encode($lines));
}
foreach ($data['mapCases'] as $tc) {
    $r = MineScript::parseMap($tc['text']);
    $check($tc['name'], $r['ok'] === $tc['ok'], json_encode($r, JSON_UNESCAPED_UNICODE));
}
echo "PHP: $pass sikeres, $fail hibás\n";
exit($fail ? 1 : 0);
