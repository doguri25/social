// 그림책 색 보정 (무대와 컷 카메라 마지막 단계)
// 1) 가벼운 선명도  2) 칙칙한 색만 살짝 맑게  3) 밝은 쪽은 따뜻하게, 그늘은 보랏빛으로  4) 부드러운 대비
// 5) 가장자리를 아주 조금 어둡게  6) Canvas2D 로 그린 종이 결을 아주 옅게
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform sampler2D paperSampler;
uniform vec2 uTexel;
uniform vec2 uPaperScale;
uniform float uVignette;

void main(void) {
  vec4 src = texture2D(textureSampler, vUV);
  vec3 c = src.rgb;
  vec3 n = texture2D(textureSampler, vUV + vec2(uTexel.x, 0.0)).rgb + texture2D(textureSampler, vUV - vec2(uTexel.x, 0.0)).rgb
         + texture2D(textureSampler, vUV + vec2(0.0, uTexel.y)).rgb + texture2D(textureSampler, vUV - vec2(0.0, uTexel.y)).rgb;
  c += (c - n * 0.25) * 0.4;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = mix(vec3(l), c, 1.0 + 0.22 * (1.0 - sat));
  c *= mix(vec3(0.95, 0.955, 1.04), vec3(1.03, 1.01, 0.97), smoothstep(0.2, 0.85, l));
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.16);
  vec2 q = vUV - 0.5;
  c *= 1.0 - uVignette * smoothstep(0.2, 0.9, dot(q, q) * 2.0);
  float p = texture2D(paperSampler, vUV * uPaperScale).r;
  c *= mix(0.978, 1.012, p);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), src.a);
}
