import { serve } from '@hono/node-server'
import { env } from './config/env'
import { createApp } from './app'

const app = createApp()

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Bingoo API listening on http://localhost:${info.port} (${env.NODE_ENV})`)
})
