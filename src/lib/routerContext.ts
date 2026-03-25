import {
  getClientAuthSnapshot,
  sanitizeRedirect,
  type ClientAuthSnapshot,
} from './authRouting'

export interface AppRouterContext {
  auth: {
    getClientSnapshot: () => ClientAuthSnapshot
  }
  redirect: {
    sanitize: typeof sanitizeRedirect
  }
}

export function createRouterContext(): AppRouterContext {
  return {
    auth: {
      getClientSnapshot: getClientAuthSnapshot,
    },
    redirect: {
      sanitize: sanitizeRedirect,
    },
  }
}
