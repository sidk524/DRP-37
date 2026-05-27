import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    root: 'src/renderer',        // Tell Vite where your React source is
    base: './',                  // Important for Electron file:// protocol
    build: {
        outDir: '../../dist',      // Output built files here
        emptyOutDir: true,
    },
    server: {
        port: 5173,                // Dev server port
    }
})