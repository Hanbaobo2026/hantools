import { defineConfig } from 'vite';

// 离线单文件构建：把全部工具打进一个 bundle，构建后由
// scripts/inline-offline.mjs 内联进单个 HTML，可下载后双击离线使用。
// 适用场景：CTF 比赛现场断网 / 内网环境。
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist-offline',
    assetsDir: 'assets',
    cssCodeSplit: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'app.js',
        chunkFileNames: 'app.js',
        assetFileNames: 'app.[ext]',
      },
    },
  },
});
