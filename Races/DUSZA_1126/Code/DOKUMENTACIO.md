# Kincskereső robot – Robotszimulátor

Dusza Árpád Országos Programozói Emlékverseny 2026/2027 – I. forduló (Web)

## Röviden az alkalmazásról

Böngészőben futó játék, amelyben a kincskereső robotot **MineScript** nyelven írt programmal lehet irányítani egy bánya labirintusában. A program futását a felület lassítva, animálva mutatja: látszik a robot helyzete, iránya, a felfedezett terület, az épp végrehajtott sor, a konzolkimenet és a változók értéke. Minden befejezett futtatás eredménye (arany, lépésszám) a pályához tartozó ranglistára kerül.

**Felépítés**

| Rész | Technológia | Hely |
|---|---|---|
| Felület | HTML + CSS + JavaScript, külső könyvtár és buildelés nélkül | `public/index.html`, `public/css/`, `public/js/app.js` |
| MineScript értelmező (böngésző) | JavaScript | `public/js/minescript.js` |
| MineScript értelmező (szerver) | PHP 8.3 | `public/api/lib/MineScript.php` |
| REST-szerű API | PHP 8.3 + PDO | `public/api/*.php` |
| Adatbázis | MySQL 8.4 (helyi próbához SQLite is) | `setup/install.php` hozza létre |
| Tesztek | Node.js + PHP | `tests/` |

## Melyik funkció hogyan érhető el?

### Bejelentkezés és felhasználókezelés
- Az alkalmazás megnyitásakor a bejelentkező képernyő jelenik meg. Minden funkció csak belépés után érhető el.
- **Szabad regisztráció:** a „Regisztráció” fülön (3–30 karakteres felhasználónév, legalább 6 karakteres jelszó). Sikeres regisztráció után a felhasználó azonnal be is lép.
- A jelszavakat a szerver `password_hash`-sel (bcrypt) tárolja. A munkamenet HttpOnly, SameSite sütiben él.
- Bemutató fiókok (a „Bemutató fiókok” lenyíló listában egy kattintással is beléphetsz): `anna / anna123`, `bela / bela123`, `csaba / csaba123`, `admin / admin123` (adminisztrátor).
- Az adminisztrátor bármelyik térképet módosíthatja vagy törölheti. A többi felhasználó csak a sajátját.
- Kijelentkezés: a jobb felső „Kijelentkezés” gomb.

### Játék (program szerkesztése és futtatása) – „Játék” menüpont
- **Pálya választása:** a „Pálya” legördülő listában. A térképek közösek, minden felhasználó minden pályán játszhat.
- **Kódszerkesztő:** sorszámozott szövegmező.
  - A `Tab` két szóközt szúr be, a `Shift+Tab` visszahúz. Az `Enter` megtartja a behúzást, `if`/`while`/`else` után pedig beljebb kezd.
  - A szerkesztőből `Esc`, majd `Tab` billentyűvel lehet kilépni.
  - Szerkesztés közben folyamatos szintaktikai ellenőrzés fut. A hibás sorok a sorszámnál pirossal és „!” jellel látszanak, alattuk a hibaüzenet (kattintásra a hibás sorra ugrik).
- **Program műveletek:**
  - *Új*.
  - *Megnyitás…*: saját mentett programok és a feladatleírás példaprogramja.
  - *Mentés* a szerverre, a saját programok közé (`Ctrl+S`).
  - *Importálás fájlból* és *Exportálás fájlba* (`.txt`). Szintaktikailag hibás fájlt nem tölt be, hibaüzenetet ad a hibás sorral.
  - *Ellenőrzés*.
- **Futtatás:**
  - *Futtatás* (`Ctrl+Enter`): induláskor a térkép és a robot alaphelyzetbe kerül, és a program lassítva fut.
  - *Szünet / Folytatás*.
  - *Lépés*: soronként halad.
  - *Leállítás* és *Alaphelyzet*.
  - A *Sebesség* csúszkán hat fokozat van, a „nagyon lassú”-tól az „azonnali”-ig.
  - Szintaktikailag hibás program nem indul el: a felület jelzi a hibát és a hibás sort.
- **Futás közben látható:**
  - az épp végrehajtott sor (sárga kiemelés és „▶” jel),
  - a robot helyzete és iránya,
  - a felfedezett mezők: amelyeken a robot járt, vagy amelyekre `isThere` hívódott. Ezek világosabbak, a feltáratlanok sötétek és sraffozottak. A „Teljes sötétség” kapcsolóval a feltáratlan mezők tartalma teljesen elrejthető.
  - az `isThere`-rel épp megvizsgált mező kék kerettel,
  - a kibányászott arany és az összes arany száma, a lépésszám (/1000), a robot iránya és a futás állapota,
  - a `print` kimenete a *Konzolban*, a változók neve, típusa és értéke a *Változók* táblában.
- **A futás vége:**
  - Hiba nélkül, futásidejű hibával vagy a lépéslimit túllépésével érhet véget.
  - Hiba esetén a felület mutatja a hibakódot (pl. `E_BEDROCK_HIT`, `INSTRUCTION_COUNT_LIMIT_EXCEEDED`), a hibás sort (pirossal jelölve; a hivatkozásra kattintva oda ugrik) és a hiba részletes magyarázatát.
  - Az eredmény a ranglistára kerül, a felület kiírja az elért helyezést is.
- **Saját futtatásaim ezen a pályán:** a korábbi futtatások listája. Bármelyik futtatás programja visszatölthető a szerkesztőbe.

### Térképszerkesztő – „Térképszerkesztő” menüpont
- Bal oldalon a térképek listája, onnan választható ki a szerkesztendő térkép. Az *Új térkép* gomb üres térképet kezd.
- Megadható a térkép neve és mérete (1–15 sor és oszlop). Átméretezéskor a meglévő tartalom megmarad.
- **Eszközök:** Üres kamra, Arany, Fal, Robot. A robot kezdőirányát külön legördülő lista állítja.
  - Egérrel kattintva vagy húzva lehet rajzolni, érintőképernyőn is.
  - Billentyűzettel: a nyilakkal lehet mozogni, `Szóköz`/`Enter` rajzol, az `1`–`4` gomb vált eszközt, a `.`, `@`, `#`, `>`, `<`, `^`, `v` karakter közvetlenül azt a mezőt rajzolja.
  - Új robot lerakásakor a régi automatikusan eltűnik, így mindig legfeljebb egy robot van a térképen.
- **Kényelmi gombok:** *Kitöltés üressel*, *Fal keret*.
- **Ellenőrzés:** a szerkesztő folyamatosan ellenőrzi a szabályokat (méret 1–15, pontosan egy robot, ami nem állhat aranyon). Érvénytelen térkép nem menthető és nem exportálható, a hibák listája látszik.
- **Mentés:** *Mentés*, illetve *Mentés újként* (másolat). Ha egy már lejátszott pálya tartalma megváltozik, a felület figyelmeztet, hogy a régi eredmények törlődnek.
- **Importálás és exportálás:** a térkép a feladatleírás 1. fejezete szerinti formátumban exportálható és importálható. Hibás fájlnál a felület érthető, sorszámos hibaüzenetet ad, és nem tölt be semmit.
- *Kipróbálom*: a mentett térképet megnyitja a Játék nézetben.
- *Törlés*: a térképet a ranglistájával együtt törli.

### Ranglista – „Ranglista” menüpont
- Pályánként mutatja az eredményeket. Előrébb áll, aki több aranyat bányászott ki, azonos aranynál pedig az, akinek ehhez kevesebb lépés kellett. Teljes egyezésnél a korábbi eredmény áll elöl, de a helyezésszám azonos.
- Alapból játékosonként a legjobb futtatás látszik. A „Minden futtatás mutatása” kapcsolóval az összes megjelenik.
- A saját sorok ki vannak emelve. Az első három helyezett érmet kap.

### Súgó – „Súgó” menüpont
A MineScript nyelv rövid leírása, egy példaprogram (betölthető a szerkesztőbe), a hibakódok magyarázata és a billentyűparancsok.

## Mi nem készült el, vagy mi maradt ki?

- Nincs külön adminisztrátori felület a felhasználók kezeléséhez (pl. letiltás, jelszó visszaállítás). Az adminisztrátor jogköre a térképek módosítására és törlésére terjed ki.
- Nincs „elfelejtett jelszó” funkció (ehhez levelezés kellene).
- A kódszerkesztő nem színezi a szintaxist (csak sorszámozás, sorkiemelés, hibajelölés és automatikus behúzás van).

## Plusz szolgáltatások az alapfeladathoz képest

1. **A szerver újrafuttatja a programot.** A ranglistára nem a böngésző által jelentett szám kerül: a szerver a PHP-ban megírt értelmezővel maga is lefuttatja a beküldött programot a pályán, és az így kapott eredményt rögzíti. Így a ranglistán nem lehet csalni. A két értelmező egyezését automatikus tesztek ellenőrzik.
2. **Lépésenkénti futtatás és szüneteltetés**, hat sebességfokozat (az „azonnali” fokozat a végeredményt mutatja meg).
3. **Változók táblája**, ahol futás közben látszik minden változó neve, típusa és értéke.
4. **Az `isThere`-rel megvizsgált mező kiemelése**, és a „Teljes sötétség” mód.
5. **Saját programok mentése a szerverre**, és **korábbi futtatások kódjának visszatöltése**.
6. **Élő szintaktikai ellenőrzés** gépelés közben, minden hibás sor egyszerre megjelölve, érthető magyar hibaüzenetekkel. Például nagybetűs kulcsszónál javaslatot is ad: „helyesen: set”.
7. **Kényelmes kódszerkesztő:** automatikus behúzás, Tab/Shift+Tab, billentyűparancsok.
8. **Piszkozat megőrzése:** a szerkesztő tartalma és a kiválasztott pálya újratöltés után is megmarad (a böngészőben, felhasználónként).
9. **Kényelmes térképszerkesztő:** húzással rajzolás, teljes billentyűzetes kezelés, kitöltés és falkeret egy gombnyomásra, másolat mentése.
10. **Akadálymentesség:**
    - szemantikus HTML, minden vezérlőnek felirata van,
    - „Ugrás a tartalomhoz” link, jól látható fókuszjelzés,
    - képernyőolvasónak szóló állapotbejelentések (`aria-live`), és a térkép állapota szövegesen is: hol a robot, merre néz, mennyi arany van meg,
    - a színek mellett mindig van szöveges vagy szimbólumos jelzés is (▶, !, hibakód),
    - WCAG AA kontraszt, a `prefers-reduced-motion` beállítás tiszteletben tartása, mobilon is használható elrendezés.
11. **Biztonság:**
    - jelszó-hash, előkészített SQL-utasítások (SQL injection ellen),
    - CSRF-védelem egyedi fejléccel,
    - munkamenet-azonosító csere belépéskor,
    - lassított hibás belépés,
    - méretkorlát a feltöltött fájlokra és programokra.
12. **Automatikus tesztek:**
    - több mint 80 kézzel írt teszteset a feladatleírás minden szabályára (szintaxis, minden hibakód, lépésszámolás, határesetek),
    - véletlen programokkal végzett összehasonlító teszt a böngészős és a szerveres értelmező között.

## Felmerült problémák és megoldásuk

- **A feladatleírás példaprogramjából a PDF-ben elveszett a behúzás.** A szöveges leírás alapján rekonstruáltuk: a `set fal …` és a `set megy …` sor a `while` törzsében, az if/else után áll. Ezzel a programmal a feladat példatérképén 26 lépés és 0 arany az eredmény (ez tesztesetként is szerepel).
- **Mikor számít egy sor lépésnek a ciklusban és az elágazásban?** A szabályokat pontosan követtük: a `while` sora minden feltétel-kiértékeléskor számít (az utolsó, hamis kiértékeléskor is), az `else` sora csak akkor, ha az else-ág lefut. Az 1000-es limitnél pontosan az 1000. sor még lefut, és az 1001. sor előtt áll le a program. Mindkét határesetre van teszt.
- **A kiértékelés sorrendje és a hibakódok elsőbbsége.** Az operandusokat balról jobbra olvassuk be, és mindegyiket azonnal ellenőrizzük. Ezért például a `true + c` hibakódja `E_BAD_OPERAND`, az `1 + c` hibakódja pedig `E_UNINITIALIZED`. A `true or c` is beolvassa a `c`-t, nincs rövidzár. Az `=` és a `<>` csak a második operandus után ellenőrzi a típusegyezést.
- **Animáció és pontos végrehajtás összehangolása.** Az értelmezőt JavaScript-generátorként írtuk meg: minden feldolgozott sor és minden robotlépés után „eseményt” ad vissza. Így ugyanaz a kód fut animálva, lépésenként és azonnal is, és a felület bármikor megállíthatja.
- **Két értelmező (JS és PHP) eltérésének veszélye.** Közös tesztfájlt készítettünk (`tests/cases.json`), amit mindkét megvalósítás lefuttat. Emellett egy összehasonlító teszt több ezer véletlen programot futtat le mindkettőn, és az eredményeknek bitre egyezniük kell.
- **Túlcsordulás.** A ciklusban ismételt szorzás nagyon nagy számokhoz vezethet, ezt a leírás nem szabályozza. Determinisztikus, mindkét nyelven azonos viselkedést választottunk: 32 bites előjeles egész aritmetika túlcsordulással.
- **Egy pálya módosítása után a régi ranglista-eredmények értelmüket vesztik.** Ezért módosításkor a pálya eredményei törlődnek, erre a felület mentés előtt figyelmeztet.
- **Futás közbeni élő ellenőrzés versenyhelyzete.** Egy késleltetett ellenőrzés felülírta a futásidejű hiba jelölését. Indításkor a függő ellenőrzést töröljük.

### Értelmezési döntések (ahol a leírás nem egyértelmű)
- A programfájl végén egyetlen záró sortörést elfogadunk (ez nem számít üres sornak). Minden más üres vagy csak szóközből álló sor hiba.
- A legfelső szintű sorok nem lehetnek behúzva. Az `if`, `else` és `while` törzse lehet üres, mert a nyelvtan szerint a `block = { command }`.
- A számliterálok 0–100 közöttiek lehetnek, ennél nagyobb literál szintaktikai hiba. Számítással (pl. `50 * 3`) ennél nagyobb vagy negatív érték is előállhat.
- `step forward n`: ha a következő mező fal vagy a térképen kívül esik, a robot az utolsó érvényes mezőn marad, és `E_BEDROCK_HIT` hiba keletkezik.
- A hibával vagy a lépéslimit túllépésével véget ért futtatás is bekerül a ranglistára az addig kibányászott arannyal. A felhasználó által leállított futtatás nem kerül be.
- Az ékezetes vagy más nem ASCII karakter a programban szintaktikai hiba (a nyelvtan csak az angol ábécé betűit engedi).

## Továbbfejlesztési ötletek

- Szintaxisszínezés és automatikus kiegészítés a kódszerkesztőben.
- Visszajátszás: a ranglistán egy-egy jó megoldás futása megnézhető lenne (a kódja nem, csak a robot útja).
- Versenymód: időkorlátos „napi pálya”, amelyen mindenki ugyanazzal a feladattal indul.
- Pályák értékelése, nehézségi szint, kedvencek, keresés.
- Eredmények és jelvények (pl. „Minden arany 100 lépés alatt”).
- Csapatok és csapat-ranglista; adminisztrátori felhasználókezelő felület.
- Generált (véletlen) labirintusok a térképszerkesztőben.
- A nyelv bővítése (pl. eljárások, `repeat n` ciklus) külön „haladó” módban.

## Telepítés (Ubuntu 22.04, Apache 2.4, PHP 8.3, MySQL 8.4)

```bash
# 1. A feltöltött zip kicsomagolása -> /var/www/robotszimulator
sudo apt install -y unzip   # ha még nincs fent
sudo unzip robotszimulator.zip -d /var/www/

# 2. PHP kiegészítők ellenőrzése (ha a pdo_mysql vagy a mbstring hiányzik, telepítsd)
php -m | grep -E "pdo_mysql|mbstring"
# sudo apt install -y php8.3-mysql php8.3-mbstring && sudo systemctl restart apache2

# 3. Adatbázis és felhasználó (a jelszót írd át!)
sudo mysql -e "CREATE DATABASE robotszimulator CHARACTER SET utf8mb4 COLLATE utf8mb4_hungarian_ci;
CREATE USER 'robotszimulator'@'localhost' IDENTIFIED BY 'IdeEgyErosJelszo!';
GRANT ALL PRIVILEGES ON robotszimulator.* TO 'robotszimulator'@'localhost'; FLUSH PRIVILEGES;"

# 4. A jelszó beírása a beállításokba ('password' sor)
sudo nano /var/www/robotszimulator/public/api/config.php

# 5. Táblák és bemutató adatok
cd /var/www/robotszimulator && sudo php setup/install.php

# 6. Elérhetővé tétel az Apache-ban: http://<szerver>/robot/
sudo ln -s /var/www/robotszimulator/public /var/www/html/robot
```

Teljes újratelepítés (minden adat törlődik, a bemutató adatok újra betöltődnek): `sudo php setup/install.php --reset`

Helyi próba MySQL nélkül (SQLite): `RS_DB_DRIVER=sqlite php setup/install.php && RS_DB_DRIVER=sqlite php -S localhost:8080 -t public`

## Tesztek futtatása

```bash
node tests/run-js.js     # böngészős értelmező – közös tesztesetek
php tests/run-php.php    # szerveres értelmező – ugyanazok a tesztesetek
node tests/fuzz.js 5000  # 5000 véletlen program: a két értelmező eredménye egyezik-e
```
