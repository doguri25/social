// 인물 재질 (Babylon StandardMaterial 끝에 끼워 넣는 조각: CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR)
// 빛과 그늘의 경계를 부드러운 두 단계로 또렷하게, 그늘은 살짝 보랏빛, 밝은 쪽 가장자리에 따뜻한 빛.
// 게임의 색과 가장자리 빛(emissive)은 그대로 두고 60% 만 섞는다 (모습이 바뀌지 않게)
#ifdef FXTOON
{
  vec3 fxAlb = diffuseColor * baseColor.rgb;
  float fxL = dot(diffuseBase, vec3(0.3333));
  float fxBand = smoothstep(0.32, 0.58, fxL);
  vec3 fxTone = mix(fxAlb * vec3(0.8, 0.76, 0.87), fxAlb * vec3(1.04, 1.01, 0.97), fxBand);
  vec3 fxGlow = max(color.rgb - fxAlb * diffuseBase, vec3(0.0));
  float fxRim = pow(1.0 - clamp(dot(normalize(normalW), viewDirectionW), 0.0, 1.0), 3.0);
  color.rgb = mix(color.rgb, fxTone + fxGlow, 0.6) + fxRim * fxBand * 0.1 * vec3(1.0, 0.95, 0.86);
}
#endif
