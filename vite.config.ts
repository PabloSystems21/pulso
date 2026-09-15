import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' permite servir el build desde cualquier ruta (Netlify, Vercel, GitHub Pages)
export default defineConfig({
  plugins: [react()],
  base: './',
})
