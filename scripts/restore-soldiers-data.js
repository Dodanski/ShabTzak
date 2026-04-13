#!/usr/bin/env node
/**
 * Restore Soldiers tab data from test_tables/ShabTzak Data.xlsx
 * to test_tables/spreadsheet_data.json
 */

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const XLSX_PATH = path.join(__dirname, '..', 'test_tables', 'ShabTzak Data.xlsx');
const JSON_PATH = path.join(__dirname, '..', 'test_tables', 'spreadsheet_data.json');

console.log('Reading xlsx file:', XLSX_PATH);
const workbook = XLSX.readFile(XLSX_PATH);

// Find the Soldiers sheet
const soldierSheetName = workbook.SheetNames.find(name =>
  name.toLowerCase().includes('soldier') || name === 'Soldiers'
);

if (!soldierSheetName) {
  console.error('ERROR: Could not find Soldiers sheet in xlsx file');
  console.error('Available sheets:', workbook.SheetNames);
  process.exit(1);
}

console.log('Found Soldiers sheet:', soldierSheetName);

// Convert sheet to JSON
const worksheet = workbook.Sheets[soldierSheetName];
const soldiersData = XLSX.utils.sheet_to_json(worksheet);

console.log(`Extracted ${soldiersData.length} soldiers from xlsx`);
console.log('Sample soldier:', JSON.stringify(soldiersData[0], null, 2));

// Read existing spreadsheet_data.json
console.log('\nReading spreadsheet_data.json:', JSON_PATH);
const spreadsheetData = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

// Backup original
const backupPath = JSON_PATH + '.backup.' + Date.now();
console.log('Creating backup:', backupPath);
fs.writeFileSync(backupPath, JSON.stringify(spreadsheetData, null, 2));

// Replace Soldiers tab
spreadsheetData.Soldiers = soldiersData;

// Write updated data
console.log('\nWriting updated spreadsheet_data.json...');
fs.writeFileSync(JSON_PATH, JSON.stringify(spreadsheetData, null, 2));

console.log(`\n✅ SUCCESS: Replaced Soldiers tab with ${soldiersData.length} soldiers from xlsx`);
console.log(`Backup saved to: ${backupPath}`);
