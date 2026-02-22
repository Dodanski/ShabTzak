export const config = {
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  googleApiKey: import.meta.env.VITE_GOOGLE_API_KEY || '',
  spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID || '',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const

export function validateConfig() {
  const missing: string[] = []

  if (!config.googleClientId) missing.push('VITE_GOOGLE_CLIENT_ID')

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}
