// 이 컴퓨터에서 버셀처럼 돌려 보기: 정적 파일 + /api/* 서버리스 함수. node tools/dev.mjs [포트]
// MONGODB_URI 가 없으면 .data/db.json (또는 DATA_FILE) 에 저장한다. 같은 와이파이의 태블릿은 http://<이 컴퓨터 IP>:포트 로 연다
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const port = Number(process.argv[2] || process.env.PORT || 3000);
const TYPES = { '.html': 'text/html; charset=utf-8' };

// 내주는 파일은 두 페이지뿐 (소스·저장소·.git 은 대소문자를 바꿔 불러도 열리지 않게 목록으로만 연다)
const PAGES = { '/': 'index.html', '/index.html': 'index.html', '/teacher.html': 'teacher.html' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const api = /^\/api\/(student|teacher)$/.exec(url.pathname);
    if (api) return await require(path.join(root, 'api', api[1] + '.js'))(req, res);
    const page = PAGES[url.pathname];
    if (!page) { res.statusCode = 404; return res.end('없음'); }
    res.setHeader('Content-Type', TYPES['.html']);
    fs.createReadStream(path.join(root, page)).pipe(res);
  } catch (e) {
    res.statusCode = 400;
    res.end();
  }
});
server.listen(port, () => console.log(`마음 극장: http://localhost:${port}/  (선생님: /teacher.html)`));
