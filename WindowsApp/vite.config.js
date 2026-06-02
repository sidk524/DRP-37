import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
    plugins: [react()],
    root: 'src/renderer',
    // .env lives in the WindowsApp root, but `root` is src/renderer — without
    // this, Vite looks for .env in src/renderer and the Supabase vars never load.
    envDir: fileURLToPath(new URL('.', import.meta.url)),
    base: './',
    build: {
        outDir: '../../dist',
        emptyOutDir: true,
    },
    server: {
        port: 5173,
    }
})