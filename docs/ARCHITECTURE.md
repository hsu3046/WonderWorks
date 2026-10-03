# 구조

현재는 세 프로젝트를 독립 실행 상태로 유지하고, 별도 Three.js 갤러리에서 통합 소개한다.

```text
projects/shabon/
  index.html          UI, import map, 로딩 오류 표시
  assets/leaves.png   원본 나뭇잎 아틀라스
  src/main.js         초기화, 입력, 렌더 루프
  src/world/          지형과 마을 배치
  src/render/         셰이더와 형상, 후처리
  src/sim/            카메라 진행, 바람, 생물 행동
  src/audio/          Web Audio 합성
docs/
  shabon-source-manifest.json  원본 무결성 기록
```

실행 경로: `index.html` → import map의 Three.js → `src/main.js` → 지형·식생·건물·생물 초기화 → 매 프레임 시뮬레이션과 렌더링.

렌더링은 근거리 그림자, 기본 장면, 물, 구름, 공간 차폐, 합성, 피사계심도, 입자, 비눗방울, Bloom과 최종 색조 순으로 진행한다. 각 모듈은 공통 uniforms, 지형 텍스처, 깊이 버퍼를 공유한다.

독립 실행은 Python 표준 정적 서버를 사용한다. 원본 JavaScript/GLSL을 보존하므로 TypeScript 변환과 번들러 도입은 이번 단계에 포함하지 않는다. 새 앱 패키지나 Bundle ID를 생성하지 않았다.

## 두 번째 작품: fish

`projects/fish/`는 `vote.aib.wonderworks-fish` 독립 TypeScript/Vite 패키지다. 첫 작품의 소스와 실행 방식은 유지한다.

- `src/main.ts`: GPU 초기화, 단일 렌더 루프, 숨김·일시정지·오류·해제 수명주기.
- `src/simulation.ts`: 위치·속도·다음 속도 storage buffer. 32개 이웃 샘플 + 유영장 + 포인터·충격파. 읽기와 쓰기를 두 compute dispatch로 분리.
- `src/school.ts`, `geometry.ts`: 물고기와 눈·지느러미 형상, 6,144 인스턴스, GPU 꼬리 운동·방향 정렬.
- `src/environment.ts`, `shaders.ts`: 해저·바위·해초·부유물·수면, 거리 안개, 절차적 집광, 빛줄기 근사.
- `src/postprocessing.ts`: HalfFloat 장면 패스 → 깊이 재구성 → 절반 해상도 볼륨광(20샘플)과 Bloom → 단일 최종 톤매핑.
- `src/controls.ts`: CSS 좌표→NDC→world ray, 휠·드래그·핀치, 클릭/드래그 구분, 카메라 거리 2.5~55.
- `src/native-shader.ts`: r186 WGSL callable node proxy의 부족한 선언만 격리한 타입 경계.

생성 에셋에는 이미지/모델 파일이 필요 없다. WebGPU 실패를 WebGL 성공으로 표시하지 않는다. 개발 빌드에만 `window.__fish` 진단 getter와 요청 시 GPU 버퍼 유효성 검사를 노출한다.

### Fish 카메라·군집 개선 (2026-09-29)

카메라의 Catmull–Rom 위치/주시점 경로는 56초에 한 번 순환한다. 카메라 시간은 유영 속도와 분리하며 Space 정지 시 함께 멈춘다. 휠·드래그를 잡는 시점의 위치/주시점에서 수동 yaw/pitch/distance를 역산해 인계한다. C로 이전 경로 시점부터 부드럽게 합류한다.

군집은 시간에 따라 기울어지는 3D 회전축, 반경·축방향의 독립 개체 분포, 흐름의 굴곡, 세 부분의 분리/재결합과 기존 이웃 정렬·응집·분리를 합성한다. 회전량을 별도 GPU bank 버퍼에 저장해 메시가 방향 전환 때 기울도록 한다.

## Gallery / Jelly (2026-09-29)

- `projects/gallery`: Vite + strict TypeScript, Three.js hero. `catalog.ts`가 3개 프로젝트와 4개 실행 경로를 정의.
- `projects/jelly`: Dani의 citrus/melon/jelly-shared 및 사용 vendor/assets 복사본. 원본 Dani 수정 없음.
- `prepare-works.mjs`: gallery/public/experiments에 독립 실행 복사본을 생성. preview 쿼리에서만 UI를 숨기고 준비 메시지 전송; 젤리는 주기적 nudge, fish는 가까운 프리뷰 시점 적용.
- hero와 hover preview는 동시에 돌리지 않음. hover iframe 최대 1개, pointerleave/화면 밖/탭 숨김 시 제거. 상세 모달은 명시적으로 Play 후 실행.
- UI는 native dialog, 초점 복구, backdrop 닫기, 반응형 및 reduced-motion을 지원.
- `public/downloads`: 프로젝트별 소스 ZIP과 갤러리 소스. 신규 코드 GPL과 원본 출처 예외를 구분.
- 포트: Shabon 4173 / Fish 4174 / Gallery 4175. 각 기존 서버와 원본은 유지.

### Frozen previews (2026-09-29)

`gallery/src/previews.ts` owns candidate selection, max 2 desktop / 1 mobile resident iframes, sequential warmup, pause/play, snapshot caching, variant changes, and hidden/modal/offscreen release. `preview-runtime.js` uses same-origin/source-checked postMessage with renderer-owned adapters. On pause it cancels animation, draws once and captures a WebP Blob at quality .95; the parent decodes before removing an iframe. Snapshots are cached per variant and object URLs revoked on replacement/disposal.

Gallery Shabon copy tracks/cancels its RAF and resets its time baseline on resume; normal original Shabon is unchanged. Copied Jelly uses its existing native suspend/wake API; nudge timer runs only during play. Fish exposes a preview-query-only registration using its existing animation-loop lifecycle. Previews use 2× backing resolution capped at 1.6M pixels (Fish 1.8M). Gallery credits: © 2026 AIB Inc. / https://www.aib.vote.

### Current card preview architecture — video replacement (2026-09-29)

The frozen-renderer card approach above is superseded after user-reported transition instability. Gallery cards now share ONE muted HTMLVideoElement, inserted only after intentional hover. No experiment iframe or renderer is mounted for cards. MP4 H.264 / 30fps clips show actual local canvas recordings. JPEG posters are 1440×1028; video sizes are 1152×824 for Shabon/Ocean and 1440×1028 for Jelly. `previews.ts` owns request generations, play rejection/error fallback, actual playing-event labels, reset-on-leave with immediate first-frame poster restoration, and offscreen/hidden/modal resource release. Full 3D remains available through an explicit detail Play or Open experience action.

## Chroma Motion

A separate strict TypeScript/WebGL2 effect studio lives in projects/chroma (4176). It uses procedural cylinders/ribbons/caps and a shared shader to recreate the supplied gradient-motion reference, with configurable movement/palette/shape and URL presets. Details: docs/chroma/ARCHITECTURE.md. Gallery integrates its static build, source ZIP and recorded MP4 through the existing one-video preview controller.

## Tidelight Harbor

`projects/harbor` (4177): Blender에서 제작한 실제 GLB와 Three.js WebGL2 환경을 결합. 5개 환경 프리셋, 3개 카메라, 수면 반사·안개·비·배 항적. `docs/harbor/ARCHITECTURE.md` 참조. 갤러리 카드는 기존 단일 영상 재생 구조를 유지하며 실제 3D는 명시적 Play/Open에서만 로드한다.

## Through the Seasons (2026-09-29)

`projects/foliage` (4178): 사용자 영상 하단의 단풍나무를 기준으로 확장한 사계절 관찰 장면. 절차적 가지·GPU 잎/잔디·날씨 입자, 계절·시간·오디오 제어. `docs/foliage/ARCHITECTURE.md` 참조. 갤러리06에 영상 프리뷰와 소스 다운로드로 연결. Chroma 다섯 효과 모핑은 사용자 최종 확정본으로 유지.

## Stillwater (2026-09-29)

`projects/pond` (4179): original procedural koi garden inspired by the supplied 156-second garden recording. Screen-space refraction + planar reflection, animated caustics, 28 patterned koi, lily-pad frog, dragonflies and blossoms, bridge and pavilion. Four viewpoints, feeding/ripples, sunlight/dusk/rain, pause/photo controls. `docs/pond/ARCHITECTURE.md` documents rendering and limitations. Gallery uses the existing single-video hover architecture.

## Fulgur / Lightning (2026-10-02)

`projects/lightning` (4180) is an independent lightning chamber with ray-marched
cloud, seeded branching discharge, local atmospheric light and an orbitable dome.
Desktop/mobile controls and opt-in thunder. Root build includes the standalone
route and source ZIP, plus study 08 in the gallery index and collection.
See `docs/lightning/ARCHITECTURE.md`.
