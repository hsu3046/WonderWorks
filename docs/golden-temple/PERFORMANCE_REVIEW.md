# Golden Temple 전체 성능 검토

TL;DR: 원본은 영화용 장면을 실시간으로 탐색하는 구조다. preview에서도 높은 형상 밀도, 매 프레임 그림자·평면 반사, 대기 산란 셰이더와 19개 기본 후처리 패스를 유지한다. 실시간 전용 경로를 분리하는 것이 적합하며, 우선 불필요한 반복 계산을 없애고 그다음 반사·그림자·거리별 형상 품질을 조절한다.

2026-10-16 · © 2026 AIB Inc. · GPL-3.0-only. 원본 코드 MIT/Leon Lin 유지.

## 검토 범위·확실성

- 사용자 확인: 원본 실행은 정상이며 실행 중 랙이 큼. 이전 자동화 타임아웃을 실행 실패로 판단하지 않는다.
- 기준: 원본 커밋 `97fd9ec35ee5c0f02769addb4e35cb5e22f951dd`, 설치된 Three.js 0.186.1 구현, main/core/world 및 도구의 정적 분석. 원본 소스 변경 없음.
- 확정 가능한 것은 아래 실행 경로·반복 작업이다. 항목별 GPU 시간·FPS·VRAM·발열은 미측정. 우선순위는 비용 구조에 근거한 가설이며 개선 배수나 60fps를 보장하지 않는다.
- 수치는 기본 `/` → dev/preview, 1280×720, DPR=1 기준. 사용자가 실제 본 URL·GPU·해상도는 별도 확인이 필요하다.

## 1. 매 프레임 비용

### 기본 렌더 경로

`main.js:417` runDev → `renderFrame()` → `setTime()`/카메라/그림자 → `Pipeline.subframe()` → `endFrame()`.

| 작업 | 소스 근거 | 비용 해석 |
|---|---|---|
| 그림자 | `main.js:51`, `core/lighting.js:47` | autoUpdate=true, 매 프레임 fitSunShadow가 shadow.needsUpdate=true. preview도 2048² |
| 기본 장면 | `core/post.js:608` | HalfFloat HDR, 4×MSAA. 큰 메시·복잡한 PBR/절차 재질 |
| 수면 반사 | `world/pond-water.js:400` | 수면이 렌더 대상이고 카메라가 수면 위면 별도 반사 카메라로 장면 재렌더. preview는 축별50% 해상도·4×MSAA·depth·mipmap |
| SSAO | `core/post.js:610` | 반해상도 AO 1회 + 양방향 blur 2회 |
| 누적 합성 | `core/post.js:658` | dev가 spp=1이어도 전체 화면 누적 패스 1회 |
| Bloom/로컬 밝기 | `core/post.js:707` | downsample7 + localMip복사1 + upsample6 = 14회 |
| 최종 출력 | `core/post.js:744` | 톤매핑·색보정·선명도·필름 효과 1회 |

기본 후처리는 **3+1+14+1=19회**다. 모두 전체 해상도는 아니며 패스 수가 GPU 비용 비율을 의미하지 않는다. 별도로 장면·그림자·반사가 추가된다. 그림자와 반사의 가시 대상은 서로 다르므로 삼각형 수를 단순히 3배로 계산하면 안 된다.

반사 코드는 이미 그림자 autoUpdate를 꺼서 반사마다 그림자를 다시 계산하는 것을 억제한다. 반사 때문에 그림자가 무조건 두 번 생성된다고 진단하지 않는다.

### A. 큰 형상과 제한적인 실시간 품질 분리 — 우선 계측

원작자 문서의 약2,440만 삼각형은 원본 장면 수치이며 현재 preview 실측값이 아니다. preview는 SDF 불상의 격자 간격, 일부 지형 텍스처, 실내 빛줄기 등에 품질 분기가 있으므로 final과 동일 형상이라고 단정할 수 없다. 다만 여러 건축·식생 모듈은 실시간 전용 밀도 분리가 제한적이다.

`core/geom.js:29`는 형상을 non-indexed로 정규화하고 `Builder`가 재질별로 병합한다. draw call은 줄지만 정점 공유가 사라지고 공간적으로 큰 묶음은 일부만 보여도 전체 묶음이 제출된다. 따라서 무조건 더 병합하거나 모든 것을 instancing으로 바꾸는 방식은 부적절하다.

제안: 건물/지붕구간/식생 셀로 공간 분할, 동일 부품 인스턴싱, vertex 속성 경계를 보존하는 인덱스 공유 검토. 근경 장식·연꽃은 유지하고 원경 기와·잎·수풀부터 LOD를 추가한다. 반사/그림자용 저밀도 형상도 분리한다. 바람 변형 범위를 포함한 bounds가 필요하며 `frustumCulled=false`를 일괄 true로 바꾸면 안 된다.

### B. 매 프레임 평면 반사 — 기대효과 큰 후보

preview 반사 해상도는 기본640×360으로 이미 낮다. 하지만 픽셀 수를 줄여도 반사 장면의 정점 변환·draw 제출은 유지된다. 반사 타깃은 4×MSAA와 매 갱신 mipmap도 사용한다.

제안: 카메라 이동 중에는 최신 반사 유지, 정지 중에는 갱신 빈도를 낮추고 동적인 물체의 필요도를 고려. 수면 화면 점유율·반사에서 보이는 객체를 기준으로 반사 LOD/레이어 사용. 반사 MSAA를 별도로 비교한다. 반사 주기만 무작정 낮추면 회전 시 반사가 뒤처지고, mipmap을 제거하면 원본의 거친 반사 표현이 달라지므로 각각 검증한다.

### C. 매 프레임 태양 그림자

태양 방향은 기본적으로 고정인데 shadow frustum 계산과 그림자 렌더는 계속된다. 다만 잎·물고기·등·연기 등 동적 요소 때문에 전체 그림자를 영구 고정할 수 없다.

제안: frustum 계산은 입력이 바뀔 때만, 그림자는 실제 움직이는 caster와 카메라/샷 변경을 반영하는 갱신 정책으로 분리. 정지된 샷에서는 캐시 가능. 저빈도 갱신을 쓸 경우 흔들리는 잎과 그림자의 불일치 확인. 정적/동적 shadow 분리는 추가 타깃·합성 복잡도가 있으므로 계측 후 선택한다. 2048→1024는 그림자 텍셀75% 감소지만 전체 GPU 시간75% 감소가 아니다.

### D. 하늘의 대기 산란 — 캐시 가치 큰 후보

`core/sky.js:53` atmosphere는20단계 적분 안에서8단계 sunTransmittance를 호출한다. `skyColor()`는 시선 방향 대기뿐 아니라 구름 부분에서 천정 대기를 추가 평가한다. 태양/천정/구름 고도의 고정값도 픽셀마다 계산된다. 하늘이 차지하는 화면과 반사에 따라 비용이 커질 수 있다.

제안: 고정 태양의 대기 산란을 LUT 또는 HDR 하늘맵으로 캐시하고 움직이는 구름·태양 원반만 분리. 위치/태양 변화 시 무효화. 전역 고정값은 uniform 또는 사전 계산으로 이동. 하늘 전체를 저해상도 이미지로 고정하면 구름 움직임·태양광·반사 일관성이 손상되므로 분리 구현이 필요하다.

### E. 꺼진 효과도 남는 후처리

`bloom=0`은 최종 혼합 계수만0으로 만들며 down/up14패스는 계속 실행된다. `clarity=0`에서도 localMip 복사를 한다. 반면 `ao=0`은 실제 AO3패스를 건너뛴다.

제안: Bloom/clarity 요구량에 따라 render graph를 분기. Bloom=0,clarity=0이면 해당14패스 제거 후보. clarity만 켜지면 필요한4단계 downsample 및 로컬 밝기 데이터만 유지하고 upsample은 생략. 기본 Bloom 유지 시에도 불필요한 localMip 복사1회는 생략 가능. spp=1 전용 경로에서 AO 합성을 최종 합성으로 옮겨 누적 버퍼 패스 제거 검토; 효과 순서와 HDR 결과를 비교해야 한다.

기본 dev에서 DOF·volumetric ray-march·god rays는 꺼져 있으므로 그것들을 끄는 것만으로 기본 랙이 해결되지 않는다. `spp`도 runDev에서 명시적으로1을 전달하므로 8→1 최적화가 이미 적용된 상태다.

## 2. 멈췄을 때도 남는 비용

`main.js:417–431`: Space는 playing만 바꾸며 RAF는 계속 돈다. 샷 모드는 같은 시간·구도를 반복 렌더한다. 자유 카메라는 벽시계 `now`를 사용하므로 playing=false여도 물·식생 애니메이션 시간이 계속된다. visibility/context-loss/dispose 처리도 main에 없다. 브라우저 자체 백그라운드 RAF 제한은 있을 수 있으나 앱이 정지 정책을 보장하지 않는다.

제안: 사용자 pause·탭 숨김·카메라 입력 상태를 구분. 정지하면 simulation/render를 멈추고 카메라 조작 시 한 프레임 invalidate. 돌아올 때 시간 기준 재설정, RAF중복 방지, context loss 중단 및 오류 안내. 이는 정지·백그라운드 부하를 줄이며 재생 중 FPS 개선과는 구분한다.

dev의 `preserveDrawingBuffer:true`도 불필요한 보존 비용 후보다(`main.js:44`). still/export에서는 현재 캡처를 유지하고 dev만 false로 비교한다. 실제 비용은 드라이버마다 달라 주 병목으로 단정하지 않는다.

## 3. CPU·조명·메모리

- `main.js`, `lighting.js`, `pond-water.js`, `pond-koi.js`가 매 프레임 벡터/배열을 생성. `props.js:updateLights`는 등 위치를 배열로 만들고 정렬한다. scratch 재사용·카메라 변경 시 재평가 가능. 큰 GPU 작업보다 우선이라고 단정하지 않는다.
- `interior.js:addLights`와 `props.js:makeLights`가 여러 shadow 없는 PointLight를 등록. props는 이미 최대4개로 제한. 실내외 공용 forward PBR에서 조명 수를 유지하는 비용 검토. 조명 distance가 짧다고 셰이더에서 모든 조명 루프가 사라지지는 않는다. 조명 개수를 매 프레임 바꾸면 shader variant 재컴파일 위험이 있으므로 고정 풀과 장면별 구성을 검토한다.
- `Pipeline.setSize()`는 꺼진 효과의 RT 객체도 만든다. GPU 저장소가 첫 사용 때 할당될 수 있으므로 객체 수만으로 VRAM 사용량을 계산하지 않는다. lazy allocation/pooling을 검토하되 target 크기/형식·동시 생존 구간 확인.
- `captureEnvironment()`가 PMREM 결과의 texture만 반환해 원래 target 소유권을 잃는다. 반복 캡처 수명 정리가 불명확하다. 이는 우선 자원 소유권 개선이며 지속 FPS 원인으로 확정하지 않는다.
- 기하 생성 단계의 clone/non-indexed 변환/merge는 초기 CPU와 메모리 피크에 영향. 불필요한 임시 geometry 참조를 해제하고 공유 자원을 중복 dispose하지 않는다.

## 4. 초기 로딩 비용은 별도 처리

`main.js:270–310`:9개모듈 구축 → compileAsync → 하늘 환경맵 → final 장면 환경맵 → 각 모듈 finalize. `capturing environment...`라는 상태문구가 이 여러 단계를 덮으므로 그 문구만으로 환경맵이 유일한 병목이라고 판단할 수 없다.

`interior.js:593`은 preview에서도 local environment를 두 번 캡처한다(각6면, PMREM). main의 finalize 뒤에는 gl.finish 동기 대기도 있다. 초기 shader compilation도 프레임 지연과 별도다. 환경맵은 매 프레임 캡처하는 구조가 아니다.

제안: 상태와 단계별 소요시간 분리, preview용 실내 캡처 횟수/해상도 비교, 정적 SDF/Canvas atlas/geometry를 빌드 시 생성해 캐시하는 선택지. 소스 생성기를 유지하고 파생 결과만 사전 생성하면 제작 방식과 실시간 비용을 분리할 수 있다. shader 병렬 컴파일은 이미 있으므로 새 최적화로 주장하지 않는다. 단순 Worker 추가는 GPU shader compile을 줄이지 않는다.

## 5. 권장 실행 순서

1. **측정 기준 확보:** 같은 기기/브라우저/1280×720/preview에서 수면 포함 외경·실내·식생 근접·전체 조망의4구도. 동일 seed/time으로 외형 캡처 후 재생/회전/정지 각각 측정.
2. **반복 낭비 제거:** pause/hidden, clarity 복사 및 꺼진 효과 분기, 프레임 할당 재사용, dev buffer 보존 비교. 원본 final/offline 경로 유지.
3. **주 병목 분리:** 하늘 캐시, 반사 전용 MSAA/갱신/LOD, shadow 정책을 각각 단독 A/B. 비용이 큰 것부터 적용.
4. **실시간 형상 단계:** 건물/식생 공간별 LOD, 반사/그림자 proxy, indexed/instanced 지오메트리. 화면상 silhouette·그림자·반사까지 비교.
5. **초기화 개선:** SDF/atlas 사전 생성, env 캡처와 shader warmup 분할. 다운로드/CPU/VRAM 교환관계를 기록.

실시간 목표는 우선 안정적인30fps(프레임 예산33.3ms)를 후보로 두고 대상 기기 실측 후 확정한다. 60fps(16.7ms)는 별도 목표이며 단순 프레임 제한은 한 프레임 계산량을 줄이지 않는다. final 렌더링은 원본 품질을 보존한다.

## 6. 계측 시 주의·간단한 분리 실험

- RAF 간격 p50/p95와 긴 프레임, CPU 업데이트, 초기 build/compile/capture, 전체 프레임 draw/triangles를 분리한다.
- 다중 renderer.render가 있으므로 Three renderer.info 기본 autoReset 상태의 마지막 호출 숫자를 전체 프레임으로 보고하지 않는다. 한 프레임 경계를 정해 누적 후 초기화한다.
- EXT_disjoint_timer_query_webgl2 사용 가능 시 비동기 GPU 타이밍을 수집하고 disjoint 결과 제외. 불가하면 CPU/draw/픽셀은 대리지표라고 표시한다. 매 프레임 gl.finish/readPixels로 측정하지 않는다.
- 원본 파라미터로 해상도960×540, `ao=0`, `smap=1024`를 각각 따로 비교할 수 있다. 960×540은 픽셀43.75% 감소이지 전체 비용43.75% 감소가 아니다. 해상도에 따라 canvas CSS 크기도 바뀌므로 같은 구도·출력 조건을 기록한다.
- `modules=...`는 대략적 비용 분리용이며 장면·그림자·반사·광원 자체가 달라진다. 최종 품질 동등 비교로 쓰지 않는다. `bloom=0`은 현재 비용 분리 실험으로 유효하지 않다.
- 사용자에게 현재 잘 실행되는 원본이 있으므로 이번 검토에서 새 GPU 장면을 중복 실행하지 않았다. 코드 수정·자동 품질 저하도 하지 않았다.

## 공식 기술 근거

- [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices): blocking API 회피, 픽셀/메모리 예산, batching, parallel compile, mipmap.
- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html): renderer 옵션과 다중 패스 통계 관리. 버전별 동작은 로컬 Three0.186.1 소스를 함께 확인했다.


## 2026-10-16 구현 후속

사용자의 “모두 해봐” 승인으로 로컬 실시간 최적화를 적용했다. 위 원본 분석/복제 시점 이후 소스가 변경되었으므로 현재 파일은 원본 해시와 일치하지 않는다. 적용 범위·최종 측정·제외한 후보·남은 한계는 [OPTIMIZATION_RESULTS.md](OPTIMIZATION_RESULTS.md)를 참조한다.
