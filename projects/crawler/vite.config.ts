import { defineConfig } from 'vite';
import { crawlerApi } from './server/plugin.mjs';

export default defineConfig({ plugins: [crawlerApi()] });
