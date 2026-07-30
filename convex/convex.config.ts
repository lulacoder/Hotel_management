import resend from '@convex-dev/resend/convex.config'
import r2 from '@convex-dev/r2/convex.config.js'
import { defineApp } from 'convex/server'

const app = defineApp()
app.use(resend)
app.use(r2)

export default app
