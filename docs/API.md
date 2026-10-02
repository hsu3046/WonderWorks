# API와 외부 의존성

Shabon 등 기존 3D 작품의 일반 감상 모드는 애플리케이션 API와 데이터베이스를 사용하지 않는다. Webcrawler의 외부 본문 읽기는 아래의 `/api/crawl`을 사용한다.

- Three.js: `https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js`
- 웹폰트 CSS: Google Fonts, Zen Old Mincho 및 Klee One.
- 로컬 에셋: `assets/leaves.png`.
- 저장: 브라우저 localStorage의 `shabon-muted` 음소거 설정.

원본의 `?capture` 모드는 `/api/video/start`, `/api/video/frame`, `/api/video/end`, `/api/still`, `/api/log`로 POST한다. 이 서버 구현은 제공되지 않았다. 현재 실행용 서버는 정적 파일만 제공하므로 capture 모드를 지원하지 않는다.

원본 `window.__app`은 준비 상태·프레임 수·장면 상태·품질 등을 검사하는 진단용 객체다. 제품의 공개 API 계약으로 취급하지 않는다.

## Fish

외부 API·DB·키·쿠키·저장소 없음. Three.js는 프로젝트 의존성으로 번들에 포함한다. 모든 시각 에셋은 로컬 코드로 생성한다. 개발 서버의 HMR WebSocket을 제외하면 외부 네트워크가 필요하지 않다.

개발 모드의 `window.__fish`는 GPU backend, 마릿수, 프레임·시간, 줌 거리, 충격파 횟수, 렌더 버퍼 크기를 제공하는 진단 getter다. `inspectSimulation()`은 요청 시에만 GPU에서 6,144개 위치/속도를 읽어 유효 개수·경계·속도를 요약한다. 매 프레임 CPU readback은 없다. 배포 빌드에서는 진단 getter를 만들지 않는다.

## Webcrawler

`GET /api/crawl?url=<encoded HTTP(S) address>` returns `{html, url, bytes, view: "reader"}` or `{error}` JSON. The reader uses public IPv4, standard HTTP(S) ports, no credentials/cookies, pinned DNS per redirect, a 12-second deadline, at most three redirects, and a 1.5 MB decompressed HTML limit.

Add `view=original&width=1060&height=534` to request a rendered design snapshot. Width is clamped to 360–1600 and height to 400–1200. Success returns `{html, url, title, links, view: "original", width, height, partial}`. Capture failure or unavailable runtime falls back to reader output plus a user-facing `notice`. Render limits and isolation are documented in [crawler architecture](crawler/ARCHITECTURE.md). Neither view stores browsing history or forwards cookies.

Statuses: 400 invalid/private URL, 403 cross-site browser request, 405 unsupported method, 413 oversized reader page, 422 unsupported content/redirect loop, 429 local API concurrency bound, 502 complete upstream failure. All responses are JSON and no-store. API concurrency is four per process; captures are separately limited to two.

Local dev/preview uses `projects/crawler/server/plugin.mjs`; Vercel uses `api/crawl.mjs`. Original capture requires Playwright plus Chromium on the server, selected by server-only `CRAWLER_PLAYWRIGHT_MODULE`. Static hosting supports the sample only. Deployment is not part of verification. Development-only `window.__crawler` reports word count, consumed count, frame callbacks, playback intent, sample/live source and original/reader view.
