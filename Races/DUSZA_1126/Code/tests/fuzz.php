<?php
require __DIR__ . '/../public/api/lib/MineScript.php';
$d = json_decode(file_get_contents($argv[1]), true);
$map = MineScript::parseMap($d['map'])['map'];
$out = [];
foreach ($d['cases'] as $code) {
    $r = MineScript::run($code, $map);
    $out[] = $r['status'] === 'SYNTAX_ERROR'
        ? ['status' => $r['status'], 'lines' => array_column($r['errors'], 'line')]
        : ['status' => $r['status'], 'errorCode' => $r['errorCode'], 'errorLine' => $r['errorLine'], 'gold' => $r['gold'], 'steps' => $r['steps'], 'output' => $r['output'], 'robot' => $r['robot']];
}
echo json_encode($out);
