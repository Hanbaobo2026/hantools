import { defineConfig } from 'vite';

// 主站构建：代码分割 + 工具按需加载。
// 部署目标为 Cloudflare Workers Static Assets（dist 目录）。
export default defineConfig({
  base: '/',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    cssCodeSplit: true,
    sourcemap: false,
    reportCompressedSize: true,
  },
  server: {
    port: 5173,
  },
});
