import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/masters': 'https://jellingson.azurewebsites.net',
      '/draftpicks': 'https://jellingson.azurewebsites.net',
      '/shotguns': 'https://jellingson.azurewebsites.net',
      '/config': 'https://jellingson.azurewebsites.net',
      '/winprobability': 'https://jellingson.azurewebsites.net',
      '/chat': 'https://jellingson.azurewebsites.net',
      '/hubs': {
        target: 'https://jellingson.azurewebsites.net',
        ws: true,
      },
    },
  },
})
