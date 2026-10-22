"""Ambience and foley for the escape -> parking -> hideout stretch (IMG_9022..9026).
Times are flashback-relative (F seconds), taken from edl so they follow the cut."""
import numpy as np, os
import edl
from carsfx import (SR, db, fade, place, pan, lp, hp, bp, peak_eq, loop_to, lib, onset, env_limit, clipgain,
                    room_tone, heartbeat, door_thump, cloth, rng)


def F(tag, src, seg=0):
    """F time of source time src in the shot with this tag (or the seg-th shot after it, same clip)"""
    i = next(k for k, s in enumerate(edl.FB_SHOTS) if s.get('tag') == tag) + seg
    sh = edl.FB_SHOTS[i]
    return sh['f0'] + (src - sh['a']) / sh['sp']


G = dict(amb=-1.0, amb_patio=-7.0, engine=-14.0, eng_off=-20.0, latch=-8.0, creak=-18.0, step=-6.0, thump=-10.0,
         slam_latch=-6.0, room=-14.0, heart=-9.0, cloth=-18.0)


def build(F0=78.3):
    F1 = edl.FB_LEN
    n = int((F1 - F0) * SR); fx = np.zeros((n, 2), np.float32)
    def put(x, f, g, p=0.0):
        if x.ndim == 1: x = pan(x, p)
        place(fx, x * db(g), f - F0)
    park, stairs, inside = edl.shot('park')['f0'], edl.shot('stairs')['f0'], edl.shot('inside')['f0']
    talk1 = edl.shot('talk1')['f0']

    # outdoor bed (birds tamed like the walk to the car) for the parking lot and the yard
    bed = lib('amb/amb_ext.wav', mono=False)
    lo = lp(bed, 1200, 4); bed = lo + env_limit(bed - lo, -36.0)
    ext = loop_to(np.roll(bed, -int(4.0 * SR), 0), int((inside - park + 0.3) * SR), 0.6)
    put(fade(ext, 0.4, 0.15), park, G['amb'])
    pat = loop_to(np.roll(bed, -int(8.5 * SR), 0), int((F1 - talk1) * SR), 0.6)
    put(fade(pat, 0.3, 1.5), talk1, G['amb_patio'])

    # the car rolls in and stops; engine off
    t_in, t_stop = F('park', 1.9), F('park', 3.6)
    oc = lib('engine/car_approach_alt_steady.wav')[int(1.0 * SR):]
    oc = hp(lp(oc[: int((t_stop - t_in + 0.6) * SR)], 3500), 50)
    e = np.clip(np.arange(len(oc)) / SR / 0.8, 0, 1)
    put(fade(oc * e, 0.05, 0.45), t_in - 0.3, G['engine'], 0.4)
    idl = loop_to(hp(lp(lib('engine/idle_loop.wav'), 1600), 50), int(0.9 * SR), 0.2)
    put(fade(idl, 0.2, 0.35), t_stop - 0.1, G['engine'] - 3, 0.2)
    put(lib('foley/click_06.wav'), t_stop + 0.55, G['eng_off'], 0.2)                      # key off
    # door open, getting out, door shut (on top of the real sync events)
    t_open = F('park', 6.26, 1) if 6.26 < 6.3 else F('park', 6.26, 2)
    put(lib('foley/latch_thunk_02.wav'), t_open - 0.01, G['latch'], 0.1)
    put(lib('foley/creak_01.wav'), t_open + 0.08, G['creak'], 0.1)
    for src, k in ((7.38, 3), (8.04, 2)):
        put(peak_eq(lib(f'footsteps/step_{k:02d}.wav'), 2100, 4.0, 0.7), F('park', src, 2) - 0.015, G['step'], 0.1)
    put(cloth(0.6), F('park', 7.2, 2), G['cloth'], 0.1)
    t_shut = F('park', 9.52, 2)
    put(door_thump(), t_shut, G['thump'], 0.1)
    lt = lib('foley/latch_thunk_03.wav'); put(lt[onset(lt):], t_shut + 0.004, G['slam_latch'], 0.1)

    # inside: still room, his heartbeat from the moment he sees the hooded figure until he walks out
    rt = fade(room_tone(talk1 - inside + 0.2), 0.05, 0.3)
    put(rt, inside, G['room'])
    t_rev, t_out = F('inside', 3.1), F('inside', 8.3)
    beats = [0.0]
    while beats[-1] < t_out - t_rev - 0.6: beats.append(beats[-1] + max(0.58, 0.78 - 0.02 * len(beats)))
    hb = heartbeat(beats)
    tt = np.arange(len(hb)) / SR
    env = np.clip(tt / 0.4, 0, 1) * np.clip((t_out - t_rev - tt) / 0.8, 0, 1)
    put(hb * env, t_rev, G['heart'])
    return fx, F0
