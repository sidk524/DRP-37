import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '')
    const proxyTarget = (env.VITE_WEB_SERVER_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')

    return {
        plugins: [react()],
        root: 'src/renderer',
        publicDir: fileURLToPath(new URL('public', import.meta.url)),
        envDir: fileURLToPath(new URL('.', import.meta.url)),
        base: './',
        build: {
            outDir: '../../dist',
            emptyOutDir: true,
        },
        server: {
            port: 5173,
            proxy: {
                '/api': {
                    target: proxyTarget,
                    changeOrigin: true,
                },
            },
        },
    }
})