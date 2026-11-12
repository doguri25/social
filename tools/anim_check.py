#!/usr/bin/env python3
"""컷 애니메이션 동작 파일(stories/anim/<책>.json) 확인: 자리(장면·컷 번호), 인물, 자세, 표정, 동작 이름이 맞는지.
쓰는 법: python3 tools/anim_check.py [book2 ...]   (안 적으면 모든 책)"""
import json, sys, os, glob
MOVES = ["still", "angry", "away", "balance", "blame", "bow", "brace", "breath", "calm", "cheer", "clap", "cry", "dance", "dodge", "eat", "fidget", "fist", "greet", "jolt", "joy", "laugh", "look", "nod", "pat", "poke", "pump", "ready", "run", "sad", "scratch", "shake", "shout", "shy", "sigh", "spin", "squeeze", "surprised", "sway", "toe", "trip", "tumble", "walk", "wash", "wave", "windup", "worried", "write", "yawn"]
POSES = ["call", "clasp", "cover", "cross", "dance", "dodge", "down", "hold", "jump", "open", "phone", "point", "reach", "show", "sit", "sitlow", "stand", "throw", "tug", "walk", "wave"]
FACES = ["calm", "joy", "laugh", "sad", "angry", "worried", "surprised", "shy", "hurt", "yawn", "cry"]
OPTS = {"cheer", "cam", "path", "from", "run", "hit", "hitLight", "ball", "ballFrom", "enter"}
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
books = sys.argv[1:] or [os.path.basename(f)[:-5] for f in sorted(glob.glob(root + "/stories/anim/*.json"))]
bad = 0
def err(*a):
    global bad; bad += 1; print("  잘못:", *a)
for bk in books:
    A = json.load(open(f"{root}/stories/anim/{bk}.json")); B = json.load(open(f"{root}/stories/{bk}.json"))
    ids = {c["id"] for c in B["cast"]}; n = 0
    for key, d in A.items():
        if key.startswith("end:"):
            e = next((e for e in B["endings"] if e["id"] == key[4:]), None); ps = e and e["panels"]
        else: ps = B["scenes"].get(key, {}).get("panels")
        if ps is None: err(bk, key, "없는 장면"); continue
        for i, v in d.items():
            n += 1
            if int(i) >= len(ps) or "shot" not in ps[int(i)]: err(bk, key, i, "그림 컷이 아님"); continue
            for k, val in v.items():
                if k in OPTS:
                    if k in ("path", "from") and not set(val) <= ids: err(bk, key, i, k, "없는 인물")
                    if k == "hit" and val not in ids: err(bk, key, i, "hit 없는 인물")
                    continue
                if k not in ids: err(bk, key, i, "없는 인물/옵션", k); continue
                last = 0
                for row in val:
                    t, pose, face, mv = (list(row) + [None] * 4)[:4]
                    if t != "end":
                        if not (isinstance(t, (int, float)) and 0 < t <= 0.8): err(bk, key, i, k, "때는 0~0.8", t)
                        elif t < last: err(bk, key, i, k, "때가 거꾸로")
                        else: last = t
                        if pose and pose not in POSES: err(bk, key, i, k, "없는 자세", pose)
                        if face and face not in FACES: err(bk, key, i, k, "없는 표정", face)
                    if mv and mv not in MOVES: err(bk, key, i, k, "없는 동작", mv)
    print(f"{bk}: 컷 {n}개")
sys.exit(1 if bad else 0)
