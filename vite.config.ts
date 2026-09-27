import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' permite servir el build desde cualquier ruta (Netlify, Vercel, GitHub Pages)
export default defineConfig({
  plugins: [react()],
  base: './',
  // Puerto fijo para no chocar con otros proyectos en 5173 (strictPort: si está ocupado, avisa en vez de cambiarse)
  server: { port: 5180, strictPort: true },
  preview: { port: 5180, strictPort: true },
})
