interface ErrorMessageShape {
  data?: {
    code?: string
    message?: string
  }
  message?: string
}

function getErrorShape(error: unknown): ErrorMessageShape | null {
  if (!error || typeof error !== 'object') {
    return null
  }

  return error
}

export function getErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  const candidate = getErrorShape(error)

  if (candidate?.data?.message) {
    return candidate.data.message
  }

  if (candidate?.message) {
    return candidate.message
  }

  return fallbackMessage
}

export function hasErrorCode(error: unknown, code: string): boolean {
  return getErrorShape(error)?.data?.code === code
}
