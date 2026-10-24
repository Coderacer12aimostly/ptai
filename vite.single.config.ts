// Builds the whole app into ONE self-contained index.html (dist-single/index.html).
// Run: pnpm build:single
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'node:path'
import fs from 'node:fs'

const favicon = 'data:image/svg+xml;base64,' + fs.readFileSync(path.resolve(__dirname, 'public/favicon.svg')).toString('base64')
const shell = {
  name: 'papertech-single-shell',
  transformIndexHtml(html: string) {
    return html
      .replace('<!-- figma:lang -->', 'en')
      .replace('<!-- figma:title -->', 'Paper Tech AI — private, on-device AI for research and writing')
      .replace('<!-- figma:head-end -->', `<meta name="description" content="Paper Tech AI runs right in your browser, so your work stays on your device." /><meta name="theme-color" content="#1f1f22" /><link rel="icon" href="${favicon}" />`)
      .replace(/<!-- figma:[a-z-]+ -->/g, '')
  },
}

export default defineConfig({
  base: './',
  plugins: [shell, react(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true })],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  define: { 'import.meta.env.VITE_NO_SW': JSON.stringify('1'), 'import.meta.env.VITE_LLM_MAIN_THREAD': JSON.stringify('1') },
  build: { outDir: 'dist-single', emptyOutDir: true, assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 100_000 },
})
