// Sentry stub — package not installed in this build
// Replace with @sentry/react-native integration when ready

export function initSentry() {
  // no-op
}

export function logError(error: Error, context?: Record<string, any>) {
  console.error('Error:', error, context);
}

export function logMessage(message: string, level = 'info') {
  console.log(`[${level}] ${message}`);
}

export function setUserContext(_userId: string) {
  // no-op
}

export function clearUserContext() {
  // no-op
}
