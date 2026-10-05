// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel({
    webAnalytics: { enabled: true },
    // Körperalter-Karte (api/koerperalter-karte.png): satori und resvg laden WebAssembly bzw.
    // ein natives Modul zur Laufzeit, das der Vercel-Bundler sonst nicht mitpackt.
    includeFiles: [
      './node_modules/satori/yoga.wasm',
      './node_modules/harfbuzzjs/hb.wasm',
      './node_modules/@resvg/resvg-js-linux-x64-gnu/resvgjs.linux-x64-gnu.node',
    ],
  }),
});
