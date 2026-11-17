W = int(input())
S = int(input())
D = int(input())

maradek = max(0,7 - (W-S) // D)

utak = (maradek + (W//D) - 1) // (W//D)

print(1+2*utak)