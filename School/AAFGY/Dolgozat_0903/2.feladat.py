szamok = [32, 75, 14, 9, 48, 63, 21, 90, 6]
paratlanok = []
for i in range(len(szamok)):
    if szamok[i] % 2 == 1:
        paratlanok.append(szamok[i])
print(f"Az első ({paratlanok[0]}) és az utolsó ({paratlanok[len(paratlanok)-1]}) páratlan szám a listában.")
for i in range(len(szamok)):
    if szamok[i] % 3 == 0:
        print(f"Az első 3-mal osztható szám a listában: {szamok[i]}.")
        break
for i in range(len(szamok)):
    if szamok[i] > 40 and szamok[i] < 60:
        print(f"Az első 40 és 60 közé eső szám listában: {szamok[i]}.")
        break
for i in range(len(szamok)):
    if int(szamok[i]) == 21:
        print(f"A {i+1}. elem a 21.")