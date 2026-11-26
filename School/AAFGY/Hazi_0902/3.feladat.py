szamok = []
db = 8
for i in range(db):
    temp = int(input(f"Adj meg még {db} darab számot: "))
    db -= 1
    szamok.append(temp)
    temp = None
temp = szamok[0]
for i in range(1,len(szamok)):
    temp = temp + szamok[i]
print(f"A számok összege: {temp}")
temp = szamok[0]
for i in range(1,len(szamok)):
    temp = temp - szamok[i]
print(f"A számok különbsége: {temp}")
temp = szamok[0]
for i in range(1,len(szamok)):
    temp = temp * szamok[i]
print(f"A számok szorzata: {temp}")
temp = szamok[0]
for i in range(1,len(szamok)):
    temp = temp + szamok[i]
temp = temp / len(szamok)
print(f"A számok átlaga: {temp}")
