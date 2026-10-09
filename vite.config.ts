import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // Relative asset paths: the APK serves the build from a local folder, not a web root.
  base: './',
  build: { target: 'es2022' },
  // The pothole model runs in a worker (src/features/vision/groundWorker.ts); its runtime needs a module worker.
  worker: { format: 'es' },
})
