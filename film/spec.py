"""Shared timeline for the film: beat grid, shots, texts, audio cues."""
BPM = 90
B = 60 / BPM          # one beat = 0.6667 s
O = 0.2               # time of beat 0


INSERT = (15, 18.5)  # one extra beat at each: the couch and train shots play slower so their text reads


def bt(n):
    return round(O + (n + sum(1 for i in INSERT if n >= i)) * B, 4)


FPS = 30
W, H = 1080, 1920
END = bt(100) + 0.5  # ~67.4 s

# ---------------------------------------------------------------- shots
# kind / time window (seconds) / params. "seg" lists (src_start, src_end) pieces
# that are stretched evenly over the shot duration (piecewise speed ramp).
SHOTS = [
    dict(id="intro", kind="intro", t0=0.0, t1=bt(6)),
    dict(id="title", kind="title", t0=bt(6), t1=bt(11)),
    dict(id="couch", kind="clip", src="c3360", t0=bt(11), t1=bt(15),
         seg=[(0.00, 0.90, 1.15), (0.90, 2.15, 0.50), (2.15, 3.02, 1.02)], fps=29.97),
    dict(id="train", kind="clip", src="c5875", t0=bt(15), t1=bt(18.5), seg=[(0.08, 2.50, 2.333)], fps=29.8),
    dict(id="dog", kind="dog", src="gem", t0=bt(18.5), t1=bt(46.5), seg=[(0.95, 19.62, 18.667)], fps=24),
    dict(id="rain", kind="clip", src="c9eac", t0=bt(46.5), t1=bt(48.5), seg=[(8.40, 9.70, 1.333)], fps=30,
         zoom=(1.75, 0.62, 0.30)),
    dict(id="selfie", kind="clip", src="c9eac", t0=bt(48.5), t1=bt(49.5), seg=[(0.00, 0.66, 0.667)], fps=30,
         zoom=(1.22, 0.52, 0.36)),
    dict(id="whip", kind="clip", src="c9eac", t0=bt(49.5), t1=bt(50), seg=[(0.66, 1.00, 0.333)], fps=30,
         whip=True),
    dict(id="vette1", kind="vette", img="004481", t0=bt(50), t1=bt(51.5)),
    dict(id="vette2", kind="vette", img="004504", t0=bt(51.5), t1=bt(52.5)),
    dict(id="vette3", kind="vette", img="004475", t0=bt(52.5), t1=bt(54)),
    dict(id="driver", kind="clip", src="c9eac", t0=bt(54), t1=bt(58), seg=[(1.00, 3.50, 2.667)], fps=30,
         hud=True),
    dict(id="vette4", kind="vette", img="004481b", t0=bt(58), t1=bt(60)),
    dict(id="black1", kind="black", t0=bt(60), t1=bt(61)),
    dict(id="field", kind="clip", src="c1138", t0=bt(61), t1=bt(65.5), seg=[(0.30, 3.30, 3.0)], fps=30,
         expo=1.35),
    dict(id="bar", kind="clip", src="bar", t0=bt(65.5), t1=bt(72), seg=[(0.37, 4.70, 4.333)], fps=30),
    dict(id="black2", kind="black", t0=bt(72), t1=bt(73)),
    dict(id="dream", kind="dream", t0=bt(73), t1=bt(77)),
    dict(id="real", kind="real", t0=bt(77), t1=bt(83)),
    dict(id="beret", kind="beret", t0=bt(83), t1=bt(92)),
    dict(id="ending", kind="ending", t0=bt(92), t1=END),
]

# ---------------------------------------------------------------- texts (Hebrew, RTL)
INTRO_LINES = [("כל סיפור טוב", 0.6), ("מתחיל בחבר'ה הנכונים.", 1.75)]
TITLE = "הדרך"
TITLE_SUB = "סרט על חברים"
TITLE_YEARS = "2023 — 2026"

CHAPTERS = {  # shot id -> (date line, sentence)
    "couch": ("קיץ 2023", "ספה אחת, טלוויזיה אחת, וכל החבר'ה."),
    "train": ("ספטמבר 2023", "עוד לא ידענו לאן הדרך תיקח אותנו."),
    "rain": ("דצמבר 2025", "גשם בחוץ..."),
    "field": ("פברואר 2026", "לילות בשטח. גם כשקשה — מחייכים."),
    "bar": ("אוקטובר 2026", "ובין לבין, רגע של שקט."),
}
DOG_LINE = "ורגע — גם לכלב יש מה להגיד."
VETTE4_LINE = "ובפנים — V8."
DRIVER_TAG = ("CHEVROLET CORVETTE 2010", "מנוע V8 · 6.2 ליטר")
DREAM_LINE = "תמיד חלמנו בגדול..."
REAL_LINE = "...ואז זה נהיה אמיתי."
BERET_LINE = "הכומתה."
BERET_SUB = "כל הדרך הזאת — בשביל הרגע הזה."
ENDING_LINE = "הדרך רק מתחילה."

# ---------------------------------------------------------------- audio cues
HITS = {  # time -> strength (impacts / flashes in picture and sound)
    bt(6): 0.5, bt(50): 1.0, bt(51.5): 0.35, bt(52.5): 0.6, bt(54): 0.35, bt(58): 0.55,
    bt(83): 1.0,
}
SHUTTERS = [bt(77), bt(79), bt(81)]
