import r2 from '@convex-dev/r2/convex.config.js'
import resend from '@convex-dev/resend/convex.config'
import { defineApp } from 'convex/server'
import { v } from 'convex/values'

const app = defineApp({
  env: {
    CLERK_JWT_ISSUER_DOMAIN: v.string(),
    CLERK_WEBHOOK_SECRET: v.optional(v.string()),
    WEB_APP_URL: v.optional(v.string()),
    NOTIFICATION_FROM_EMAIL: v.optional(v.string()),
    CHAPA_SECRET_KEY: v.optional(v.string()),
    CHAPA_EXPECTED_MODE: v.optional(v.string()),
    APP_BASE_URL: v.optional(v.string()),
    CHAPA_CALLBACK_BASE_URL: v.optional(v.string()),
    CHAPA_BRAND_NAME: v.optional(v.string()),
    CHAPA_FIXED_ETB_PER_USD: v.optional(v.string()),
    CHAPA_WEBHOOK_SECRET: v.optional(v.string()),
    MOBILE_APP_RETURN_URL_BASE: v.optional(v.string()),
  },
})
app.use(resend)
app.use(r2)

export default app
