"""Edit decision list for the flashback (shared by compose.py and mix.py). F = seconds from flashback start."""
FB_SHOTS = [
    dict(c=1, a=0.30, b=2.00, cy=520),
    dict(c=1, a=3.30, b=12.90, cy=540),
    dict(c=1, a=12.90, b=15.20, cy=540),
    dict(c=1, freeze=15.20, dur=3.2),
    dict(c=1, a=15.20, b=22.46, cy=540),
    dict(c=2, a=0.0, b=4.80, cy=600),
    dict(c=3, a=0.0, b=4.68, cy=560),
    dict(c=4, a=0.0, b=6.26, cy=540),
    # --- Rafael to the car, Yahli's message, the pursuer, the car chase
    dict(c=5, a=0.30, b=7.60, cy=560),
    dict(c=6, a=0.20, b=8.60, cy=540, push=(1000, 500, 0.10), tag='msg'),
    dict(c=7, a=0.00, b=2.90, cy=470, tag='pursuer'),
    dict(c=7, a=3.00, b=5.40, cy=540, sp=1.3, tag='chase', ex=0.8),
    dict(c=9, a=0.20, b=2.40, cy=600, sp=1.25),
    dict(c=8, a=6.10, b=7.30, cy=500),
    dict(c=9, a=2.40, b=3.90, cy=600, tag='pass'),
    dict(c=8, a=0.00, b=2.00, cy=540, sp=1.3, ex=0.85),
    dict(c=10, a=4.20, b=7.30, cy=600, sp=1.3),
    dict(c=8, a=7.50, b=8.30, cy=500),
    dict(c=10, a=7.30, b=8.70, cy=600, tag='pass'),
    dict(c=8, a=9.00, b=9.90, cy=500),
    dict(c=7, a=10.20, b=12.70, cy=540, sp=1.25, mute=True, ex=0.85),
    dict(c=9, a=4.00, b=7.60, cy=600, sp=1.2),
    dict(c=10, a=9.40, b=11.90, cy=600, fadeout=1.4),
]
_f = 0.0
for sh in FB_SHOTS:
    sh.setdefault('sp', 1.0)
    if 'dur' not in sh: sh['dur'] = (sh['b'] - sh['a']) / sh['sp']
    sh['f0'] = _f; _f += sh['dur']
FB_LEN = _f
def shot(tag):
    return next(s for s in FB_SHOTS if s.get('tag') == tag)
