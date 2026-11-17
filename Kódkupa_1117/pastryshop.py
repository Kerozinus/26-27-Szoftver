#!/usr/bin/env python3
# NOTE: it is recommended to use this even if you don't understand the following code.

import sys

# uncomment the two following lines if you want to read/write from files
# sys.stdin = open('input.txt')
# sys.stdout = open('output.txt', 'w')

N, K = map(int, input().strip().split())

P = list(map(int, input().strip().split()))

M = N - K

best = P[M -1] - P[0]
for i in range(1, N-M + 1):
    D = P[i + M - 1] - P[i]
    if D < best:
        best = D

# INSERT YOUR CODE HERE

print(best)

sys.stdout.close()
