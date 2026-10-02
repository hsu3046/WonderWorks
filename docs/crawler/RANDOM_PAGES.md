# 랜덤 탐색 페이지 — 2026-10-03

원본 복제와 표시를 검사한 후보 187개 중, 36개 출처의 텍스트 페이지 100개를 선정했다. 한국어 19개와 영문 81개다. 출처는 아래 원문 링크에서 확인할 수 있다. 글 본문과 원본 이미지·폰트는 소스 묶음에 저장하지 않는다.

## 선정 기준

- 기존 원본 보기 렌더러로 실제 HTTP(S) 로딩과 DOM/CSS 복제를 완료한 페이지.
- 데스크톱 서식지 1060×534에서 복제 화면의 텍스트가 좌우 화면 밖으로 잘리지 않고 큰 고정 팝업이 없는 페이지.
- 원본 캡처의 리소스 실패·DOM/높이 제한으로 인한 부분 생략 표시가 없는 페이지.
- 화면 문서 기준 최소 297개 단어. 탐색 대상 단어 수는 기존 원본 보기의 4,000개 상한을 따른다.
- 위 조건을 통과한 후보 중 글이 많은 100개를 선택. 에세이, 문학, 웹 역사, 프로그래밍·설명 문서를 포함.

이 검사는 해당 날짜와 폭에서의 로딩·텍스트 배치 검사다. 모든 요소의 픽셀 동일성이나 이후 원본 사이트의 변경을 보장하지 않는다. 모바일에서는 앱의 기존 방식대로 해당 화면 폭으로 새 캡처를 만든다. 사이트가 바뀌거나 접근을 제한하면 기존 본문 fallback 또는 오류 안내를 사용한다.

## 버튼 동작

- `탐색 시작` 바로 옆의 `랜덤`을 누르면 주소가 채워지고 즉시 한 페이지만 탐색한다.
- 한 순회에서 이미 뽑은 페이지는 다시 뽑지 않는다. 현재 페이지와 입력한 주소를 피하고, 남은 후보를 모두 사용하면 다시 순회한다.
- 로딩 중 두 탐색 버튼을 비활성화하며, 실패·취소 후 다시 사용할 수 있다. 앱 시작 시 후보 사이트를 미리 요청하지 않는다.
- 데스크톱에서는 URL 입력과 버튼들을 한 줄에 표시하고, 좁은 화면에서는 주소 아래에 두 버튼을 나란히 배치한다.

## 목록

| # | 원문 페이지 | 언어 | 표시된 문서의 단어 수 |
| --- | --- | --- | ---: |
| 1 | [Adactio: Journal—Gaeilge sa Ghréig](https://adactio.com/journal/22643) | 영문 | 837 |
| 2 | [Adactio: Journal—Summer’s end](https://adactio.com/journal/22166) | 영문 | 622 |
| 3 | [Adactio: Journal—The summer of ’26](https://adactio.com/journal/22774) | 영문 | 724 |
| 4 | [Adactio: Journal—Think local](https://adactio.com/journal/22778) | 영문 | 3,374 |
| 5 | [Adactio: Journal—Threat models](https://adactio.com/journal/22529) | 영문 | 2,036 |
| 6 | [Adactio: Journal—Twenty five years of writing on adactio.com](https://adactio.com/journal/22781) | 영문 | 2,133 |
| 7 | [Adactio: Journal—Welcome to my world](https://adactio.com/journal/1) | 영문 | 1,270 |
| 8 | [『1000xRESIST』 ⇠ 사색송어](https://ahnheejong.name/articles/1000xresist) | 한국어 | 648 |
| 9 | [『가능한 사랑』 ⇠ 사색송어](https://ahnheejong.name/articles/possible-love) | 한국어 | 1,719 |
| 10 | [계단과 벌판 ⇠ 사색송어](https://ahnheejong.name/articles/stairway-and-field) | 한국어 | 591 |
| 11 | [떠날 준비, 돌아가며 ⇠ 사색송어](https://ahnheejong.name/articles/always-leaving-always-returning) | 한국어 | 641 |
| 12 | [빌라쥬 드 아난티 ⇠ 사색송어](https://ahnheejong.name/articles/village-de-ananti) | 한국어 | 1,224 |
| 13 | [씁쓸한 하루, 달콤한 집 ⇠ 사색송어](https://ahnheejong.name/articles/bitter-day-sweet-home) | 한국어 | 658 |
| 14 | [500 Lines or LessIntroduction](https://aosabook.org/en/500L/introduction.html) | 영문 | 2,270 |
| 15 | [Beej's Guide to Network Programming](https://beej.us/guide/bgnet/html/split/intro.html) | 영문 | 2,135 |
| 16 | [Attention is your scarcest resource \| benkuhn.net](https://www.benkuhn.net/attention/) | 영문 | 2,188 |
| 17 | [In defense of blub studies \| benkuhn.net](https://www.benkuhn.net/blub/) | 영문 | 4,151 |
| 18 | [No one can teach you to have conviction \| benkuhn.net](https://www.benkuhn.net/conviction/) | 영문 | 1,698 |
| 19 | [To listen well, get curious \| benkuhn.net](https://www.benkuhn.net/listen/) | 영문 | 2,039 |
| 20 | [River: a Fast, Robust Job Queue for Go + Postgres — brandur.org](https://brandur.org/river) | 영문 | 1,740 |
| 21 | [The Minimum Viable Unit of Saleable Software — brandur.org](https://brandur.org/minimum-viable-unit) | 영문 | 1,481 |
| 22 | [Building LLMs is probably not going be a brilliant business](https://calpaterson.com/porter.html) | 영문 | 2,139 |
| 23 | [Dependency cooldowns turn you into a free-rider](https://calpaterson.com/deps.html) | 영문 | 1,880 |
| 24 | [Is Tesla really more valuable than Toyota?](https://calpaterson.com/singleton.html) | 영문 | 1,770 |
| 25 | [The Internet Classics Archive \| Apology by Plato](https://classics.mit.edu/Plato/apology.html) | 영문 | 11,464 |
| 26 | [Clojure - Rationale](https://clojure.org/about/rationale) | 영문 | 972 |
| 27 | [Introduction · Crafting Interpreters](https://craftinginterpreters.com/introduction.html) | 영문 | 3,697 |
| 28 | [Bug blindness](https://danluu.com/bug-blind/) | 영문 | 6,888 |
| 29 | [The benchmarkpocalypse](https://danluu.com/benchpocalypse/) | 영문 | 3,891 |
| 30 | [There's no point at which turning your brain off will work](https://danluu.com/brain-off/) | 영문 | 3,191 |
| 31 | [There's no reason for software to be slow anymore](https://danluu.com/perf-opt/) | 영문 | 4,879 |
| 32 | [Debian -- Our Philosophy: Why we do it and how we do it](https://www.debian.org/intro/philosophy) | 영문 | 586 |
| 33 | [1. Whetting Your Appetite — Python 3.14.8 documentation](https://docs.python.org/3/tutorial/appetite.html) | 영문 | 875 |
| 34 | [The circus freaks of open source](https://drewdevault.com/blog/Circus-freaks-of-FOSS/) | 영문 | 1,523 |
| 35 | [Why is Hacker News like that?](https://drewdevault.com/blog/Why-is-HN-like-that/) | 영문 | 3,593 |
| 36 | [Introduction :: Eloquent JavaScript](https://eloquentjavascript.net/00_intro.html) | 영문 | 3,039 |
| 37 | [Don't you mean extinct?](https://fabiensanglard.net/extinct/index.html) | 영문 | 2,006 |
| 38 | [My agent.md to improve LLM-assisted code quality](https://fabiensanglard.net/agent.md/index.html) | 영문 | 1,073 |
| 39 | [Architecture, Performance, and Games · Introduction · Game Programming Patterns](https://gameprogrammingpatterns.com/architecture-performance-and-games.html) | 영문 | 3,667 |
| 40 | [Introduction · Game Programming Patterns](https://gameprogrammingpatterns.com/introduction.html) | 영문 | 2,479 |
| 41 | [Introduction: Why Lisp?](https://gigamonkeys.com/book/introduction-why-lisp.html) | 영문 | 4,437 |
| 42 | [The GNU Manifesto - GNU Project - Free Software Foundation](https://www.gnu.org/gnu/manifesto.html) | 영문 | 4,869 |
| 43 | [What is Free Software? - GNU Project - Free Software Foundation](https://www.gnu.org/philosophy/free-sw.html) | 영문 | 4,089 |
| 44 | [Examples for the tcpdump and dig man pages](https://jvns.ca/blog/2026/03/10/examples-for-the-tcpdump-and-dig-man-pages/) | 영문 | 754 |
| 45 | [Learning a few things about running SQLite](https://jvns.ca/blog/2026/07/17/learning-about-running-sqlite/) | 영문 | 1,124 |
| 46 | [Links to CSS colour palettes](https://jvns.ca/blog/2026/05/04/css-colour-palettes/) | 영문 | 360 |
| 47 | [Moving away from Tailwind, and learning to structure my CSS](https://jvns.ca/blog/2026/05/15/moving-away-from-tailwind--and-learning-to-structure-my-css-/) | 영문 | 2,170 |
| 48 | [Some more things about Django I've been enjoying](https://jvns.ca/blog/2026/07/21/more-nice-django-things/) | 영문 | 1,738 |
| 49 | [Testing Vue components in the browser](https://jvns.ca/blog/2026/05/02/testing-vue-components-in-the-browser/) | 영문 | 1,825 |
| 50 | [감자 - 위키문헌, 우리 모두의 도서관](https://ko.wikisource.org/wiki/%EA%B0%90%EC%9E%90) | 한국어 | 1,747 |
| 51 | [동백꽃 - 위키문헌, 우리 모두의 도서관](https://ko.wikisource.org/wiki/%EB%8F%99%EB%B0%B1%EA%BD%83) | 한국어 | 1,979 |
| 52 | [메밀꽃 필 무렵 - 위키문헌, 우리 모두의 도서관](https://ko.wikisource.org/wiki/%EB%A9%94%EB%B0%80%EA%BD%83_%ED%95%84_%EB%AC%B4%EB%A0%B5) | 한국어 | 2,215 |
| 53 | [벙어리 삼룡이 - 위키문헌, 우리 모두의 도서관](https://ko.wikisource.org/wiki/%EB%B2%99%EC%96%B4%EB%A6%AC_%EC%82%BC%EB%A3%A1%EC%9D%B4) | 한국어 | 2,201 |
| 54 | [봄봄 - 위키문헌, 우리 모두의 도서관](https://ko.wikisource.org/wiki/%EB%B4%84%EB%B4%84) | 한국어 | 3,075 |
| 55 | [술 권하는 사회 - 위키문헌, 우리 모두의 도서관](https://ko.wikisource.org/wiki/%EC%88%A0_%EA%B6%8C%ED%95%98%EB%8A%94_%EC%82%AC%ED%9A%8C) | 한국어 | 2,899 |
| 56 | [운수 좋은 날 - 위키문헌, 우리 모두의 도서관](https://ko.wikisource.org/wiki/%EC%9A%B4%EC%88%98_%EC%A2%8B%EC%9D%80_%EB%82%A0) | 한국어 | 2,860 |
| 57 | [week1](https://math.ucr.edu/home/baez/week1.html) | 영문 | 1,732 |
| 58 | [Better Batteries](https://matklad.github.io/2026/08/20/better-batteries.html) | 영문 | 337 |
| 59 | [Cancelation Terminology](https://matklad.github.io/2026/08/31/cancelation-terminology.html) | 영문 | 1,117 |
| 60 | [Rust Glancer](https://matklad.github.io/2026/08/21/rust-glancer.html) | 영문 | 947 |
| 61 | [Static Allocation, Constant Work](https://matklad.github.io/2026/09/02/static-allocation-constant-work.html) | 영문 | 1,344 |
| 62 | [Zig's Io.Threaded is Neat](https://matklad.github.io/2026/08/06/neat-io-threaded.html) | 영문 | 1,043 |
| 63 | [A custom virtual machine for the Stars! 4X game](https://nullprogram.com/blog/2026/09/17/) | 영문 | 1,250 |
| 64 | [Concurrent, atomic MSI hash tables](https://nullprogram.com/blog/2026/05/06/) | 영문 | 997 |
| 65 | [Examples of quick hash tables and dynamic arrays in C](https://nullprogram.com/blog/2025/01/19/) | 영문 | 3,130 |
| 66 | [I have officially retired from Emacs](https://nullprogram.com/blog/2026/04/26/) | 영문 | 724 |
| 67 | [My Journey with Touch Typing and Vim](https://nullprogram.com/blog/2017/04/01/) | 영문 | 1,289 |
| 68 | [The quick and practical "MSI" hash table](https://nullprogram.com/blog/2022/08/08/) | 영문 | 2,564 |
| 69 | [What's been going on in w64devkit the past year](https://nullprogram.com/blog/2026/09/20/) | 영문 | 2,029 |
| 70 | [Server Driven UI 설계를 통한 UI 유연화](https://parksb.github.io/article/38.html) | 한국어 | 1,623 |
| 71 | [소프트웨어 개발을 공학으로 만드는 것](https://parksb.github.io/article/44.html) | 한국어 | 2,304 |
| 72 | [철도 시간표가 유닉스 시간이 되기까지](https://parksb.github.io/article/39.html) | 한국어 | 2,606 |
| 73 | [함수형 프로그래밍의 설득력](https://parksb.github.io/article/40.html) | 한국어 | 2,186 |
| 74 | [How Universities Should Prepare Founders](https://paulgraham.com/prepare.html) | 영문 | 2,917 |
| 75 | [How to Convert Between Wealth and Income Tax](https://paulgraham.com/winc.html) | 영문 | 700 |
| 76 | [How to Earn a Billion Dollars](https://paulgraham.com/earn.html) | 영문 | 2,363 |
| 77 | [How to Lose Time and Money](https://paulgraham.com/selfindulgence.html) | 영문 | 684 |
| 78 | [Making Startups Powerful](https://paulgraham.com/powerful.html) | 영문 | 2,946 |
| 79 | [PostgreSQL: Documentation: 18: 2.2. Concepts](https://www.postgresql.org/docs/current/tutorial-concepts.html) | 영문 | 297 |
| 80 | [Typography in ten minutes \| Butterick’s Practical Typography](https://practicaltypography.com/typography-in-ten-minutes.html) | 영문 | 490 |
| 81 | [What is Python? Executive Summary \| Python.org](https://www.python.org/doc/essays/blurb/) | 영문 | 455 |
| 82 | ['자바스크립트는 왜 그 모양일까?' 읽기](https://rinae.dev/posts/how-javascript-works-summary) | 한국어 | 2,696 |
| 83 | [100권의 책을 스캔했다, 그리고 단 한 권도 읽지 않았다](https://rinae.dev/posts/scanned-100-books-read-none) | 한국어 | 881 |
| 84 | [Claude Opus 5.5, GPT-6 Sol, GPT-6 Luna, and a new price war](https://simonwillison.net/2026/Sep/22/opus-and-sol-and-luna/) | 영문 | 1,348 |
| 85 | [More books on this subject \| Derek Sivers](https://sive.rs/u61) | 영문 | 440 |
| 86 | [Appropriate Uses For SQLite](https://sqlite.org/whentouse.html) | 영문 | 2,470 |
| 87 | [Most Widely Deployed SQL Database Engine](https://sqlite.org/mostdeployed.html) | 영문 | 377 |
| 88 | [File Transfer with SSH, Tee and Base64 - Susam Pal](https://susam.net/file-transfer-with-ssh-tee-and-base64.html) | 영문 | 590 |
| 89 | [Global Palindrome Day - Susam Pal](https://susam.net/global-palindrome-day.html) | 영문 | 511 |
| 90 | [Import Readline - Susam Pal](https://susam.net/import-readline.html) | 영문 | 788 |
| 91 | [Microcentury - Susam Pal](https://susam.net/microcentury.html) | 영문 | 905 |
| 92 | [Peculiar Self-References - Susam Pal](https://susam.net/peculiar-self-references.html) | 영문 | 662 |
| 93 | [ongoing by Tim Bray · Canceling Emily](https://www.tbray.org/ongoing/When/202x/2026/09/08/Emily-Got-Canceled) | 영문 | 564 |
| 94 | [ongoing by Tim Bray · Clankers and Data Races](https://www.tbray.org/ongoing/When/202x/2026/09/01/Un-Racing) | 영문 | 1,281 |
| 95 | [ongoing by Tim Bray · Five Views of the Wilcox Prairie](https://www.tbray.org/ongoing/When/202x/2026/08/17/Prairie-Views) | 영문 | 531 |
| 96 | [ongoing by Tim Bray · Regulate and Standardize AI? Nope.](https://www.tbray.org/ongoing/When/202x/2026/09/18/On-Regulating-AI) | 영문 | 835 |
| 97 | [ongoing by Tim Bray · Text Watermarking](https://www.tbray.org/ongoing/When/202x/2026/08/24/Text-Watermarking) | 영문 | 1,164 |
| 98 | [ongoing by Tim Bray · The Purpose Isn’t What It Does](https://www.tbray.org/ongoing/When/202x/2026/09/24/The-Purpose-Isnt-What-It-Does) | 영문 | 1,047 |
| 99 | [Hypertext Style: Cool URIs don't change.](https://www.w3.org/Provider/Style/URI) | 영문 | 3,070 |
| 100 | [The original proposal of the WWW, HTMLized](https://www.w3.org/History/1989/proposal.html) | 영문 | 4,927 |
