"""Find a prime whose digits, laid out in rows, draw a QR code.

A digit with a hole (0 6 8 9) is a dark module, a digit without one (1 2 3 5 7) a light module.
usage: prime_qr.py "<tel: uri>" OUT.json
"""
import json
import random
import sys
import time

import gmpy2
import segno

URI, OUT = sys.argv[1:3]
q = segno.make(URI, error="m", boost_error=False)
M = [[bool(v) for v in row] for row in q.matrix]
n = len(M)
Q = 4
N = n + 2 * Q
dark = [[False] * N for _ in range(N)]
for r in range(n):
    for c in range(n):
        dark[r + Q][c + Q] = M[r][c]
cells = [dark[r][c] for r in range(N) for c in range(N)]
DARK, LIGHT = "0689", "12357"
rnd = random.Random(20261025)
digits = [rnd.choice(DARK if d else LIGHT) for d in cells]
digits[0] = rnd.choice("12357")          # no leading zero (the corner is quiet zone, light)
digits[-1] = rnd.choice("137")           # odd and not 5
free = [i for i in range(1, len(digits) - 1)]
t0 = time.time()
tries = 0
while True:
    tries += 1
    for i in rnd.sample(free, 3):
        digits[i] = rnd.choice(DARK if cells[i] else LIGHT)
    digits[-1] = rnd.choice("137")
    x = gmpy2.mpz("".join(digits))
    if gmpy2.is_prime(x, 30):
        break
s = "".join(digits)
assert all((c in DARK) == d for c, d in zip(s, cells))
ok = gmpy2.is_bpsw_prp(x) and all(gmpy2.is_strong_prp(x, b) for b in rnd.sample(range(2, 10 ** 6), 64))
print(f"{len(s)} digits, side {N}, tries {tries}, {time.time() - t0:.1f}s, bpsw+64 MR: {ok}")
json.dump({"uri": URI, "side": N, "digits": s, "qr": ["".join("1" if v else "0" for v in row) for row in dark]},
          open(OUT, "w"))
