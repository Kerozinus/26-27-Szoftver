#!/usr/bin/env python3
# NOTE: it is recommended to use this even if you don't understand the following code.

import sys

# uncomment the two following lines if you want to read/write from files
# sys.stdin = open('input.txt')
# sys.stdout = open('output.txt', 'w')

N, K = map(int, input().strip().split())

P = list(map(int, input().strip().split()))

D = 0


# INSERT YOUR CODE HERE

P.sort()
m = N - K
if m <= 1:
    D = 0
else:
    D = min(P[i + m - 1] - P[i] for i in range(N-m+1))

print(D)

sys.stdout.close()
