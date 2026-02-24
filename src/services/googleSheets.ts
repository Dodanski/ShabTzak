const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

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
    const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}`
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch values: ${response.statusText}`)
    }

    const data = await response.json()
    return data.values || []
  }

  /**
   * Update values in a range
   */
  async updateValues(
    spreadsheetId: string,
    range: string,
    values: any[][]
  ): Promise<void> {
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
      throw new Error(`Failed to update values: ${response.statusText}`)
    }
  }

  /**
   * Append values to a sheet
   */
  async appendValues(
    spreadsheetId: string,
    range: string,
    values: any[][]
  ): Promise<void> {
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
      throw new Error(`Failed to append values: ${response.statusText}`)
    }
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
