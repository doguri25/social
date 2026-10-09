#!/bin/sh
# src/ 의 조각 파일을 순서대로 이어 붙여 두 파일을 만든다.
#   index.html          브라우저에서 바로 열 수 있는 완성 파일 (GitHub Pages 용)
#   dist/artifact.html  Claude 아티팩트에 게시하는 본문 조각 (doctype, html, body 없음)
# 모든 js 조각은 하나의 모듈 스크립트 안에 이어지므로 순서를 바꾸면 안 된다.
# @defs 자리에는 data/defs.json, @stories 자리에는 stories/*.json,
# @models 자리에는 MODEL_LIST 에 든 3D 모델(Kenney CC0)과 집 색 지도가 base64 로 들어간다.
set -e
cd "$(dirname "$0")"
mkdir -p dist

# pack <조각 파일> <조각들...>
pack() {
  out=$1
  shift
  : > "$out"
  for p in "$@"; do
    case "$p" in
      @defs) { printf 'const DEFS = '; cat data/defs.json; printf ';\n'; } >> "$out" ;;
      @stories)
        printf 'const STORIES = {\n' >> "$out"
        for f in stories/*.json; do
          { printf '"%s": ' "$(basename "$f" .json)"; cat "$f"; printf ',\n'; } >> "$out"
        done
        printf '};\n' >> "$out" ;;
      @models)
        printf 'const MODELS = {\n' >> "$out"
        for m in $MODEL_LIST; do
          { printf '"%s": "' "$m"; openssl base64 -A -in "assets/models/$m.glb"; printf '",\n'; } >> "$out"
        done
        { printf '};\nconst COLORMAP = "data:image/png;base64,'; openssl base64 -A -in assets/models/colormap.png; printf '";\n'; } >> "$out" ;;
      *) cat "src/$p" >> "$out" ;;
    esac
  done
  printf '</script>\n' >> "$out"
}
# page <조각 파일> <완성 파일>
page() {
  {
    printf '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n'
    cat "$1"
    printf '</body>\n</html>\n'
  } > "$2"
}
# 문법 확인 (node 가 있을 때만)
check() {
  command -v node >/dev/null 2>&1 || return 0
  awk '/^<script type="module">$/ { on = 1; next } /^<\/script>$/ { on = 0 } on' "$1" > dist/check.mjs
  node --check dist/check.mjs && echo "문법 확인 통과: $1"
  rm -f dist/check.mjs
}

MODEL_LIST=$(for f in assets/models/*.glb; do basename "$f" .glb; done)
pack dist/artifact.html head.html @defs @stories @models js_base.js js_face.js js_map.js js_world.js js_char.js js_stage.js js_shot.js js_panel.js js_sheet.js js_story.js js_ui.js
page dist/artifact.html index.html
check dist/artifact.html

wc -c index.html dist/artifact.html
