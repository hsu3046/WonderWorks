# 실행과 검증

## 실행

필요 조건: Python 3, WebGL2 지원 브라우저, 외부 CDN 및 Google Fonts 연결.

작업 공간 루트에서 실행:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory projects/shabon
```

<http://127.0.0.1:4173/>을 연다. 4173 포트가 이미 사용 중이면 다른 포트를 명시하고 같은 포트의 URL을 연다. 서버는 로컬 루프백에만 바인딩한다.

이 명령은 `projects/shabon/`을 웹 루트로 사용한다. 나중에 정적 호스팅할 때도 해당 폴더를 배포 루트로 사용하면 된다. npm 설치, 앱 서버, 환경변수는 필요하지 않다.

## 사용자가 확인할 시나리오

1. 로딩 뒤 풍경과 세로 제목이 나타나는지 확인한다.
2. 화면을 클릭하고 방울을 불어 시점이 내부로 들어가는지 확인한다.
3. 드래그로 둘러보고, Esc로 일시정지 후 계속한다.
4. 메뉴의 소리 전환과 M 키를 확인한다. 실제 스피커로 바람·음악·불기·터짐 소리를 듣는다.
5. 메뉴에서 처음부터를 선택하고 다른 장소로 돌아오는지 확인한다.
6. 실제 모바일에서 탭·드래그·회전·메뉴를 확인한다. 에뮬레이션 결과만으로 모바일 GPU·음질·발열을 판단하지 않는다.

## 검증 상태

실행 검증 결과는 [검증 기록](validation/RESULTS.md)에 정리했다. 원본 41개 파일의 해시 일치, JavaScript 39개 구문 검사, 실제 GPU에서의 화면·비행·오디오 시작·메뉴 키보드 조작·세로 화면·전체 순환을 확인했다. 실제 모바일 및 스피커 청취는 별도 확인이 필요하다.

원본 파일 목록과 SHA-256은 `docs/shabon-source-manifest.json`에 기록되어 있다. 원본 수정이 필요한 경우 먼저 현상을 재현하고 원인을 확인한 뒤, 변경 이유와 파일을 `DECISIONS.md`에 추가한다.

## Fish 실행·확인

```sh
cd projects/fish
npm ci
npm run dev
```

[4174 미리보기](http://127.0.0.1:4174/). `npm run check`, `npm run build`, `npm run preview`를 제공한다. WebGPU가 가능한 브라우저와 HTTPS/localhost가 필요하다. 환경변수나 API 키는 없다.

1. 휠을 양방향으로 스크롤해 가까운 물고기와 전체 군집을 확인한다.
2. 포인터를 움직여 분산을 보고 클릭해 충격파를 만든다.
3. 수동 카메라로 시작하는지 확인하고 C를 눌러 자동 카메라가 군집 안으로 이동하는지 본다. 휠/드래그로 수동 조작을 시작하고 C로 자동 이동을 재개한다. R 초기화, Space 정지/재개, H 패널 숨김도 확인한다.
4. 오른쪽 위 패널에서 빛·안개·유영 속도·밝기를 조절한다.
5. 실제 모바일에서 탭·핀치·취소 동작을 확인한다. 자동 세로 화면 검증은 실제 모바일 GPU/터치를 대신하지 않는다.

검증 세부: [fish 결과](validation/fish/RESULTS.md).

## Gallery

`cd projects/gallery && npm run dev` → http://127.0.0.1:4175/ . 현재는 fish/node_modules를 symlink로 재사용. 새 환경은 `npm ci`. `npm run build`는 strict TypeScript 검사와 정적 빌드를 실행한다.

복사 작품 갱신: fish 빌드 → gallery에서 `npm run prepare:works`. 다운로드 소스에는 실행 복사본이 포함되어 있어 단독 실행에는 이 단계가 필요 없다.

사용자 확인: 카드에 마우스를 올려 영상 프리뷰, 카드 클릭 시 작품 페이지 직접 이동, Fruit Jelly의 Citrus/Watermelon 전환과 링크 동기화, 메인 Download source, 인라인 Credits and licenses. 작품 페이지에서 휠·드래그/젤리 변형을 확인한다. 실제 모바일의 터치·발열 검증은 별도 필요.

## Harbor

`cd projects/harbor && npm run dev` → http://127.0.0.1:4177 . Build harbor before gallery prepare:works. Details: `harbor/SETUP.md`.

## Web Crawler

`npm run dev --prefix projects/crawler` → [http://127.0.0.1:4183](http://127.0.0.1:4183). Reuses the repository's shared Vite/TypeScript installation; no added runtime package or API key. `npm run preview --prefix projects/crawler` also serves the reader API. The root build/check/source packaging includes the new study.

User checks: open the sample, click a word, switch to sentence mode, add two more spiders, change speed, pause/resume, scroll to Korean text, restore the page, enter a public article URL, follow a discovered link, and open the original with ↗. Invalid/blocked addresses should show an error and retain the current page. Check touch scrolling, pause and portrait/landscape changes on a physical phone; desktop Chromium touch emulation does not verify native iOS behavior.

Original-design capture optionally reuses an installed Playwright runtime and Chromium. In the crawler project, copy `.env.example` to `.env.local` and set `CRAWLER_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs`. For gallery preview or a deployed Node process, set the same server environment variable there. It is never exposed to client code. No runtime is automatically installed; without it, live URLs fall back to reader view.

Original-view checks: load a styled public page, inspect its image/font/layout, feed a word, scroll within the captured page, switch original/reader views and restore. Resizing scales the capture; reload the address to capture a different responsive width. Canvas/video/live interactions are outside this static-copy mode.
