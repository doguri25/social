# 번역 틀: python3 tools/i18n.py export vi   → stories/i18n/vi/book1.json … ui.json, starters.json
#   bookN.json   { "JSON 경로": "한국어 원문" }  이야기 글
#   ui.json      data/ui.json 과 같은 모양 (화면 글자, srv: 서버 알림, note: 보라 수첩 그림 속 글씨)
#   starters.json { "번호.title|who|text": "한국어 원문" }  이후의 이야기 시작 (server/starters.json)
# 번역하는 사람은 값만 그 언어로 바꿔 넣는다(경로·열쇠·{자리}는 그대로). 고치지 않은 줄은 한국어로 나온다.
# 이미 있는 파일은 덮어쓰지 않고, 새로 생긴 글만 더한다. python3 tools/i18n.py check vi 는 빠진 줄 수를 센다.
import json, sys, glob, os

TEXT_KEYS = {'title', 'sub', 'place', 'cap', 'pre', 'text', 'say', 'shout', 'think', 'whisper', 'q', 'ask', 'reveal', 'same', 'back', 'intro', 'name', 'sfx'}  # sfx: 컷 위 효과음 글자
SKIP_UNDER = {'set', 'faces', 'poses', 'when', 'add', 'is', 'on', 'stage'}  # 무대 상태·조건 같은 이름표는 번역하지 않는다

def walk(o, path, out):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in SKIP_UNDER:
                continue
            p = f'{path}.{k}' if path else k
            if isinstance(v, str) and (k in TEXT_KEYS) and v.strip():
                out[p] = v
            else:
                walk(v, p, out)
    elif isinstance(o, list):
        for i, v in enumerate(o):
            p = f'{path}.{i}'
            # 생각 나누기 물음(talk)과 역할 목록(roles 의 하는 일·잘하는 것)은 글 목록
            if isinstance(v, str) and (path.endswith('talk') or (path.split('.')[-2:-1] == ['roles'] and i > 0)):
                out[p] = v
            else:
                walk(v, p, out)

def strings(book):
    out = {}
    walk(book, '', out)
    return out

def ui_strings():
    # 한 단계 깊이(srv, note)는 "srv\t알림" 처럼 탭으로 잇는다 (한국어 열쇠에 점이 들어 있다)
    src = json.load(open('data/ui.json'))
    out = {}
    for k, v in src.items():
        if isinstance(v, dict):
            for k2, v2 in v.items(): out[f'{k}\t{k2}'] = v2
        elif v: out[k] = v
    return out

def ui_nest(flat):
    out = {}
    for k, v in flat.items():
        if '\t' in k:
            a, b = k.split('\t', 1); out.setdefault(a, {})[b] = v
        else: out[k] = v
    return out

def starter_strings():
    out = {}
    for st in json.load(open('server/starters.json')):
        for k in ('title', 'who', 'text'): out[f"{st['id']}.{k}"] = st[k]
    return out

def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ('export', 'check'):
        print('사용법: python3 tools/i18n.py export|check <언어 코드: vi ru zh>')
        sys.exit(1)
    cmd, lang = sys.argv[1], sys.argv[2]
    jobs = [(f'stories/i18n/{lang}/{os.path.basename(f)}', strings(json.load(open(f))), False) for f in sorted(glob.glob('stories/book*.json'))]
    jobs.append((f'stories/i18n/{lang}/ui.json', ui_strings(), True))
    jobs.append((f'stories/i18n/{lang}/starters.json', starter_strings(), False))
    for dst, src, nested in jobs:
        have = json.load(open(dst)) if os.path.exists(dst) else {}
        if nested: have = {k: v for k, v in ui_strings_from(have).items()}
        if cmd == 'export':
            merged = {**src, **{k: v for k, v in have.items() if k in src}}
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            json.dump(ui_nest(merged) if nested else merged, open(dst, 'w'), ensure_ascii=False, indent=1)
            print(f'{dst}: {len(merged)}줄 ({len([k for k in src if k not in have])}줄 새로)')
        else:
            todo = sum(1 for k, v in src.items() if have.get(k, v) == v)
            print(f'{dst}: 번역 안 된 줄 {todo} / {len(src)}')

def ui_strings_from(d):
    out = {}
    for k, v in d.items():
        if isinstance(v, dict):
            for k2, v2 in v.items(): out[f'{k}\t{k2}'] = v2
        else: out[k] = v
    return out

main()
