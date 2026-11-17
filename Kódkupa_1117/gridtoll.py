T = int(input())
szamok = []
eredmenyek = []

for i in range(T):
    be = input()
    szamok = be.split(" ")
    N = int(szamok[0])
    M = int(szamok[1])
    K = int(szamok[2])

    koltseg = N * M - 1
    
    if koltseg == K:
        eredmenyek.append("yes")
    else:
        eredmenyek.append("no")
for c in eredmenyek:
    print(c)