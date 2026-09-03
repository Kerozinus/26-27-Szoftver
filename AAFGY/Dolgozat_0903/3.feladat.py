szamok = []
db = 5
for i in range(db):
    temp = int(input(f"Adj meg még {db} számot: "))
    szamok.append(temp)
    temp = None
    db -= 1
temp = szamok[0]
for i in range(1,len(szamok)):
    temp = temp + szamok[i]
print(f"A megadott számok összege: {temp}")
temp = szamok[0]
for i in range(1,len(szamok)):
    temp = temp - szamok[i]
print(f"A megadott számok különbsége: {temp}")
temp = szamok[0]
for i in range(1,len(szamok)):
    temp = temp * szamok[i]
print(f"A megadott számok szorzata: {temp}")
temp = szamok[0]
for i in range(1,len(szamok)):
    temp = temp * szamok[i]
temp = temp / len(szamok)
print(f"A megadott számok szorzata: {temp}")