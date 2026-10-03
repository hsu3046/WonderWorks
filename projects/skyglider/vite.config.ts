import {defineConfig} from 'vite';

export default defineConfig({
  build:{rolldownOptions:{input:{valley:'index.html',character:'character.html'}}},
});
