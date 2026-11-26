szamok = [32, 78, 14, 12, 48, 63, 655, 90, 6]
paratlanok = []
for i in range(len(szamok)):
    if szamok[i] % 2 == 1 :
        paratlanok.append(szamok[i])
print(f"Az első ({paratlanok[0]}) és az utolsó ({paratlanok[len(paratlanok)-1]}) páratlan szám a listában.")
for i in range(len(szamok)):
    if szamok[i] % 3 == 0 :
        print(f"Az első 3-mal osztható szám: {szamok[i]}")
        break
for i in range(len(szamok)):
    if szamok[i] > 40  and szamok[i] < 60 :
        print(f"Az első 40 és 60 közé eső szám: {szamok[i]}")
        break
for i in range(len(szamok)):
    if szamok[i] == 21 :
        print(f"A {i}. elem a 21")
    if i == len(szamok)-1:
        print("A ciklus lefutott, és nem talált 21et a listában")