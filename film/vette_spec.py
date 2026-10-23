"""Shared timeline of the Corvette ride cut (picture + sound)."""
B = 60 / 90


def bt(n):
    return round(n * B, 4)


# (out_start, out_end, kind, src_start, src_end) — src in seconds of the drive clip
EDIT = [
    (0.00, 0.62, "selfie", 0.00, 0.62),
    (0.62, 1.10, "whip", 0.62, 1.10),
    (1.10, bt(3.65), "cockpit", 0, 0),
    (bt(3.65), bt(7.15), "driver", 1.10, 3.45),
    (bt(7.15), bt(7.9), "whip", 3.45, 3.95),
    (bt(7.9), bt(8.9), "selfie", 3.95, 4.62),
    (bt(8.9), bt(9.6), "selfie", 5.08, 5.55),
    (bt(9.6), bt(10.6), "cockpit2", 0, 0),
    (bt(10.6), bt(11.25), "driver", 7.12, 7.55),
    (bt(11.25), bt(13), "wind", 8.62, 9.76),
]
T_EXT1, T_EXT2, T_END = bt(13), bt(16.5), bt(21)
END = bt(25) + 0.4

DRIVER_TAG = (bt(3.65) + 0.12, bt(7.15) - 0.05)
YONTI_TAG = (bt(7.9) + 0.05, bt(9.6) - 0.03)
VETTE_TAG = (1.25, bt(3.65) - 0.05)
