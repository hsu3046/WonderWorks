# 결정 기록

## 2026-09-28 — 개별 작품부터 축적

사용자 승인: “1부터 해보자. 그 후에 몇 개 개별이 쌓이면 갤러리화 하자.”

- 첫 작품은 `projects/shabon/`에서 독립 실행한다.
- 원본 41개 파일을 바이트 단위로 유지하고 SHA-256 manifest로 비교한다.
- 원본의 CDN 버전, 그래픽, UI, 오디오, 무작위 진행을 유지한다.
- 빌드 도구와 프레임워크를 추가하지 않는다. 기존 Python과 브라우저 검증 런타임을 사용한다.
- 몇 개의 작품을 완성한 뒤 갤러리를 설계한다.
- 원본에 없는 영상 출력 서버를 구현하지 않는다.
- 새 문서·도구에는 기본 GPL v3를 적용하고, 가져온 원본의 확인되지 않은 라이선스와 구분한다.

작업 시작 시 이 폴더는 Git 저장소가 아니었다. 이번 작업에서는 Git 초기화·원격 등록·push·PR을 진행하지 않는다.

## 2026-09-29 — 두 번째 작품 WebGPU 재구현

- 사용자 “해”로 추천 WebGPU 방식을 승인. 별도 패키지 설치 질문에도 “설치하고 진행”으로 승인.
- `three` 0.186.0, `@types/three` 0.186.0, TypeScript 7.0.2, Vite 8.3.1을 fish 폴더 안에만 설치하고 lockfile 고정.
- 소스 없는 참조 사이트와 사용자 영상의 외형·조작을 새로 구현. 원본 내부 알고리즘·패널 설정은 확인했다고 주장하지 않는다.
- 마우스 휠 줌은 사용자 명시 필수 기능. 거리 보간 방식이며 포인터 ray는 최신 카메라에서 계산.
- 6,144×32 샘플 이웃 비교로 연산량을 제한. 정확한 전수 Boids 대신 유영장과 결합한 실시간 근사.
- 두 작품은 각각 4173/4174 독립 실행. 갤러리·외부 배포·Git 작업은 추가하지 않음.
- 실제 GPU 컴파일에서 WGSL 예약어 `active` 충돌을 확인해 `enabled`로 변경. 이후 renderer.onError로 프레임 루프를 중단하고 오류 UI를 표시.

## 2026-09-29 — 빛·군집·카메라 개선

- 기존 문제 원인: 방향성 없는 평면 광선, 고정축/상관된 분포가 만드는 얇은 원통·고리, 고정 중심의 제한된 카메라.
- 평면 광선 제거. 장면 깊이까지 수중 광량을 적분하는 절반 해상도 RTT + HDR Bloom. 20개 jittered 샘플로 층 경계 완화. 추가 npm 의존성 없음.
- 군집 회전축·반경·두께·분리 정도를 변화시킴. bank storage buffer로 방향 전환의 몸 기울기 반영. 유영 속도는 시간/힘/위치/꼬리에 일관되게 적용.
- 56초 자동 카메라 기본 제공. 휠·드래그가 우선하며 C/버튼으로 재개. prefers-reduced-motion에서는 수동 카메라로 시작. 수동 줌 범위 2.5~55.
- 검증은 docs/validation/fish/v2/RESULTS.md. 원본과 동일한 궤적·카메라 알고리즘이라고 주장하지 않음.

## 2026-09-29 — Three-project gallery

- 사용자 요청에 따라 갤러리화를 시작. 기존 Bubble Day / Ocean Shoal + Dani Fruit Jelly(2종)를 3개 프로젝트로 묶음.
- 기존 독립 프로젝트에 영향을 주지 않도록 별도 gallery 패키지. vanilla TypeScript/Vite/Three.js, 기존 설치 재사용으로 신규 의존성 설치 없음.
- 어두운 전시 공간, 크롬·유리 조형물, 큰 실제 썸네일과 주황색 포인트. hover는 영상이 아닌 실행 iframe이며 한 개만 유지.
- Blender MCP 두 연결 경로가 모두 불가. 연결 요청을 안내하고 실제 조형물은 Three.js 절차 형상으로 제작. Blender 작업 완료로 표현하지 않음.
- Dani는 읽기만 수행하고 필요한 web demo와 자산을 Wonderworks로 복사. 링크·import 경로 수정, 원본 해시 manifest 기록.
- Shabon 원본 라이선스 미상은 상세/credits/source notice에 표시. 로컬 리뷰만 수행, 외부 배포 없음.

## 2026-09-29 — Actual frozen scene cards

User rejected low-resolution thumbnails and approved real-frame freeze/hover playback after resource review. Keep prepared nearby scenes resident for seamless resume; replace distant scenes with captured frames before release. Initialization is sequential; only one scene plays at a time. A visible-card capture priority prevents lower-priority cards from staying on an old screenshot indefinitely. Up to 2 desktop / 1 mobile scenes are retained; evicted scenes must reinitialize on revisit and may change composition. Do not preserve every scene indefinitely, change standalone artwork behavior or enable persistent preserveDrawingBuffer just for snapshots.

Shabon first-frame readiness waits for the initial flight and one second of ride time, avoiding the intentional close-up wand focus during the blowing introduction. This adds several seconds to initial preparation but preserves the original scene optics.

## 2026-09-29 — Replace resident renderer previews with recorded media

User reported real usage remained unreliable after frozen preview implementation. Observed: all three cards visible, but only Ocean/Jelly had resident frames; Shabon required full reinitialization on hover. The controller paused other playback whenever any scene was loading, and preparation itself performed expensive scene generation/shader work. Earlier steady-state freeze tests did not adequately cover this transition cost. GPU process memory/temperature was not measured; rendering pressure is a contributing architectural risk, not a proven sole cause.

Resolution: actual canvas recordings, one shared muted video player, no automatic artwork renderers in the gallery. Clips are about 7 seconds at 30fps; bitrates bounded for complex worlds. Posters come from the recording's first frame. Exact 3D interaction remains explicit in details/full experience. Four variants were captured sequentially using browser MediaRecorder, then transcoded with the existing FFmpeg installation; no new dependency or external asset service.

### 2026-09-29 — Action footage and reset on pointer leave

Jelly previews must demonstrate interaction: citrus lift/bounce and watermelon cutting with independent pieces. Record these through the original controls rather than adding live card renderers. All cards reset to the first frame on pointer leave per explicit user preference; remove snapshot and playback-position caches.

### 2026-09-29 — Wonderloop identity and footer credit

Replace the typographic asterisk with an original continuous trefoil SVG ribbon (Wonderloop), shared by header, About and favicon. Footer omits the visible domain; © 2026 AIB Inc. links directly to https://www.aib.vote.

### 2026-09-29 — Refined logo proportions

Center the trefoil artwork within its SVG canvas, use a dedicated wordmark span for optical header alignment, and reduce the header mark to 36px (32px mobile). About mark uses a deliberate 76px column aligned to its title. Ribbon stroke reduces from 6.5 to 4.6 units with subtle copper/edge highlights.

### 2026-09-29 — Interwoven mark and open-ended copy

Trefoil crossings now alternate over/under with narrow copper outlines and contact shadows clipped to intersection regions, preserving continuous strands. Avoid fixed collection totals in marketing/navigation copy: use WORLDS OF WONDER and an ever-growing collection. Individual artwork indices remain identifiers, not a collection limit.

Logo follow-up: soften the copper contour to #94684f at 65% opacity; retain the intersection contact shadows.

## 2026-09-29 — Tidelight Harbor

Use original Blender models for the tea house, dock and boats, with Three.js handling atmospheric variation and animation. Retain editable .blend and parametric modeling scripts in the source package. Use existing local native Blender MCP, verified Blender 5.2.2 / protocol 11; no new MCP server/addon installation. The gallery keeps one recorded video and first-frame reset. Do not claim this independent interpretation is the original engine/source or a pixel-identical reconstruction.

### Gallery catalog layout (2026-09-29)

- Experiment links use a right arrow instead of an underline.
- Every desktop study uses alternating image/text columns; mobile preserves image-first reading order with dashed separators between studies.
- The hero index is generated from `projects/gallery/src/catalog.ts`, the same list as the collection. It wraps into three desktop or two mobile columns in normal document flow; adding a catalog entry updates both locations without additional markup/CSS.
- Validation: strict TypeScript + production build passed; six alternating rows at 1280px and five mobile separators at 390px; no horizontal overflow or browser errors; newest index entry opens its correct detail dialog. Existing Three.js bundle size warning remains.

### Initial paint CSS ownership (2026-09-29)

Harbor and gallery load their page styles with an HTML `<link rel="stylesheet">`, not through the JS entry. Matching inline background colors cover the initial document. This prevents unstyled text flashes while the module graph loads. Verification: `docs/validation/initial-paint/RESULTS.md`.

### Gallery preview quality (2026-09-29)

Record native 1536×1024 (3:2) H.264 MP4 directly from each actual canvas at target 12 Mbps and up to 30fps. Finalize with faststart stream copy, not downscaling or another lossy encode. First-frame JPEG posters match each clip. Use versioned `-hq` filenames to invalidate old assets. Keep one shared player, preload none, hover-only playback and reset to zero on pointer leave. Seven clips include both jelly variants; complex scenes retain more bitrate at the cost of download size. Validation: `docs/validation/gallery/hq-previews/RESULTS.md`.

### Stillwater pond study (2026-09-29)

Recreate the supplied koi-garden composition as original procedural Three.js assets, with no dependency installation or redistribution of the reference recording. Preserve visible material detail: pebbles, bark grain, koi patterns/scales/eyes/translucent fins, rippling reflection/refraction and animated light. Add four viewpoints, food attraction and touch ripples. Use existing local tooling, strict TypeScript and GPL v3/AIB Inc. credits. Reference evidence and limitations are in docs/pond/.

### Webcrawler semantic habitat (2026-10-02)

Recreate the supplied clip's eight jointed wireframe legs and words lifting into the mouth using Canvas 2D over actual DOM word positions. Keep eaten spans in layout so leg contacts and neighboring words do not jump. Use original bilingual sample prose with an explicit sample label. Fetch one public page per user action and rebuild its semantic text; never embed the original site or execute source scripts. A bounded, DNS-pinned Node reader supports both local Vite and the Vercel Web Handler. Preserve the existing shared-toolchain and single-video gallery preview conventions. Credit AIB's implementation separately from the supplied reference, whose creator was not identified.
