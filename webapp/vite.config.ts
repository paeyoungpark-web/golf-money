// webapp/vite.config.ts
import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    build({
      entry: 'src/index.tsx', // 빌드 시 API 서버 코드로 사용할 파일 지정
    }),
    devServer({
      adapter,
      entry: 'src/index.tsx'
    })
  ]
})
