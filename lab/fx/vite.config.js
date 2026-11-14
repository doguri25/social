// 화질 올리기 목업: 게임은 그대로(build.sh 가 만든 dist/artifact.html), 그 위에 GLSL 셰이더 + Canvas2D 코드(src/fx.js)를 얹는다.
// fx.js 는 게임과 같은 모듈 안에 들어가야 게임의 scene·인물·카메라를 쓸 수 있어서, 게임 스크립트 끝에 이어 붙인다.
// 빌드 결과(dist)는 저장소에 함께 올린다: Vercel 미리보기가 빌드 없이 /lab/fx/dist/ 로 바로 연다
import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

function game() {
  return {
    name: 'maum-game',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        execSync('sh build.sh', { cwd: ROOT, stdio: 'ignore' });
        let page = fs.readFileSync(path.join(ROOT, 'dist/artifact.html'), 'utf8');
        const dir = path.join(HERE, 'src/glsl');
        const glsl = Object.fromEntries(fs.readdirSync(dir).map(f => [f.replace(/\..*$/, ''), fs.readFileSync(path.join(dir, f), 'utf8')]));
        const fx = `\n// ---- lab/fx (목업) ----\nconst GLSL = ${JSON.stringify(glsl)};\n` + fs.readFileSync(path.join(HERE, 'src/fx.js'), 'utf8');
        const at = page.lastIndexOf('</script>');
        page = page.slice(0, at) + fx + '\n' + page.slice(at);
        return html.replace('<!--GAME-->', page);
      },
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [game()],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2020', chunkSizeWarningLimit: 4000, assetsInlineLimit: 0 },
});
