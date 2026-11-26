<?php
/**
 * Bemutató adatok a telepítőhöz. Szabadon bővíthető.
 */

$elore = <<<'MS'
set count to 0
set fal to isThere 1
set megy to not fal
while megy
  set arany to isThere 2
  if arany
    step forward 1
    mine here
    set count to count + 1
  else
    step forward 1
  set fal to isThere 1
  set megy to not fal
print count
MS;

$balkez = <<<'MS'
set count to 0
set cel to 5
set megy to true
while megy
  turn by 1
  set fal to isThere 1
  while fal
    turn by 3
    set fal to isThere 1
  set arany to isThere 2
  step forward 1
  if arany
    mine here
    set count to count + 1
  set megy to count < cel
print count
MS;

$balkez10 = str_replace('set cel to 5', 'set cel to 10', $balkez);

$lusta = <<<'MS'
step forward 3
mine here
print true
MS;

$porgo = <<<'MS'
set kor to 0
while true
  turn by 1
  set kor to kor + 1
MS;

return [
    // [felhasználónév, jelszó, admin?]
    'users' => [
        ['admin', 'admin123', true],
        ['anna', 'anna123', false],
        ['bela', 'bela123', false],
        ['csaba', 'csaba123', false],
    ],

    // [név, készítő, térképfájl tartalma]
    'maps' => [
        ['Bemutató alagút', 'admin', "3 15\n....@..........\n.#############.\n.......@...>...\n"],
        ['Kezdő folyosó', 'admin', "1 10\n>..@..@..@\n"],
        ['Kígyó', 'anna', "5 9\n>...@....\n########.\n..@......\n.########\n....@...@\n"],
        ['Aranybarlang', 'bela', "8 10\n..@...#...\n.##.@.#.@.\n....#.....\n@.#...##.@\n..#.@.....\n.....#.@..\n.@##..#...\n...^..@..@\n"],
        ['Nagy labirintus', 'admin', "15 15\n"
            . ">....#....@...#\n"
            . ".###.#.##.###.#\n"
            . ".#@..#..#...#..\n"
            . ".#.####.###.#.#\n"
            . ".#......#@..#..\n"
            . ".######.#.###.#\n"
            . "......#.#...#..\n"
            . ".####.#.###.#.#\n"
            . ".#@.#...#...#..\n"
            . ".#..#####.#####\n"
            . ".#........#..@.\n"
            . ".########.#.##.\n"
            . "...@......#..#.\n"
            . ".##########.##.\n"
            . ".......@.......\n"],
    ],

    // [tulajdonos, programnév, kód]
    'programs' => [
        ['anna', 'Előre a falig', $elore],
        ['anna', 'Bal kéz szabály', $balkez],
        ['bela', 'Bal kéz szabály (10 arany)', $balkez10],
        ['bela', 'Lusta robot', $lusta],
        ['csaba', 'Pörgő robot', $porgo],
        ['csaba', 'Előre a falig', $elore],
    ],

    // [felhasználó, térkép, program] – az eredményt a telepítő számolja ki
    'runs' => [
        ['anna', 'Bemutató alagút', 'Előre a falig'],
        ['admin', 'Bemutató alagút', 'Bal kéz szabály'],
        ['anna', 'Kezdő folyosó', 'Előre a falig'],
        ['bela', 'Kezdő folyosó', 'Bal kéz szabály'],
        ['csaba', 'Kezdő folyosó', 'Pörgő robot'],
        ['anna', 'Kígyó', 'Bal kéz szabály'],
        ['bela', 'Kígyó', 'Előre a falig'],
        ['csaba', 'Kígyó', 'Bal kéz szabály'],
        ['anna', 'Aranybarlang', 'Bal kéz szabály'],
        ['bela', 'Aranybarlang', 'Lusta robot'],
        ['csaba', 'Aranybarlang', 'Előre a falig'],
        ['bela', 'Aranybarlang', 'Bal kéz szabály (10 arany)'],
        ['anna', 'Nagy labirintus', 'Bal kéz szabály'],
        ['bela', 'Nagy labirintus', 'Bal kéz szabály (10 arany)'],
        ['csaba', 'Nagy labirintus', 'Előre a falig'],
    ],
];
