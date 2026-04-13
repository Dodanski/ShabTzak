#!/usr/bin/env node
/**
 * Update the Soldiers tab in Google Sheets with data from test_tables/ShabTzak Data.xlsx
 *
 * Usage:
 *   node scripts/update-soldiers-sheet.js --token YOUR_OAUTH_TOKEN --spreadsheet-id YOUR_SHEET_ID
 *
 * How to get your OAuth access token:
 *   1. Open the ShabTzak app in your browser
 *   2. Open DevTools (F12) → Network tab
 *   3. Look for any request to sheets.googleapis.com
 *   4. Copy the Authorization header value (without "Bearer ")
 */

import XLSX from 'xlsx';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : null;
};

const token = getArg('--token');
const spreadsheetId = getArg('--spreadsheet-id');
const dryRun = args.includes('--dry-run');

if (!token || !spreadsheetId) {
  console.error('Usage: node scripts/update-soldiers-sheet.js --token YOUR_TOKEN --spreadsheet-id YOUR_SHEET_ID [--dry-run]');
  console.error('\nHow to get your OAuth token:');
  console.error('  1. Open the ShabTzak app in your browser');
  console.error('  2. Open DevTools (F12) → Network tab');
  console.error('  3. Look for requests to sheets.googleapis.com');
  console.error('  4. Copy the Authorization header (without "Bearer ")');
  process.exit(1);
}

const XLSX_PATH = path.join(__dirname, '..', 'test_tables', 'ShabTzak Data.xlsx');

console.log('Reading xlsx file:', XLSX_PATH);
const workbook = XLSX.readFile(XLSX_PATH);
const worksheet = workbook.Sheets['Soldiers'];

if (!worksheet) {
  console.error('ERROR: Soldiers sheet not found in xlsx file');
  console.error('Available sheets:', workbook.SheetNames);
  process.exit(1);
}

// Convert to array of arrays (rows)
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
console.log(`Found ${data.length} rows (including header)`);

if (data.length === 0) {
  console.error('ERROR: No data in Soldiers sheet');
  process.exit(1);
}

console.log('\nHeader row:', data[0]);
console.log('Sample data row:', data[1]);

if (dryRun) {
  console.log('\n--- DRY RUN: showing first 5 rows ---');
  data.slice(0, 5).forEach((row, i) => {
    console.log(`Row ${i}:`, row);
  });
  console.log(`\nWould write ${data.length} rows to Soldiers tab`);
  process.exit(0);
}

// Clear and update the Soldiers sheet
async function updateSheet() {
  const tabName = 'Soldiers';

  // Step 1: Clear the entire Soldiers tab
  console.log('\n1. Clearing Soldiers tab...');
  await clearRange(spreadsheetId, `${tabName}!A:Z`, token);
  console.log('   ✓ Cleared');

  // Step 2: Write all data (header + rows)
  console.log(`\n2. Writing ${data.length} rows to Soldiers tab...`);
  await updateValues(spreadsheetId, `${tabName}!A1`, data, token);
  console.log('   ✓ Written');

  console.log('\n✅ SUCCESS: Soldiers tab updated!');
  console.log(`   Total rows: ${data.length} (1 header + ${data.length - 1} soldiers)`);
}

function clearRange(spreadsheetId, range, token) {
  return new Promise((resolve, reject) => {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`;

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write('{}');
    req.end();
  });
}

function updateValues(spreadsheetId, range, values, token) {
  return new Promise((resolve, reject) => {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;

    const body = JSON.stringify({
      range,
      values,
      majorDimension: 'ROWS'
    });

    const req = https.request(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

updateSheet().catch(err => {
  console.error('\n❌ ERROR:', err.message);
  process.exit(1);
});
