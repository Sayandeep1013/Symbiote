import { defineConfig } from 'vite';

// fixed port so it never collides with other local Vite projects on 5173
export default defineConfig({
  server: { port: 5199, strictPort: true },
  preview: { port: 5199, strictPort: true },
});
