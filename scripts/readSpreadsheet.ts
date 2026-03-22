/**
 * Script to read Excel spreadsheet and output JSON data for testing
 * Run with: npx tsx scripts/readSpreadsheet.ts
 */

import XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const XLSX_PATH = path.join(__dirname, '../test_tables/ShabTzak Data.xlsx')
const OUTPUT_PATH = path.join(__dirname, '../test_tables/spreadsheet_data.json')

interface SheetData {
  [sheetName: string]: Record<string, unknown>[]
}

function readSpreadsheet(): SheetData {
  console.log(`Reading: ${XLSX_PATH}`)

  const workbook = XLSX.readFile(XLSX_PATH)
  const result: SheetData = {}

  console.log(`\nFound ${workbook.SheetNames.length} sheets:`)
  workbook.SheetNames.forEach(name => console.log(`  - ${name}`))

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
    result[sheetName] = jsonData as Record<string, unknown>[]
    console.log(`\n=== ${sheetName} (${jsonData.length} rows) ===`)

    // Show headers and first few rows
    if (jsonData.length > 0) {
      const headers = Object.keys(jsonData[0] as object)
      console.log(`Headers: ${headers.join(', ')}`)
      console.log('First 3 rows:')
      jsonData.slice(0, 3).forEach((row, i) => {
        console.log(`  ${i + 1}: ${JSON.stringify(row)}`)
      })
    }
  }

  return result
}

function main() {
  try {
    const data = readSpreadsheet()

    // Write to JSON file
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2))
    console.log(`\n✅ Data written to: ${OUTPUT_PATH}`)

    // Summary
    console.log('\n=== SUMMARY ===')
    for (const [sheet, rows] of Object.entries(data)) {
      console.log(`${sheet}: ${rows.length} rows`)
    }
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
