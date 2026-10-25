"""Voxel sculpture whose two orthogonal shadows are a tel: QR code and the phone number.

Object O(x,y,z) = QR(x,y) AND NUM(y,z). Its shadow along z is the QR (every row of NUM is
covered by a rule line), its shadow along x is NUM (every QR row has a dark module).
"""
import numpy as np
import segno

FONT5x7 = {
    "0": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
}


def qr_matrix(uri):
    q = segno.make(uri, error="m")
    return np.array([[1 if v else 0 for v in row] for row in q.matrix], np.uint8)


def number_image(groups, n):
    """groups like ["123", "456", "7890"] -> n x n bitmap, ticks fill every blank row."""
    img = np.zeros((n, n), np.uint8)
    rows_needed = len(groups) * 7 + (len(groups) + 1)
    assert rows_needed <= n, rows_needed
    top = (n - rows_needed) // 2
    r = top
    for g in groups:
        w = len(g) * 6 - 1
        assert w <= n, g
        c0 = (n - w) // 2
        for k, ch in enumerate(g):
            for rr, line in enumerate(FONT5x7[ch]):
                for cc, bit in enumerate(line):
                    if bit == "1":
                        img[r + 1 + rr, c0 + k * 6 + cc] = 1
        r += 8
    for rr in range(n):  # blank rows still need one voxel each, or the QR shadow loses that row
        if img[rr].sum() == 0:
            img[rr, 0] = img[rr, n - 1] = 1
    return img


def build(uri, groups):
    B = qr_matrix(uri)  # B[r, c]: QR row r, column c
    n = B.shape[0]
    A = number_image(groups, n)  # A[r, c]: number row r, reading column c
    # voxel grid V[ix, iy, iz]; QR (r, c) -> ix=c, iy=n-1-r ; NUM (r, c) -> iy=n-1-r, iz=n-1-c
    Bxy = B[::-1, :].T  # [ix, iy]
    Ayz = A[::-1, ::-1]  # [iy, iz]
    V = Bxy[:, :, None] & Ayz[None, :, :]
    return V.astype(bool), B, A


def shadows(V):
    front = V.any(axis=2)  # [ix, iy] -> image rows r = n-1-iy, cols c = ix
    side = V.any(axis=0)  # [iy, iz] -> image rows r = n-1-iy, cols c = n-1-iz
    return front.T[::-1, :], side[::-1, ::-1]


if __name__ == "__main__":
    import sys

    import cv2
    V, B, A = build(sys.argv[1], sys.argv[2].split(","))
    f, s = shadows(V)
    print("voxels", int(V.sum()), "front==QR", bool((f == B).all()), "side==NUM", bool((s == A).all()))
    big = np.kron(1 - f.astype(np.uint8), np.ones((20, 20), np.uint8)) * 255
    big = np.pad(big, 80, constant_values=255)
    print("front shadow decodes:", repr(cv2.QRCodeDetector().detectAndDecode(cv2.cvtColor(big, cv2.COLOR_GRAY2BGR))[0]))
    cv2.imwrite(sys.argv[3] + "/shadow_front.png", big)
    cv2.imwrite(sys.argv[3] + "/shadow_side.png", np.pad(np.kron(1 - s.astype(np.uint8), np.ones((20, 20), np.uint8)) * 255,
                                                         40, constant_values=255))
