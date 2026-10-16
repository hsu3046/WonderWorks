# Golden Temple 복사 및 Wonderworks 개선 제안

TL;DR: 원본을 별도 프로젝트로 그대로 복사했다. 사실감의 핵심은 외부 모델·사진 텍스처가 아니라, 상세한 절차적 형상 + 색/거칠기/법선을 함께 바꾸는 재질 + 장면 기반 조명 + 오프라인 다중 샘플 렌더링이다. 기존 작품에는 Stillwater → Through the Seasons → Bloom 순으로 선택 적용하는 것이 적합하다.

조사일: 2026-10-16. 조사·제안 문서 © 2026 AIB Inc. (https://www.aib.vote), GPL-3.0-only. 가져온 원본은 Leon Lin의 MIT 라이선스 유지.

## 복사 범위와 근거

- 원본: https://github.com/Leonxlnx/golden-temple
- 고정 커밋: `97fd9ec35ee5c0f02769addb4e35cb5e22f951dd`
- 위치: `projects/golden-temple/`. 121개 파일, 5,088,762바이트. 소스·도구·문서·참고 스틸 포함.
- 모든 파일의 SHA-256을 `source-manifest.json`에 기록했고 원본 복사 직후 재대조 통과. JS/MJS 99개 `node --check` 통과.
- 원본 package.json, lockfile, 저작권·LICENSE·CREDITS를 변경하지 않았다. 기존 외부 프로젝트를 보존한 것이므로 새 AIB 패키지 식별자로 바꾸지 않았다.
- 조사 근거: README, docs/ARCHITECTURE.md, 실제 JS/GLSL, 저장소에 실린 최종 영상의 contact sheet. 로컬 브라우저 실행은 환경광 캡처 단계까지 확인했으나 이후 브라우저 제어 타임아웃으로 최종 화면·FPS·영상 재생은 확인하지 못했다.
- 의존성 설치는 사용자 승인 후 `npm ci` 완료(42 packages, audit 취약점 0건). 기존 Three.js 0.186.0과 원본 0.186.1이 달라 기존 node_modules를 대신 연결하지 않았다.

## 사실적인 모델링은 어떻게 만들었나

**건축:** 지붕 곡선 위에 기와와 끝 장식, 서까래, 공포, 금속 테두리 등을 별도 형상으로 생성한다. `hall-roof.js`, `hall-lib.js`, `hall-orn.js`는 단면을 경로를 따라 밀어내는 sweep, 회전체 lathe, 압출, 곡선 기반 부재를 사용한다. 표면에 사진을 붙이는 방식만으로는 얻기 어려운 실루엣·겹침·작은 그림자가 생긴다. 반복 요소는 인스턴싱하고 정적 형상은 재질별로 합친다.

**불상·유기적 조형:** `interior-shapes.js`, `interior-sdf.js`에서 수학적 거리장(SDF)을 정의하고 narrow-band surface nets로 실제 메시를 만든다. Newton projection과 법선 계산으로 표면을 다듬고, 무거운 거리장 평가를 Web Worker에 나눈다. 불상 전체를 화면에서 매 프레임 ray marching하는 방식과는 다르다.

**식물:** `vegetation-tree.js`의 가지 구조와 튜브 메시, `vegetation-tex.js`의 Canvas 생성 잎 아틀라스, 반복 잎 카드가 결합된다. 연꽃은 `pond-lotusgeo.js`와 `pond-lotus.js`에서 꽃잎·꽃술·잎·표면 디테일을 따로 구성한다. 모든 개체를 똑같은 단순 형상으로 늘리지 않고, 근접 촬영 대상에 더 많은 디테일을 배정한다.

외부 모델/텍스처/HDRI가 없다는 설명은 **런타임 입력 에셋 기준**이다. 런타임 Canvas 텍스처, 환경맵, 렌더 타깃은 존재하며 저장소에는 문서용 JPG도 있다.

## 텍스처처럼 보이는 표면의 원리

`src/core/materials.js`의 `patch()`가 Three.js Standard/Physical 재질의 shader chunk에 GLSL을 주입한다. 기본 PBR 조명·그림자를 유지하면서 다음을 함께 바꾼다.

| 재질 | 실제 구현 요소 | 보이는 효과 |
|---|---|---|
| 붉은 칠 목재 | 큰 색 얼룩, 방향성 나뭇결, 퇴색·마모, 낮은 높이의 때, 거칠기·bump | 균일한 플라스틱 같은 표면 감소 |
| 금박 | 저주파 변색·얼룩, 미세 요철, roughness 변화 | 완벽한 노란 거울 대신 사용감 있는 금속 |
| 청동 | 녹청 마스크가 색·roughness·metalness를 함께 변경 | 산화된 부분과 노출 금속이 다르게 반사 |
| 석재 | 노이즈 기반 돌 입자와 이끼 분포, 법선 요철 | 돌과 식생의 경계·빛 반응 차이 |
| 목재·연잎 | 방향성 결/잎맥과 화면 미분 `fwidth` 기반 필터링 | 가까이서는 결이 보이고 멀어지면 반짝임 억제 |

`n_bumpView()`는 높이 함수의 화면 미분으로 표면 법선을 교란한다. 색 무늬만 그리는 것과 달리 실제 광택·명암이 바뀐다. 다만 이것은 형상을 늘리는 displacement가 아니므로 외곽선이나 큰 균열은 별도 메시가 필요하다.

## 조명·촬영·후처리의 기여

- `core/sky.js`: Rayleigh/Mie/ozone 기반 하늘과 태양, 구름. 외부 HDRI 대신 생성한 하늘을 사용한다.
- `core/lighting.js`: 생성된 하늘/장면을 CubeCamera로 캡처하고 PMREM으로 변환해 금속과 주변광에 사용한다. final에서는 실제 건물까지 환경에 반영한다.
- `core/fog.js`: 거리·높이 안개와 실내/처마 아래 주변광 감쇠 볼륨. 처마 아래까지 균일하게 밝아지는 문제를 줄인다. 완전한 실시간 GI는 아니다.
- `pond-water.js`: 평면 반사 카메라, oblique clipping, HalfFloat 반사 타깃과 밉맵, 바람 잔물결·물고기 파문·Fresnel. 기존 Stillwater에도 평면 반사와 굴절이 있으므로 새 기능이라고 간주하지 않는다.
- `shots.js`, `shotkeys/`: 7초짜리 10개 샷. 근접 디테일에서 전체 풍경으로 이동하며 초점거리·초점면·조리개까지 조절한다. 소품 배치 자체도 정해진 촬영 구도에 맞춘다. 자유 카메라의 모든 위치에서 같은 완성도를 보장하는 설계가 아니다.
- `core/post.js`: HDR + SSAO + 다중 샘플 누적, 피사계심도, Bloom, ACES/AgX 혼합 톤매핑과 색보정. 일반 volumetric ray-march와 god rays 패스는 존재하지만 문서상 최종 영상 기본값은 꺼짐. 실내 빛줄기는 `interior-fx.js`의 그림자맵을 읽는 슬라이스 방식이다.

## 영상 품질과 실시간 성능을 구분해야 하는 이유

원본 README가 보고한 장면은 약 2,440만 삼각형이며, 완성 영상은 1080p60·70초다. 여기서 60fps는 **출력 영상의 재생 속도**다.

최종 한 프레임마다 8개의 서브프레임을 합치고, 카메라·태양·셔터 시간을 달리 샘플링해 AA·부드러운 그림자·모션블러·AO 노이즈 감소를 얻는다. 샘플 패턴을 영상 프레임 번호가 아닌 서브프레임 번호에 고정해 프레임 간 반짝임을 줄인다.

원작자 Radeon 780M 측정치는 1080p 한 프레임 약 3.3초, 전체 영상 약 4시간이다. Wonderworks 기기에서 측정한 값이 아니다. preview의 그림자는 2048², final은 8192²이며 AO·DOF·환경 캡처도 다르다. **원본 final 설정 전체를 현재 실시간 작품에 적용하는 것은 권하지 않는다.**

## 기존 프로젝트별 개선안

| 우선순위 | 기존 코드에서 확인한 상태 | 제안 | 기대효과·주의점 |
|---|---|---|---|
| 1. Stillwater | `pond/src/nature-materials.ts`에 PBR 돌·나무·흙, 이끼·젖음·잎 디테일. `water.ts`에 반사/굴절. `dream-light.ts`에 HDR/Bloom | 가까운 다리·정자·석등의 모서리, 접합부, 기와 끝을 보강. 기존 PBR 위에 환경 위치 기반 마모/이끼/젖음 마스크. 처마 아래 주변광 감쇠와 국소 환경 캡처 검토 | 가장 직접적인 대응. 기존 물·PBR·물고기 에셋을 교체할 필요 없음. 실시간 비용은 같은 카메라로 비교 |
| 2. Through the Seasons | `foliage/src/tree.ts` 나무껍질은 색상 sin 무늬, roughness=1. 잎·가지·계절·원경 아틀라스 보유 | 껍질 색 패턴과 연동한 normal/roughness 변화, 가지 방향의 결, 잎 역광·두께감·미세무늬 필터링 | 큰 메시 증가 없이 근접 질감 개선 가능. 계절 눈 마스크·바람 그림자 유지. 원경 나무를 고밀도 실체 메시로 바꾸지 않음 |
| 3. Bloom | `bloom/src/garden.ts`에 Physical 꽃잎, bump, sheen/transmission, PMREM·도자기 화병 | 꽃잎별 휨·두께·끝말림과 꽃술의 근접 형상, 거리별 잎맥 필터링 | 이미 PBR이므로 단순 Bloom 추가보다 형태 개선 우선. QR 모드의 unlit 색·대비 및 디코딩 검증 유지 |
| 4. Harbor | GLB 자산과 물·날씨·카메라 구조 보유 | 목재 방향성, 금속 염분/산화, 물높이 기반 젖음과 구도별 조명 조정 | 기존 Blender 모델을 절차적 모델로 전부 재작성할 필요 없음 |

Fish는 WebGPU/TSL이라 이 GLSL `onBeforeCompile` 코드를 직접 붙일 수 없다. 원리만 TSL로 옮겨야 하므로 첫 적용 대상으로 삼지 않는다. Foil/Prism/Cassette는 해당 작품의 의도와 광택 조절을 우선하며 사찰용 전역 셰이더 변경을 공통 적용하지 않는다.

## 추천하는 첫 구현 단위

**Stillwater의 다리 난간·석등·연꽃 한 구역을 기준 샷으로 개선한다.** 먼저 현 상태를 고정 카메라·같은 시간/날씨·해상도로 저장하고, 재질 → 근접 형상 → 주변광 순으로 각각 비교한다. 이 세 단계의 시각 효과와 비용을 분리해서 판단한 뒤 주변으로 넓힌다.

1. 재질: 원본 `patch`의 설계는 참고하되 기존 `onBeforeCompile`에 조합하고, 색/roughness/normal이 같은 마모 마스크를 공유하게 한다. 기존 shader patch와 cache key, 그림자용 변형을 덮어쓰지 않는다.
2. 형상: 카메라 가까운 모서리·접합부·꽃잎에만 추가한다. 반복 요소는 instancing, 정적 요소는 재질별 merge. 모바일에는 디테일 단계 축소.
3. 조명: 장면 생성 시 환경 캡처를 검토하고, 시간/날씨 변화에는 제한된 갱신 또는 프리셋 보간을 사용한다. 매 프레임 6면 환경 캡처 금지. 기존 단일 최종 톤매핑 유지.
4. 결과 검증: 근접/전체·역광/그늘·정지/카메라 이동을 비교. GPU frame time 가능 시 측정, CPU frame time·draw calls·삼각형·시작 시간도 기록. 대표 데스크톱/모바일에서 기존 대비 저하를 확인한다. 수치 목표는 기기 기준 측정 후 확정한다.
5. 홍보 영상은 별도 offline 모드에서 고품질 누적 렌더링을 사용한다. 기존 갤러리의 단일 hover video 구조와 잘 맞는다. 원본의 camera/flicker 검사 방식을 참고하되 7초 고정 컷 가정은 작품에 맞게 변경한다.

## 실행 준비와 경계

원본 의존성: Three.js 0.186.1, Vite 8.3.4, puppeteer-core 25.13.0. Node >=22. 정확한 재현은 해당 폴더의 lockfile 기준 `npm ci`로 한다. 승인된 설치 후 독립 서버를 실행했으며 기존 갤러리 빌드에 자동 편입하지 않는다.

```sh
cd projects/golden-temple
npm ci
npm run dev -- --host 127.0.0.1
```

기본 주소 `http://127.0.0.1:5173/`. 원본 README 기준 드래그 회전, 1–9/0 샷, Space 정지, F 자유 카메라. 먼저 preview 전체 장면 생성과 오류를 확인하고 이후 final 정지 프레임 한 장으로 비교한다. 전체 70초 렌더는 이 조사 작업의 검증 범위에 포함하지 않는다.

코드 MIT 출처를 보존한다. 음악은 저장소에 없고 별도 CC BY 4.0이며 이번 복사에서 다운로드하지 않았다. 원본 문서 이미지와 자체 렌더 결과는 구분해서 표시한다. 기존 작품 수정·갤러리 등록·배포는 이번 제안에 포함하지 않았다.

## 원문 링크

- [README: 구성·재현·측정치](https://github.com/Leonxlnx/golden-temple/blob/97fd9ec35ee5c0f02769addb4e35cb5e22f951dd/README.md)
- [Architecture: 렌더 파이프라인·촬영](https://github.com/Leonxlnx/golden-temple/blob/97fd9ec35ee5c0f02769addb4e35cb5e22f951dd/docs/ARCHITECTURE.md)
- [materials.js: 절차적 재질](https://github.com/Leonxlnx/golden-temple/blob/97fd9ec35ee5c0f02769addb4e35cb5e22f951dd/src/core/materials.js)
- [hall-roof.js: 건축 형상](https://github.com/Leonxlnx/golden-temple/blob/97fd9ec35ee5c0f02769addb4e35cb5e22f951dd/src/world/hall-roof.js)
- [interior-sdf.js: 조형 메시 생성](https://github.com/Leonxlnx/golden-temple/blob/97fd9ec35ee5c0f02769addb4e35cb5e22f951dd/src/world/interior-sdf.js)

## 2026-10-16 설치·실행 검증 결과

- 원본 lockfile 기준 npm ci 성공:42개 설치, audit 취약점0건.
- npm run build 성공:101모듈 변환. npm run camcheck 정상 종료:10개샷의 수치 출력(품질 합격 임계값 테스트는 아님).
- 개발 서버: http://127.0.0.1:5173/ 실행 중.
- Codex 내장 브라우저에서 전체 장면 생성 후 `capturing environment...` 표시 확인. 조회 당시 error 로그 없음, vegetation 통계 warn 1개.
- 이후 screenshot과 탭 재연결이 각각30초 타임아웃. 최종 렌더 성공은 미확인. 원인은 확정하지 않았으며 원본 수정이나 우회 실행은 하지 않았다.
- 설치·빌드 후 원본121개 파일 SHA-256 재검증 일치.


## 2026-10-16 구현 후속

사용자의 “모두 해봐” 승인으로 로컬 실시간 최적화를 적용했다. 위 원본 분석/복제 시점 이후 소스가 변경되었으므로 현재 파일은 원본 해시와 일치하지 않는다. 적용 범위·최종 측정·제외한 후보·남은 한계는 [OPTIMIZATION_RESULTS.md](OPTIMIZATION_RESULTS.md)를 참조한다.
