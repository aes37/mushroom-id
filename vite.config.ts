import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the build works from any path (GitHub Pages subfolder, a bucket, or file://).
export default defineConfig({
  base: './',
  plugins: [react()],
})
