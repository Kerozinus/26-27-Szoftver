<?php
/**
 * MineScript – szerveroldali (PHP) megvalósítás.
 *
 * A böngészős public/js/minescript.js pontos megfelelője. A szerver ezzel
 * futtatja újra a beküldött programot, így a ranglistára csak a szerver által
 * kiszámolt eredmény kerülhet. A tests/cases.json tesztesetei mindkét
 * változaton lefutnak (tests/run-php.php).
 */

declare(strict_types=1);

final class MineScriptSyntaxError extends Exception
{
    public int $lineNo;

    public function __construct(int $lineNo, string $message)
    {
        parent::__construct($message);
        $this->lineNo = $lineNo;
    }
}

final class MineScriptRuntimeError extends Exception
{
    public string $errorCode;
    public int $lineNo;

    public function __construct(string $code, int $lineNo, string $message = '')
    {
        parent::__construct($message !== '' ? $message : $code);
        $this->errorCode = $code;
        $this->lineNo = $lineNo;
    }
}

final class MineScript
{
    public const MAX_STEPS = 1000;
    public const MAX_LITERAL = 100;
    public const MAP_MIN = 1;
    public const MAP_MAX = 15;

    private const KEYWORDS = [
        'and', 'by', 'else', 'false', 'forward', 'here', 'if', 'isthere', 'mine',
        'not', 'or', 'print', 'set', 'step', 'to', 'true', 'turn', 'while',
    ];
    private const ARITH = ['+', '-', '*'];
    private const COMPARE = ['<', '<=', '>', '>='];
    private const EQUALITY = ['=', '<>'];
    private const LOGIC = ['and', 'or'];

    /** Balra fordulás = +1 index. */
    public const DIR_CHARS = ['^', '<', 'v', '>'];
    private const DIR_DELTA = [[-1, 0], [0, -1], [1, 0], [0, 1]];

    // ------------------------------------------------------------------
    // Térkép
    // ------------------------------------------------------------------

    /**
     * @return array{ok:bool, map?:array{rows:int, cols:int, grid:string[]}, errors?:array}
     */
    public static function parseMap(string $text): array
    {
        $src = preg_replace('/^\xEF\xBB\xBF/', '', $text);
        $src = str_replace(["\r\n", "\r"], "\n", $src);
        $src = rtrim($src, "\n");
        if (trim($src) === '') {
            return ['ok' => false, 'errors' => [['line' => null, 'message' => 'A térképfájl üres.']]];
        }
        $lines = array_map(fn ($l) => rtrim($l, " \t"), explode("\n", $src));
        if (!preg_match('/^(\d+) (\d+)$/', $lines[0], $m)) {
            return ['ok' => false, 'errors' => [['line' => 1, 'message' => 'Az első sorban a térkép méretének kell állnia (pl. „3 15”).']]];
        }
        $rows = (int) $m[1];
        $cols = (int) $m[2];
        if ($rows < self::MAP_MIN || $rows > self::MAP_MAX || $cols < self::MAP_MIN || $cols > self::MAP_MAX) {
            return ['ok' => false, 'errors' => [['line' => 1, 'message' => 'A térkép mindkét mérete 1 és 15 között kell legyen.']]];
        }
        $body = array_slice($lines, 1);
        $errors = [];
        if (count($body) !== $rows) {
            $errors[] = ['line' => null, 'message' => "A fejléc szerint $rows sornak kellene lennie, de " . count($body) . ' sor található.'];
        }
        foreach ($body as $i => $line) {
            if (strlen($line) !== $cols) {
                $errors[] = ['line' => $i + 2, 'message' => "A sor hossza " . strlen($line) . ", de $cols karakternek kellene lennie."];
            }
            if (preg_match('/[^.@#<>^v]/', $line)) {
                $errors[] = ['line' => $i + 2, 'message' => 'Ismeretlen karakter a sorban. Megengedett: . @ # > < ^ v'];
            }
        }
        if (!$errors) {
            $errors = self::validateGrid($rows, $cols, $body);
        }
        if ($errors) {
            return ['ok' => false, 'errors' => $errors];
        }
        return ['ok' => true, 'map' => ['rows' => $rows, 'cols' => $cols, 'grid' => array_values($body)]];
    }

    public static function validateGrid(mixed $rows, mixed $cols, mixed $grid): array
    {
        if (!is_int($rows) || !is_int($cols) || $rows < self::MAP_MIN || $rows > self::MAP_MAX
            || $cols < self::MAP_MIN || $cols > self::MAP_MAX) {
            return [['line' => null, 'message' => 'A térkép mindkét mérete 1 és 15 között kell legyen.']];
        }
        if (!is_array($grid) || count($grid) !== $rows) {
            return [['line' => null, 'message' => 'A térkép sorainak száma nem egyezik a mérettel.']];
        }
        $robots = 0;
        foreach (array_values($grid) as $r => $row) {
            if (!is_string($row) || strlen($row) !== $cols || preg_match('/[^.@#<>^v]/', $row)) {
                return [['line' => null, 'message' => 'A térkép ' . ($r + 1) . '. sora hibás.']];
            }
            $robots += preg_match_all('/[<>^v]/', $row);
        }
        if ($robots !== 1) {
            return [['line' => null, 'message' => "A térképen pontosan egy robotnak kell lennie (most: $robots)."]];
        }
        return [];
    }

    public static function serializeMap(int $rows, int $cols, array $grid): string
    {
        return "$rows $cols\n" . implode("\n", $grid) . "\n";
    }

    public static function countGold(array $grid): int
    {
        $n = 0;
        foreach ($grid as $row) {
            $n += substr_count($row, '@');
        }
        return $n;
    }

    // ------------------------------------------------------------------
    // Szintaktikai elemzés
    // ------------------------------------------------------------------

    private static function isKeyword(string $tok): bool
    {
        return in_array(strtolower($tok), self::KEYWORDS, true);
    }

    private static function simpleval(string $tok, int $line): array
    {
        if (preg_match('/^[0-9]+$/', $tok)) {
            $v = (int) ltrim($tok, '0');
            if (strlen(ltrim($tok, '0')) > 3 || $v > self::MAX_LITERAL) {
                throw new MineScriptSyntaxError($line, "A(z) $tok szám kívül esik a 0–100 tartományon.");
            }
            return ['kind' => 'int', 'value' => $v];
        }
        if ($tok === 'true' || $tok === 'false') {
            return ['kind' => 'bool', 'value' => $tok === 'true'];
        }
        if (preg_match('/^[A-Za-z][A-Za-z0-9]*$/', $tok)) {
            if (self::isKeyword($tok)) {
                throw new MineScriptSyntaxError($line, "„{$tok}” kulcsszó, itt nem állhat.");
            }
            return ['kind' => 'var', 'name' => $tok];
        }
        throw new MineScriptSyntaxError($line, "„{$tok}” nem érvényes érték.");
    }

    private static function ident(?string $tok, int $line): string
    {
        if ($tok === null || !preg_match('/^[A-Za-z][A-Za-z0-9]*$/', $tok) || self::isKeyword($tok)) {
            throw new MineScriptSyntaxError($line, 'Érvénytelen változónév.');
        }
        return $tok;
    }

    private static function expect(array $t, int $i, string $kw, int $line): void
    {
        if (($t[$i] ?? null) !== $kw) {
            throw new MineScriptSyntaxError($line, "„{$kw}” kulcsszó várható.");
        }
    }

    private static function count(array $t, int $n, int $line): void
    {
        if (count($t) !== $n) {
            throw new MineScriptSyntaxError($line, 'Hibás utasítás (rossz számú token).');
        }
    }

    private static function calculated(array $t, int $line): array
    {
        $n = count($t);
        if ($n === 1) {
            return ['type' => 'value', 'value' => self::simpleval($t[0], $line)];
        }
        if ($n === 2) {
            if ($t[0] === 'isThere') {
                return ['type' => 'isThere', 'arg' => self::simpleval($t[1], $line)];
            }
            if ($t[0] === 'not') {
                return ['type' => 'not', 'arg' => self::simpleval($t[1], $line)];
            }
            throw new MineScriptSyntaxError($line, 'Két tagú kifejezés csak „isThere x” vagy „not x” lehet.');
        }
        if ($n === 3) {
            $op = $t[1];
            if (!in_array($op, array_merge(self::ARITH, self::COMPARE, self::EQUALITY, self::LOGIC), true)) {
                throw new MineScriptSyntaxError($line, "„{$op}” nem ismert művelet.");
            }
            return ['type' => 'binop', 'op' => $op,
                'left' => self::simpleval($t[0], $line), 'right' => self::simpleval($t[2], $line)];
        }
        throw new MineScriptSyntaxError($line, 'Hibás kifejezés.');
    }

    private static function command(array $t, int $line): array
    {
        switch ($t[0]) {
            case 'step':
                self::expect($t, 1, 'forward', $line);
                self::count($t, 3, $line);
                return ['kind' => 'step', 'arg' => self::simpleval($t[2], $line)];
            case 'turn':
                self::expect($t, 1, 'by', $line);
                self::count($t, 3, $line);
                return ['kind' => 'turn', 'arg' => self::simpleval($t[2], $line)];
            case 'mine':
                self::expect($t, 1, 'here', $line);
                self::count($t, 2, $line);
                return ['kind' => 'mine'];
            case 'print':
                self::count($t, 2, $line);
                return ['kind' => 'print', 'arg' => self::simpleval($t[1], $line)];
            case 'set':
                $name = self::ident($t[1] ?? null, $line);
                self::expect($t, 2, 'to', $line);
                return ['kind' => 'set', 'name' => $name, 'expr' => self::calculated(array_slice($t, 3), $line)];
            case 'if':
                self::count($t, 2, $line);
                return ['kind' => 'if', 'cond' => self::simpleval($t[1], $line)];
            case 'while':
                self::count($t, 2, $line);
                return ['kind' => 'while', 'cond' => self::simpleval($t[1], $line)];
            case 'else':
                self::count($t, 1, $line);
                return ['kind' => 'else'];
            default:
                throw new MineScriptSyntaxError($line, "Ismeretlen utasítás: „{$t[0]}”.");
        }
    }

    /**
     * @return array{ok:bool, program?:array, errors?:array}
     */
    public static function parseProgram(string $source): array
    {
        $src = preg_replace('/^\xEF\xBB\xBF/', '', $source);
        $src = str_replace(["\r\n", "\r"], "\n", $src);
        $raw = $src === '' ? [] : explode("\n", $src);
        if ($raw && end($raw) === '') {
            array_pop($raw);
        }
        $errors = [];
        $lines = [];
        foreach ($raw as $i => $text) {
            $no = $i + 1;
            try {
                if (str_contains($text, "\t")) {
                    throw new MineScriptSyntaxError($no, 'Tabulátor nem használható.');
                }
                if (trim($text) === '') {
                    throw new MineScriptSyntaxError($no, 'Üres sor nem szerepelhet a programban.');
                }
                if (preg_match('/[^\x21-\x7E ]/', $text)) {
                    throw new MineScriptSyntaxError($no, 'Nem megengedett karakter.');
                }
                $rest = ltrim($text, ' ');
                $indent = strlen($text) - strlen($rest);
                if (str_ends_with($rest, ' ')) {
                    throw new MineScriptSyntaxError($no, 'A sor végén felesleges szóköz áll.');
                }
                if (str_contains($rest, '  ')) {
                    throw new MineScriptSyntaxError($no, 'A tokenek között pontosan egy szóköz állhat.');
                }
                $lines[] = ['no' => $no, 'indent' => $indent, 'cmd' => self::command(explode(' ', $rest), $no)];
            } catch (MineScriptSyntaxError $e) {
                $errors[] = ['line' => $e->lineNo, 'message' => $e->getMessage()];
            }
        }
        if ($errors) {
            return ['ok' => false, 'errors' => $errors];
        }
        try {
            if ($lines && $lines[0]['indent'] !== 0) {
                throw new MineScriptSyntaxError($lines[0]['no'], 'A legfelső szintű sorok nem lehetnek behúzva.');
            }
            $pos = 0;
            $body = self::block($lines, $pos, 0);
            if ($pos < count($lines)) {
                throw new MineScriptSyntaxError($lines[$pos]['no'], 'Hibás behúzás.');
            }
            return ['ok' => true, 'program' => ['body' => $body]];
        } catch (MineScriptSyntaxError $e) {
            return ['ok' => false, 'errors' => [['line' => $e->lineNo, 'message' => $e->getMessage()]]];
        }
    }

    private static function block(array $lines, int &$pos, int $indent): array
    {
        $body = [];
        $n = count($lines);
        while ($pos < $n) {
            $ln = $lines[$pos];
            if ($ln['indent'] < $indent) {
                break;
            }
            if ($ln['indent'] > $indent) {
                throw new MineScriptSyntaxError($ln['no'], 'Hibás behúzás.');
            }
            if ($ln['cmd']['kind'] === 'else') {
                throw new MineScriptSyntaxError($ln['no'], 'Az „else” előtt nem áll vele azonos behúzású „if”.');
            }
            $pos++;
            $cmd = $ln['cmd'] + ['line' => $ln['no']];
            if ($cmd['kind'] === 'if' || $cmd['kind'] === 'while') {
                $cmd['body'] = self::childBlock($lines, $pos, $indent);
                if ($cmd['kind'] === 'if' && $pos < $n && $lines[$pos]['indent'] === $indent
                    && $lines[$pos]['cmd']['kind'] === 'else') {
                    $cmd['elseLine'] = $lines[$pos]['no'];
                    $pos++;
                    $cmd['elseBody'] = self::childBlock($lines, $pos, $indent);
                }
            }
            $body[] = $cmd;
        }
        return $body;
    }

    private static function childBlock(array $lines, int &$pos, int $parentIndent): array
    {
        if ($pos < count($lines) && $lines[$pos]['indent'] > $parentIndent) {
            return self::block($lines, $pos, $lines[$pos]['indent']);
        }
        return [];
    }

    // ------------------------------------------------------------------
    // Futtatás
    // ------------------------------------------------------------------

    private array $grid = [];
    private int $rows;
    private int $cols;
    private int $rr = 0;
    private int $rc = 0;
    private int $dir = 0;
    private array $vars = [];
    private int $steps = 0;
    private int $gold = 0;
    private array $output = [];

    /**
     * Forráskód futtatása egy térképen, animáció nélkül.
     * @return array{status:string, errorCode:?string, errorLine:?int, gold:int, steps:int, output:array, robot?:array, errors?:array}
     */
    public static function run(string $source, array $map): array
    {
        $parsed = self::parseProgram($source);
        if (!$parsed['ok']) {
            return ['status' => 'SYNTAX_ERROR', 'errors' => $parsed['errors']];
        }
        $runner = new self($map);
        return $runner->execute($parsed['program']);
    }

    private function __construct(array $map)
    {
        $this->rows = $map['rows'];
        $this->cols = $map['cols'];
        foreach ($map['grid'] as $r => $row) {
            $cells = str_split($row);
            foreach ($cells as $c => $ch) {
                $d = array_search($ch, self::DIR_CHARS, true);
                if ($d !== false) {
                    $this->rr = $r;
                    $this->rc = $c;
                    $this->dir = $d;
                    $cells[$c] = '.';
                }
            }
            $this->grid[] = $cells;
        }
    }

    private function execute(array $program): array
    {
        $status = 'OK';
        $code = null;
        $line = null;
        try {
            $this->execBlock($program['body']);
        } catch (MineScriptRuntimeError $e) {
            $status = 'ERROR';
            $code = $e->errorCode;
            $line = $e->lineNo;
        }
        return [
            'status' => $status,
            'errorCode' => $code,
            'errorLine' => $line,
            'gold' => $this->gold,
            'steps' => $this->steps,
            'output' => $this->output,
            'robot' => ['r' => $this->rr, 'c' => $this->rc, 'dir' => self::DIR_CHARS[$this->dir]],
        ];
    }

    private function tick(int $line): void
    {
        if ($this->steps >= self::MAX_STEPS) {
            throw new MineScriptRuntimeError('INSTRUCTION_COUNT_LIMIT_EXCEEDED', $line);
        }
        $this->steps++;
    }

    private function execBlock(array $body): void
    {
        foreach ($body as $cmd) {
            $this->execCommand($cmd);
        }
    }

    private function execCommand(array $cmd): void
    {
        $line = $cmd['line'];
        switch ($cmd['kind']) {
            case 'step':
                $this->tick($line);
                $n = $this->apiInt($cmd['arg'], $line, 0, PHP_INT_MAX);
                for ($i = 0; $i < $n; $i++) {
                    [$dr, $dc] = self::DIR_DELTA[$this->dir];
                    $nr = $this->rr + $dr;
                    $nc = $this->rc + $dc;
                    if (!$this->inBounds($nr, $nc) || $this->grid[$nr][$nc] === '#') {
                        throw new MineScriptRuntimeError('E_BEDROCK_HIT', $line);
                    }
                    $this->rr = $nr;
                    $this->rc = $nc;
                }
                return;
            case 'turn':
                $this->tick($line);
                $n = $this->apiInt($cmd['arg'], $line, 0, PHP_INT_MAX);
                $this->dir = ($this->dir + $n % 4) % 4;
                return;
            case 'mine':
                $this->tick($line);
                if ($this->grid[$this->rr][$this->rc] !== '@') {
                    throw new MineScriptRuntimeError('E_NO_GOLD', $line);
                }
                $this->grid[$this->rr][$this->rc] = '.';
                $this->gold++;
                return;
            case 'print':
                $this->tick($line);
                $this->output[] = self::format($this->read($cmd['arg'], $line));
                return;
            case 'set':
                $this->tick($line);
                $v = $this->evaluate($cmd['expr'], $line);
                $name = $cmd['name'];
                if (isset($this->vars[$name]) && $this->vars[$name]['type'] !== $v['type']) {
                    throw new MineScriptRuntimeError('E_TYPE_MISMATCH', $line);
                }
                $this->vars[$name] = $v;
                return;
            case 'if':
                $this->tick($line);
                if ($this->condition($cmd['cond'], $line)) {
                    $this->execBlock($cmd['body']);
                } elseif (isset($cmd['elseBody'])) {
                    $this->tick($cmd['elseLine']);
                    $this->execBlock($cmd['elseBody']);
                }
                return;
            case 'while':
                while (true) {
                    $this->tick($line);
                    if (!$this->condition($cmd['cond'], $line)) {
                        break;
                    }
                    $this->execBlock($cmd['body']);
                }
                return;
        }
    }

    private function inBounds(int $r, int $c): bool
    {
        return $r >= 0 && $r < $this->rows && $c >= 0 && $c < $this->cols;
    }

    private function read(array $sv, int $line): array
    {
        if ($sv['kind'] === 'int') {
            return ['type' => 'int', 'value' => $sv['value']];
        }
        if ($sv['kind'] === 'bool') {
            return ['type' => 'bool', 'value' => $sv['value']];
        }
        if (!isset($this->vars[$sv['name']])) {
            throw new MineScriptRuntimeError('E_UNINITIALIZED', $line);
        }
        return $this->vars[$sv['name']];
    }

    private function apiInt(array $sv, int $line, int $min, int $max): int
    {
        $v = $this->read($sv, $line);
        if ($v['type'] !== 'int' || $v['value'] < $min || $v['value'] > $max) {
            throw new MineScriptRuntimeError('E_BAD_ARG', $line);
        }
        return $v['value'];
    }

    private function condition(array $sv, int $line): bool
    {
        $v = $this->read($sv, $line);
        if ($v['type'] !== 'bool') {
            throw new MineScriptRuntimeError('E_NON_BOOL_CONDITION', $line);
        }
        return $v['value'];
    }

    private static function format(array $v): string
    {
        return $v['type'] === 'bool' ? ($v['value'] ? 'true' : 'false') : (string) $v['value'];
    }

    private static function wrap32(int $x): int
    {
        $x &= 0xFFFFFFFF;
        return $x >= 0x80000000 ? $x - 0x100000000 : $x;
    }

    private function checkOperand(string $op, array $v, int $line): void
    {
        $needInt = in_array($op, self::ARITH, true) || in_array($op, self::COMPARE, true);
        $needBool = in_array($op, self::LOGIC, true);
        if (($needInt && $v['type'] !== 'int') || ($needBool && $v['type'] !== 'bool')) {
            throw new MineScriptRuntimeError('E_BAD_OPERAND', $line);
        }
    }

    private function evaluate(array $e, int $line): array
    {
        switch ($e['type']) {
            case 'value':
                return $this->read($e['value'], $line);
            case 'isThere':
                $w = $this->apiInt($e['arg'], $line, 0, 2);
                [$dr, $dc] = self::DIR_DELTA[$this->dir];
                $r = $this->rr + $dr;
                $c = $this->rc + $dc;
                if (!$this->inBounds($r, $c)) {
                    $kind = 1;
                } else {
                    $cell = $this->grid[$r][$c];
                    $kind = $cell === '#' ? 1 : ($cell === '@' ? 2 : 0);
                }
                return ['type' => 'bool', 'value' => $kind === $w];
            case 'not':
                $v = $this->read($e['arg'], $line);
                if ($v['type'] !== 'bool') {
                    throw new MineScriptRuntimeError('E_BAD_OPERAND', $line);
                }
                return ['type' => 'bool', 'value' => !$v['value']];
            case 'binop':
                $op = $e['op'];
                $a = $this->read($e['left'], $line);
                $this->checkOperand($op, $a, $line);
                $b = $this->read($e['right'], $line);
                $this->checkOperand($op, $b, $line);
                if (in_array($op, self::EQUALITY, true) && $a['type'] !== $b['type']) {
                    throw new MineScriptRuntimeError('E_BAD_OPERAND', $line);
                }
                $x = $a['value'];
                $y = $b['value'];
                return match ($op) {
                    '+' => ['type' => 'int', 'value' => self::wrap32($x + $y)],
                    '-' => ['type' => 'int', 'value' => self::wrap32($x - $y)],
                    '*' => ['type' => 'int', 'value' => self::wrap32($x * $y)],
                    '<' => ['type' => 'bool', 'value' => $x < $y],
                    '<=' => ['type' => 'bool', 'value' => $x <= $y],
                    '>' => ['type' => 'bool', 'value' => $x > $y],
                    '>=' => ['type' => 'bool', 'value' => $x >= $y],
                    '=' => ['type' => 'bool', 'value' => $x === $y],
                    '<>' => ['type' => 'bool', 'value' => $x !== $y],
                    'and' => ['type' => 'bool', 'value' => $x && $y],
                    'or' => ['type' => 'bool', 'value' => $x || $y],
                };
        }
        throw new LogicException('Ismeretlen kifejezés');
    }
}
