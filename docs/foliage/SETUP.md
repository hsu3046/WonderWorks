# Setup

Development: `npm --prefix projects/foliage run dev` on port 4178. Existing project-local Three.js/Vite/TypeScript installation is reused via the same workspace symlink pattern as Chroma and Harbor; no packages installed globally.

Validation: `npm --prefix projects/foliage run test` and `npm --prefix projects/foliage run build`.

Gallery: build foliage first, then `npm --prefix projects/gallery run prepare:works`. Static artifact is served at `/experiments/foliage/index.html`. Gallery hover uses a single shared MP4 player, preserving reset-on-leave behaviour and avoiding multiple live 3D renderers.
