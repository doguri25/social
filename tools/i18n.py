# 이야기 번역 틀: python3 tools/i18n.py export vi   → stories/i18n/vi/book1.json … ({ "JSON 경로": "한국어 원문" })
# 번역하는 사람은 값만 그 언어로 바꿔 넣는다(경로는 그대로). 고치지 않은 줄은 한국어로 나온다.
# 이미 있는 파일은 덮어쓰지 않고, 새로 생긴 글만 더한다. python3 tools/i18n.py check vi 는 빠진 줄 수를 센다.
import json, sys, glob, os

TEXT_KEYS = {'title', 'sub', 'place', 'cap', 'pre', 'text', 'say', 'shout', 'think', 'whisper', 'q', 'ask', 'reveal', 'same', 'back', 'intro', 'name'}
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

def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ('export', 'check'):
        print('사용법: python3 tools/i18n.py export|check <언어 코드: vi ru zh>')
        sys.exit(1)
    cmd, lang = sys.argv[1], sys.argv[2]
    for f in sorted(glob.glob('stories/book*.json')):
        book = json.load(open(f))
        src = strings(book)
        dst = f'stories/i18n/{lang}/{os.path.basename(f)}'
        have = json.load(open(dst)) if os.path.exists(dst) else {}
        if cmd == 'export':
            merged = {**src, **{k: v for k, v in have.items() if k in src}}
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            json.dump(merged, open(dst, 'w'), ensure_ascii=False, indent=1)
            print(f'{dst}: {len(merged)}줄 ({len(src) - len(have)}줄 새로)')
        else:
            todo = sum(1 for k, v in src.items() if have.get(k, v) == v)
            print(f'{dst}: 번역 안 된 줄 {todo} / {len(src)}')

main()
