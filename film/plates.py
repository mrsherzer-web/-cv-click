"""Israeli (yellow) licence-plate detection, tracking and blurring."""
import numpy as np, cv2, json, os, subprocess, sys

W, H = 1920, 1080


def detect(rgb8, exclude=None, debug=False):
    """rgb8: HxWx3 uint8. Returns list of [x, y, w, h, score]."""
    hsv = cv2.cvtColor(rgb8, cv2.COLOR_RGB2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    luma = cv2.cvtColor(rgb8, cv2.COLOR_RGB2GRAY)
    yel = ((h >= 15) & (h <= 26) & (s >= 110) & (v >= 90)).astype(np.uint8)
    if exclude is not None: yel[exclude > 0] = 0
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 3))
    m = cv2.morphologyEx(yel, cv2.MORPH_CLOSE, k)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    out = []
    for i in range(1, n):
        x, y, w, hh, area = st[i]
        why = None
        if area < 40 or w < 16 or hh < 5: continue
        ar = w / max(hh, 1)
        if not (1.6 <= ar <= 7.5): why = 'ar'
        elif w > 1000 or hh > 260: why = 'size'
        else:
            comp = (lab[y:y + hh, x:x + w] == i)
            cnts, _ = cv2.findContours(comp.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            (cx, cy), (rw, rh), ang = cv2.minAreaRect(max(cnts, key=cv2.contourArea))
            rect = comp.sum() / max(1.0, rw * rh)
            yb = yel[y:y + hh, x:x + w] > 0
            fill = yb.mean()
            sy = s[y:y + hh, x:x + w][yb]
            ly = luma[y:y + hh, x:x + w].astype(np.float32)
            lmed = float(np.percentile(ly[yb], 75)) if yb.any() else 0
            darkl = ly < 0.74 * lmed
            inner = darkl[max(1, hh // 6): hh - max(1, hh // 6), w // 12: w - w // 12]
            dfrac = inner.mean() if inner.size else 0
            cols = inner.any(axis=0).mean() if inner.size else 0
            if rect < 0.55: why = f'rect{rect:.2f}'
            elif not (0.35 <= fill <= 0.97): why = f'fill{fill:.2f}'
            elif sy.mean() < 140: why = f'S{sy.mean():.0f}'
            elif not (0.04 <= dfrac <= 0.6): why = f'dark{dfrac:.2f}'
            elif cols < 0.25: why = f'cols{cols:.2f}'
        if debug: print('  comp', (int(x), int(y), int(w), int(hh)), 'reject' if why else 'ACCEPT', why or '')
        if why: continue
        sc = 0.6 + min(0.4, dfrac + (sy.mean() - 140) / 400)
        out.append([int(x), int(y), int(w), int(hh), round(float(sc), 2)])
    return out


def iou(a, b):
    ax0, ay0, ax1, ay1 = a[0], a[1], a[0] + a[2], a[1] + a[3]
    bx0, by0, bx1, by1 = b[0], b[1], b[0] + b[2], b[1] + b[3]
    iw = max(0, min(ax1, bx1) - max(ax0, bx0)); ih = max(0, min(ay1, by1) - max(ay0, by0))
    inter = iw * ih
    return inter / max(1e-6, a[2] * a[3] + b[2] * b[3] - inter)


def link(dets, max_gap=8, min_len=3):
    """dets: {frame: [[x,y,w,h,s],...]} -> {frame: [[x,y,w,h],...]} smoothed, gap-filled tracks"""
    frames = sorted(dets)
    tracks = []
    for f in frames:
        for d in dets[f]:
            cx, cy = d[0] + d[2] / 2, d[1] + d[3] / 2
            best, bd = None, 1e9
            for t in tracks:
                lf, lb = t['f'][-1], t['b'][-1]
                if lf == f or f - lf > max_gap: continue
                lcx, lcy = lb[0] + lb[2] / 2, lb[1] + lb[3] / 2
                dist = np.hypot(cx - lcx, cy - lcy)
                lim = max(40, 2.5 * max(lb[2], d[2])) * (1 + 0.3 * (f - lf))
                if (iou(lb, d) > 0.05 or dist < lim) and dist < bd: best, bd = t, dist
            if best is None:
                tracks.append(dict(f=[f], b=[d[:4]], s=[d[4]]))
            else:
                best['f'].append(f); best['b'].append(d[:4]); best['s'].append(d[4])
    out = {}; kept = []
    for t in tracks:
        if len(t['f']) < min_len and max(t['s']) < 0.8: continue
        kept.append(t)
        fs = np.array(t['f']); bs = np.array(t['b'], np.float32)
        full = np.arange(fs[0], fs[-1] + 1)
        ib = np.stack([np.interp(full, fs, bs[:, k]) for k in range(4)], 1)
        sm = ib.copy()
        for i in range(len(full)):
            a, b = max(0, i - 2), min(len(full), i + 3)
            sm[i] = ib[a:b].mean(0)
        # pad 2 frames each side (motion)
        for i, f in enumerate(full):
            out.setdefault(int(f), []).append([float(v) for v in sm[i]])
        t['full'] = [int(f) for f in full]; t['sm'] = sm.tolist()
        for k in (1, 2):
            out.setdefault(int(full[0] - k), []).append([float(v) for v in sm[0]])
            out.setdefault(int(full[-1] + k), []).append([float(v) for v in sm[-1]])
    link.tracks = [dict(frames=t['full'], boxes=t['sm'], score=float(max(t['s'])), raw_f=[int(x) for x in t['f']], raw_b=[[float(v) for v in bb] for bb in t['b']]) for t in kept]
    return out


def blur_boxes(img, boxes, padx=0.45, pady=0.9):
    """img: HxWx3 (uint16 or uint8). Blurs each box (with padding) using a feathered mask."""
    if not boxes: return img
    out = img.copy()
    Hh, Ww = img.shape[:2]
    for (x, y, w, h) in boxes:
        px, py = w * padx + 4, h * pady + 4
        x0, y0 = int(max(0, x - px - 0.45 * w)), int(max(0, y - py)); x1, y1 = int(min(Ww, x + w + px)), int(min(Hh, y + h + py))   # extra on the left: blue IL strip
        if x1 - x0 < 3 or y1 - y0 < 3: continue
        m = int(max(6, h))
        X0, Y0, X1, Y1 = max(0, x0 - m), max(0, y0 - m), min(Ww, x1 + m), min(Hh, y1 + m)
        reg = out[Y0:Y1, X0:X1].astype(np.float32)
        sig = max(5.0, h * 0.9, w * 0.12)
        bl = cv2.GaussianBlur(reg, (0, 0), sig)
        # pixelate a little too, so nothing can be recovered
        small = cv2.resize(bl, (max(1, (X1 - X0) // 10), max(1, (Y1 - Y0) // 10)), interpolation=cv2.INTER_AREA)
        bl = cv2.resize(small, (X1 - X0, Y1 - Y0), interpolation=cv2.INTER_LINEAR)
        bl = cv2.GaussianBlur(bl, (0, 0), max(2.0, sig * 0.3))
        mask = np.zeros((Y1 - Y0, X1 - X0), np.float32)
        cv2.rectangle(mask, (x0 - X0, y0 - Y0), (x1 - X0 - 1, y1 - Y0 - 1), 1.0, -1)
        mask = cv2.GaussianBlur(mask, (0, 0), max(1.5, h * 0.15))
        mask = np.clip(mask * 1.6, 0, 1)[..., None]
        reg = reg * (1 - mask) + bl * mask
        out[Y0:Y1, X0:X1] = reg.astype(img.dtype)
    return out


def detect_relaxed(rgb8, roi):
    """plate candidates inside a car box (looser colour/shape rules)."""
    x0, y0, x1, y1 = roi
    sub = np.ascontiguousarray(rgb8[y0:y1, x0:x1])
    if sub.shape[0] < 8 or sub.shape[1] < 12: return []
    hsv = cv2.cvtColor(sub, cv2.COLOR_RGB2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    luma = cv2.cvtColor(sub, cv2.COLOR_RGB2GRAY)
    yel = ((h >= 12) & (h <= 28) & (s >= 80) & (v >= 70)).astype(np.uint8)
    m = cv2.morphologyEx(yel, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 3)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    out = []
    for i in range(1, n):
        x, y, w, hh, area = st[i]
        if area < 20 or w < 10 or hh < 3: continue
        if not (1.3 <= w / max(hh, 1) <= 8.5): continue
        if w > 0.9 * sub.shape[1]: continue
        comp = (lab[y:y + hh, x:x + w] == i)
        cnts, _ = cv2.findContours(comp.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        (cx, cy), (rw, rh), ang = cv2.minAreaRect(max(cnts, key=cv2.contourArea))
        if comp.sum() / max(1.0, rw * rh) < 0.45: continue
        yb = yel[y:y + hh, x:x + w] > 0
        if not (0.3 <= yb.mean() <= 0.99): continue
        if s[y:y + hh, x:x + w][yb].mean() < 130: continue
        if w >= 40:
            ly = luma[y:y + hh, x:x + w].astype(np.float32)
            lmed = float(np.percentile(ly[yb], 75))
            inner = (ly < 0.78 * lmed)[max(1, hh // 6): hh - max(1, hh // 6), w // 12: w - w // 12]
            if inner.size and not (0.02 <= inner.mean() <= 0.65): continue
        out.append([int(x + x0), int(y + y0), int(w), int(hh), 0.75])
    return out


def detect_all(rgb8, car_boxes, exclude=None):
    out = detect(rgb8, exclude)
    for (x, y, w, h, sc) in car_boxes:
        if w * h > 0.6 * rgb8.shape[0] * rgb8.shape[1]: continue
        roi = (int(max(0, x - 0.05 * w)), int(max(0, y + 0.15 * h)), int(min(rgb8.shape[1], x + 1.05 * w)), int(min(rgb8.shape[0], y + 1.08 * h)))
        for d in detect_relaxed(rgb8, roi):
            if exclude is not None and exclude[min(1079, d[1] + d[3] // 2), min(1919, d[0] + d[2] // 2)]: continue
            if not any(iou(d, o) > 0.2 for o in out): out.append(d)
    return out
