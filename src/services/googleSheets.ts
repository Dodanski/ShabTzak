const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const MAX_RETRIES = 5  // Increased from 3 to handle sustained rate limiting
const BASE_DELAY_MS = 1000 // Start with 1s delay (increased from 500ms)

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = MAX_RETRIES,
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if it's a 429 (Too Many Requests) error
      if (!lastError.message.includes('429') || attempt === maxRetries) {
        // If not a rate limit error or we've exhausted retries, throw
        if (!lastError.message.includes('429')) throw lastError
        if (attempt === maxRetries) throw lastError
      }

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      const delay = BASE_DELAY_MS * Math.pow(2, attempt)
      console.warn(`[API Rate Limited] Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`)
      await sleep(delay)
    }
  }

  throw lastError
}

export class GoogleSheetsService {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  /**
   * Get spreadsheet metadata
   */
  async getSpreadsheet(spreadsheetId: string) {
    const url = `${SHEETS_API_BASE}/${spreadsheetId}`
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch spreadsheet: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Get values from a range
   */
  async getValues(spreadsheetId: string, range: string): Promise<any[][]> {
    return retryWithBackoff(async () => {
      const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}`
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      })

      if (!response.ok) {
        const statusText = `${response.status} ${response.statusText}`
        throw new Error(`Failed to fetch values: ${statusText}`)
      }

      const data = await response.json()
      return data.values || []
    })
  }

  /**
   * Update values in a range
   */
  async updateValues(
    spreadsheetId: string,
    range: string,
    values: any[][]
  ): Promise<void> {
    return retryWithBackoff(async () => {
      const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}?valueInputOption=RAW`
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      })

      if (!response.ok) {
        const statusText = `${response.status} ${response.statusText}`
        throw new Error(`Failed to update values: ${statusText}`)
      }
    })
  }

  /**
   * Append values to a sheet
   */
  async appendValues(
    spreadsheetId: string,
    range: string,
    values: any[][]
  ): Promise<void> {
    return retryWithBackoff(async () => {
      const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}:append?valueInputOption=RAW`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      })

      if (!response.ok) {
        const statusText = `${response.status} ${response.statusText}`
        throw new Error(`Failed to append values: ${statusText}`)
      }
    })
  }

  /**
   * Create a new spreadsheet
   */
  async createSpreadsheet(title: string) {
    const url = SHEETS_API_BASE
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title },
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to create spreadsheet: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Get list of sheet (tab) titles in a spreadsheet
   */
  async getSheetTitles(spreadsheetId: string): Promise<string[]> {
    const spreadsheet = await this.getSpreadsheet(spreadsheetId)
    return (spreadsheet.sheets ?? []).map(
      (s: { properties: { title: string } }) => s.properties.title
    )
  }

  /**
   * Clear values in a range
   */
  async clearValues(spreadsheetId: string, range: string): Promise<void> {
    const encodedRange = encodeURIComponent(range)
    const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodedRange}:clear`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    if (!response.ok) throw new Error(`Failed to clear range: ${response.statusText}`)
  }

  /**
   * Execute a batchUpdate on a spreadsheet (e.g. add sheets)
   */
  async batchUpdate(spreadsheetId: string, requests: object[]): Promise<void> {
    const url = `${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    })

    if (!response.ok) {
      throw new Error(`Failed to batch update: ${response.statusText}`)
    }
  }
}
