#!/usr/bin/env python3
# NOTE: it is recommended to use this even if you don't understand the following code.

import sys

# uncomment the two following lines if you want to read/write from files
# sys.stdin = open('input.txt')
# sys.stdout = open('output.txt', 'w')

N = int(input().strip())

B = list(map(int, input().strip().split()))

S = list(map(int, input().strip().split()))

lehetetlen = False

Jumps = 0
posi = 0

def erosseg():
    global posi, Jumps
    for ero in range(B[i]):
        posi += ero
        Jumps += 1
for i in range(len(B)):
    erosseg()
    if B[posi]==-1:
        erosseg()
    else:
        posi += S[posi]
    if posi != N - 1:
        lehetetlen = True
if lehetetlen:
    Jumps = -1

# INSERT YOUR CODE HERE


print(Jumps)

sys.stdout.close()
