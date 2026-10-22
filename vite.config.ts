import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const demo = process.env.VITE_STATIC_DEMO === 'true';
const base = demo ? (process.env.VITE_BASE_PATH || '/wanshi-editor/') : '/';
export default defineConfig({
  base,
  plugins: [demo && {
    name: 'github-pages-public-paths',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!/\.[cm]?[jt]sx?$/.test(id)) return;
      // A few legacy JSX attributes use root URLs. Pages serves a project sub-path.
      return code
        .replace('src={`/api/assets/${a.id}`}', 'src={assetUrl(a)}')
        .replace(/([`'\"])\/(artwork|accessories|scenes|fonts)\//g, `$1${base}$2/`);
    },
  }, react()].filter(Boolean),
  server: { proxy: { '/api': 'http://127.0.0.1:4310' } },
});
