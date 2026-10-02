# 프로젝트 메모리

- 2026-09-28: 개별 작품을 먼저 만들고 몇 개 쌓인 뒤 갤러리로 구성한다.
- 첫 작품 `projects/shabon/`은 제공 ZIP의 원본 구조를 유지하는 독립 실행 기준본이다.
- 초기 참조 분석은 정적 분석이다. 실제 검증 결과는 `validation/`을 참조한다.
- 원본의 capture 모드는 누락된 서버 API를 필요로 한다. 일반 감상 실행과 구분한다.
- 원본 라이선스 정보는 제공되지 않았으므로 루트 GPL 적용 범위와 구분한다.

## 2026-09-29 — fish 독립 작품

- 사용자 승인으로 WebGPU + 6,144마리 군집을 `projects/fish/`에 작성. 프로젝트 로컬 의존성 설치도 별도 승인받음.
- 실행 포트 4174, 기존 shabon은 4173 유지. 휠 줌 필수, 포인터 분산·충격파·드래그·핀치 포함.
- 새 TypeScript/절차적 에셋은 GPL v3. 원본 소스 없는 녹화 기반 재현이며 픽셀/알고리즘 동일성을 주장하지 않음.
- 실제 GPU r186 WGSL에서 `active`는 예약어. TSL native function 타입은 callable proxy 정보를 누락하므로 native-shader.ts 한 곳에서 명시 반환 타입 보완.
- grass positionNode는 인스턴스 변환 뒤 실행되므로 뿌리 고정은 uv.y, 변형 크기는 변환된 높이로 계산.
- 검증 결과·제한: docs/validation/fish/RESULTS.md. 갤러리는 여전히 후속 단계.

### Fish v2 — 빛·움직임·카메라 피드백 반영

- 사용자는 첫 fish의 빛·군집 운동·대담한 카메라 워크가 부족하다고 명시. 영상 2초 간격 재분석 후 개선.
- 원통/고리 표면 분포를 고정하지 않도록 회전축·반경·축방향 독립 분포·분리 재결합을 도입. GPU bank로 회전 시 기울기.
- 평면 빛띠 제거 → 깊이 기반 절반 해상도 볼륨광 20샘플 + HDR Bloom. RenderPipeline이 최종 색 변환을 소유.
- 56초 자동 카메라, 군집 내부 통과. 휠·드래그 즉시 수동 인계, C 재개. 모션 축소 설정은 자동 이동 기본 OFF.
- 새 의존성 없음. 기존 three/addons 사용. 검증 기록: docs/validation/fish/v2/RESULTS.md.

## 2026-10-02 — Webcrawler

- `projects/crawler`, 패키지 `vote.aib.wonderworks-crawler`, 포트 4183, 브랜치 `codex/web-crawler`에 구현. 기존 워크트리의 변경 없이 공유 도구만 재사용.
- 제공 영상의 네온 와이어 거미·문장 포식을 Canvas 2D + DOM 좌표 + 8다리 IK로 재현. 단어 클릭, 문장/단어, 거미 1~3, 속도·정지·실 흔적·복원.
- 외부 주소는 원본 스타일/스크립트를 실행하지 않는 본문 재구성. Node 읽기 API를 Vite와 Vercel이 공유하며 DNS pinning, 공개 IPv4, 제한된 크기/시간/리다이렉트 적용. 샘플은 AIB 자체 한·영 문장.
- 갤러리 08, 실제 동작 MP4/첫 프레임 poster, 소스 ZIP, 전체 빌드/타입 검사 통합. 영상 원작자 미확인으로 임의 크레딧 URL을 만들지 않음.
- 타입 검사, 새 API 테스트 8개, 브라우저 시나리오 12개, 전체 빌드 및 production preview 통과. 물리 모바일·배포 미검증. 세부: `docs/crawler/VALIDATION.md`.
