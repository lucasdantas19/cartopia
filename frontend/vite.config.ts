import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // O MapLibre é carregado sob demanda e gera um vendor chunk maior por design.
    chunkSizeWarningLimit: 1200,
  },
})
