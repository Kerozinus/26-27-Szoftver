-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Gép: 127.0.0.1
-- Létrehozás ideje: 2026. Sze 10. 19:08
-- Kiszolgáló verziója: 10.4.32-MariaDB
-- PHP verzió: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Adatbázis: `hazifeladat_0911`
--

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `szo1_csoport`
--

CREATE TABLE `szo1_csoport` (
  `ID` int(11) NOT NULL,
  `Name` text NOT NULL,
  `Height` float NOT NULL,
  `Hair_color` text NOT NULL,
  `Eye_color` text NOT NULL,
  `Most_liked_subject` text NOT NULL,
  `Least_liked_subject` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_hungarian_ci;

--
-- A tábla adatainak kiíratása `szo1_csoport`
--

INSERT INTO `szo1_csoport` (`ID`, `Name`, `Height`, `Hair_color`, `Eye_color`, `Most_liked_subject`, `Least_liked_subject`) VALUES
(2, 'Ignáth Benjámin', 174, 'Barna', 'Barna', 'Programozás', 'Történelem'),
(3, 'Kövesfalvi Dominik', 170, 'Sötét barna/melír', 'Barna', 'Informatika', 'Matematika'),
(4, 'Lukács Levente Péter', 173, 'Barna', 'Barna', 'Informatika', 'Kémia'),
(5, 'Ruskó Regina', 168, 'Fekete', 'Barna', 'Informatika', 'Angol'),
(6, 'Sárosi Soma', 170, 'Barna', 'Barna', 'Matematika', 'Történelem'),
(7, 'Szabó Zsolt Kristóf', 180, 'Barna', 'Kék', 'Testnevelés', 'Fizika'),
(8, 'Kovács Roxána', 172, 'Barna', 'Barna', 'Angol', 'Matematika'),
(9, 'Ródé Lilien Hanna', 167, 'Barna', 'Szürke', 'Fizika', 'Magyar'),
(10, 'Karsai Réka Teodóra', 169, 'Vörös', 'kék', 'Fizika', 'Informatika');

--
-- Indexek a kiírt táblákhoz
--

--
-- A tábla indexei `szo1_csoport`
--
ALTER TABLE `szo1_csoport`
  ADD PRIMARY KEY (`ID`);

--
-- A kiírt táblák AUTO_INCREMENT értéke
--

--
-- AUTO_INCREMENT a táblához `szo1_csoport`
--
ALTER TABLE `szo1_csoport`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
