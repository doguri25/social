# JSON 을 사람이 읽기 좋게 다시 쓴다: 숫자·글자만 든 배열과 짧은 객체는 한 줄로. python3 tools/compact.py data/defs.json stories/*.json
import json, sys
def dump(o, ind=0, width=150):
    one = json.dumps(o, ensure_ascii=False, separators=(', ', ': '))
    pad = '  ' * ind
    if len(one) + len(pad) <= width or not isinstance(o, (dict, list)) or (isinstance(o, list) and all(not isinstance(x, (dict, list)) for x in o)):
        return one
    if isinstance(o, list):
        return '[\n' + ',\n'.join(pad + '  ' + dump(x, ind + 1) for x in o) + '\n' + pad + ']'
    return '{\n' + ',\n'.join(pad + '  ' + json.dumps(k, ensure_ascii=False) + ': ' + dump(v, ind + 1) for k, v in o.items()) + '\n' + pad + '}'
for p in sys.argv[1:]:
    out = dump(json.load(open(p))) + '\n' # 다 만든 뒤에 쓴다 (도중에 멈춰도 파일이 비지 않게)
    open(p, 'w').write(out)
