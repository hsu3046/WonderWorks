# ✳ Wonderworks

## Tagline-en

Step into a little wonder. Play with living 3D worlds, bend soft fruit, and explore the code that brings them to life.

## Tagline-ko

마음에 남은 한 장면을 직접 만질 수 있다면 어떨까요? 비눗방울 속으로 들어가고, 물고기를 따라 헤엄치고, 말랑한 과일을 잡아당겨 보세요. Wonderworks는 빛과 재질, 움직임을 웹에서 다시 만들어 보는 실험실입니다. 작품을 구경하는 데서 끝나지 않고, 코드와 제작 과정을 살펴보며 자신의 아이디어로 이어 갈 수 있습니다.

## Tagline-ja

見ているだけの景色に、そっと触れてみませんか。シャボン玉の中を漂い、魚の泳ぎを追いかけ、柔らかな果物を引っぱってみる。Wonderworksは、光や質感、動きの小さな発見をブラウザーで楽しめる実験室です。気になった作品は仕組みやコードまで開いて、次の「作ってみたい」につなげられます。

## Summary-en

A beautiful animation often leaves you wondering how it works. Wonderworks turns that curiosity into interactive experiments you can explore in a browser. Wander through a water garden, change the seasons, steer a boat or reshape a piece of jelly. Each study includes its techniques, source code and creator credits. Original AIB code is GPL v3; supplied code and third-party assets retain their separate license terms.

## Summary-ko

멋진 그래픽을 보면 “이건 어떻게 만들었을까?”라는 궁금증이 생깁니다. Wonderworks는 그 질문에서 출발해 영상과 웹에서 만난 장면을 직접 조작할 수 있는 작품으로 구현합니다. 연못의 생물을 관찰하거나 계절과 날씨를 바꾸고, 배를 움직이거나 젤리를 변형하며 각 효과를 살펴볼 수 있습니다. 작품마다 기술과 소스, 영감을 준 창작자를 함께 소개합니다. AIB가 새로 작성한 코드는 GPL v3로 공개하며, 제공된 원본 코드와 외부 에셋에는 각각의 라이선스가 적용됩니다.

## Summary-ja

心に残る映像ほど、その裏側をのぞいてみたくなるものです。Wonderworksでは、そんな好奇心をブラウザーで触れる実験に変えています。池の生き物を観察したり、季節と天気を変えたり、舟を動かしたり、ゼリーの形を変えたり。作品ごとに使った技術、ソースコード、着想を得た作者を紹介しています。AIBが制作したコードはGPL v3で公開し、提供された原作コードと外部素材にはそれぞれの利用条件を明記しています。

## ✨ What It Does

- **Explore living worlds** — Open each experiment as a full-screen interactive scene.
- **Preview the movement** — Hover over a card to play real scene footage; moving away resets it to the first frame.
- **Play with materials** — Pull and slice fruit jelly, stir fish shoals and remix flowing geometric forms.
- **Change the atmosphere** — Adjust sunlight, seasons, rain, snow and wind in the landscape studies.
- **Look under the surface** — Read the rendering techniques and download each experiment's source.
- **Follow the inspiration** — Find creator credits and separate asset-license notices alongside every study.

| Experiment | Explore | Main techniques |
| --- | --- | --- |
| Bubble Day | Blow bubbles and drift through a spring landscape | Three.js, WebGL, GLSL |
| Ocean Shoal | Move through a responsive school of 6,144 fish | WebGPU, TSL/WGSL, GPU compute |
| Fruit Jelly | Stretch citrus and cut a watermelon into soft pieces | WebGL2, XPBD, tetrahedral constraints |
| Chroma Motion | Remix continuously morphing shapes | Parametric geometry, GLSL, procedural motion |
| Tidelight Harbor | Steer a boat and watch a whale in changing weather | Blender, glTF, water reflection |
| Through the Seasons | Watch foliage, weather and daylight change | GPU instancing, procedural botany, Web Audio |
| Stillwater | Explore a garden pond, feed fish and startle a leaping frog | Blender morphs, PBR, reflection/refraction |
| Webcrawler | Give wireframe spiders a website and watch them eat its words | Canvas 2D, inverse kinematics, public HTML reader |

## 🚀 Try It Now

[Open Wonderworks](https://wonderworks.vercel.app) · [Source on GitHub](https://github.com/hsu3046/WonderWorks)

## 🛠 Tech Stack

| Layer | Technology |
| --- | --- |
| Language | TypeScript with strict checks; JavaScript for supplied/ported studies |
| Rendering | Three.js 0.186, WebGL2, WebGPU, GLSL, TSL/WGSL |
| Asset authoring | Blender, glTF/GLB, procedural geometry and local PBR maps |
| Build | Vite 8.3.1, TypeScript 7.0.2, Node.js 24+ |
| Gallery | Semantic HTML, CSS, native dialogs, one shared video preview player |
| Search & sharing | Prerendered collection, canonical URLs, sitemap, Open Graph and JSON-LD |
| Hosting | Vercel static gallery + bounded Node reader API for Webcrawler; no API keys required |

Ocean Shoal requires WebGPU and HTTPS or localhost. The other 3D studies require WebGL2. Actual performance varies with GPU and scene complexity. Bubble Day uses external Google Fonts.

## 📦 Installation

```sh
git clone https://github.com/hsu3046/WonderWorks.git
cd WonderWorks
npm run setup
npm run build
npm run dev
```

Open [http://127.0.0.1:4175](http://127.0.0.1:4175).

`setup` installs the pinned, project-local toolchain under `projects/fish` and links the other TypeScript projects to it. `build` compiles the individual studies, prepares their gallery copies, creates source ZIPs and builds the gallery. Generated files are deliberately excluded from Git. Existing media previews and runtime models are included in the repository.

```sh
npm run check       # Strict type checks and fish/frog motion regression tests
npm run build       # All experiments, downloads, static SEO and production gallery
npm run preview     # Serve the production gallery locally
```

For an individual study, run `npm run dev --prefix projects/pond` (or `fish`, `chroma`, `harbor`, `foliage`, `crawler`). Webcrawler runs at [http://127.0.0.1:4183](http://127.0.0.1:4183) and includes a local public-page reader endpoint. Its sample works offline; live URLs require the reader API. Bubble Day and Fruit Jelly are plain static projects. See their own README files for controls.

No secrets are required. To build for a custom public URL, use `PUBLIC_SITE_URL=https://your-domain.example npm run build`. Vercel builds otherwise derive the canonical origin from `VERCEL_PROJECT_PRODUCTION_URL`.

## 📁 Project Structure

```text
├── projects/                  # Independent experiments and the gallery
│   ├── gallery/               # Catalog, sculpture, previews and static SEO
│   ├── shabon/                # Bubble Day, adapted from supplied original code
│   ├── fish/                  # Ocean Shoal and the shared local toolchain
│   ├── jelly/                 # Citrus and Watermelon from AIB's Dani project
│   ├── chroma/                # Parametric motion playground
│   ├── harbor/                # Blender-authored island and boat scene
│   ├── foliage/               # Seasons, weather and procedural vegetation
│   ├── pond/                  # Stillwater, animal models and garden rendering
│   └── crawler/               # Text-eating spiders and a safe public-page reader
├── api/crawl.mjs              # Vercel adapter for Webcrawler's shared reader
├── scripts/                   # Reproducible builds, source archives and checks
├── docs/                      # Architecture, decisions, setup and SEO findings
├── vercel.json                # Static deployment and response headers
├── SOURCE_NOTICE.md           # Supplied-code provenance and license boundaries
└── LICENSE                    # GPL v3 for original AIB implementation code
```

Local reference footage, validation recordings, private working notes, raw supplied asset archives and unused Blender scratch files are not publication inputs. The authored Blender source scenes used by the projects remain under their respective project directories.

## 🗺 Roadmap

- [x] Independent interactive studies with reusable source code
- [x] Growing gallery with reset-on-leave video previews
- [x] Searchable initial HTML, sitemap and social sharing metadata
- [ ] Add new studies and expand technique explanations
- [ ] Continue real-device performance and accessibility validation

## 🤝 Contributing

1. Fork the repository and create a feature branch.
2. Add or modify a study in its own directory. Preserve other experiments.
3. Update `projects/gallery/src/catalog.ts`, the relevant docs and attribution notices.
4. Run `npm run check` and `npm run build`; verify interactions and reduced-motion behavior in a browser.
5. Open a pull request with the change, its visual result and validation notes.

Do not commit generated `dist`, prepared gallery experiments, source ZIPs, API keys or private reference footage. Include the source and license for any added third-party assets.

## 📄 License

Original implementation code, gallery, tools and documentation: [GNU GPL v3](LICENSE), © 2026 **[AIB Inc.](https://www.aib.vote)**.

**This license does not automatically cover everything in the repository.** Bubble Day adapts supplied original code by [@akakuma0219](https://x.com/akakuma0219); its original archive did not specify a license. See [SOURCE_NOTICE.md](SOURCE_NOTICE.md). Do not infer an additional license grant for that supplied code.

Stillwater fish models/textures are by [somitsu](https://sketchfab.com/somitsu), and the frog model/textures are by [ffish.asia / floraZia.com](https://sketchfab.com/ffishAsia-and-floraZia), under **CC BY 4.0**. Poly Haven textures are **CC0**; Three.js is **MIT**. Attribution and modifications are documented in the individual model/texture directories.

Visual inspiration is credited separately from code and asset ownership. See the complete [creator credits](projects/gallery/CREDITS.md).

*Built by [AIB Inc.](https://www.aib.vote) · © 2026 AIB Inc.*
