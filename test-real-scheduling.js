#!/usr/bin/env node
/**
 * Real Scheduling Test - Connects to actual Google Sheets and tests scheduling
 *
 * Automatically reads from .env.local
 * Usage: node test-real-scheduling.js
 */

import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env.local
const envPath = path.join(__dirname, '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) {
      process.env[key.trim()] = value.trim()
    }
  })
  console.log('✓ Loaded .env.local\n')
} else {
  console.error('❌ .env.local not found!')
  process.exit(1)
}

// Configuration
const API_KEY = process.env.VITE_GOOGLE_API_KEY || ''
const SPREADSHEET_ID = process.env.VITE_SPREADSHEET_ID || ''

if (!API_KEY || !SPREADSHEET_ID) {
  console.error('❌ Missing environment variables in .env.local!')
  console.error('Required:')
  console.error('  VITE_GOOGLE_API_KEY=...')
  console.error('  VITE_SPREADSHEET_ID=...')
  process.exit(1)
}

console.log('📊 Real Scheduling Test')
console.log('='.repeat(60))
console.log(`Spreadsheet ID: ${SPREADSHEET_ID}`)
console.log(`API Key: ${API_KEY.substring(0, 10)}...`)
console.log('='.repeat(60) + '\n')

// Initialize Google Sheets API
const sheets = google.sheets({ version: 'v4', auth: API_KEY })

async function getSheetData(rangeName) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: rangeName,
    })
    return response.data.values || []
  } catch (err) {
    console.error(`❌ Failed to fetch ${rangeName}:`, err.message)
    return []
  }
}

function parseRow(row, headers) {
  const obj = {}
  headers.forEach((header, idx) => {
    obj[header] = row[idx] || ''
  })
  return obj
}

async function runTest() {
  try {
    // Fetch Soldiers
    console.log('📥 Fetching Soldiers...')
    const soldiersRaw = await getSheetData('Soldiers!A:N')
    if (soldiersRaw.length === 0) {
      console.error('❌ No soldiers found')
      return
    }
    const soldierHeaders = soldiersRaw[0]
    const soldiers = soldiersRaw.slice(1).map(row => parseRow(row, soldierHeaders))
    console.log(`✓ Found ${soldiers.length} soldiers`)
    soldiers.slice(0, 3).forEach(s => {
      console.log(`  - ${s.ID || '?'}: ${s.Role || '?'} (${s.Status || '?'}) [${s.ServiceStart || '?'} to ${s.ServiceEnd || '?'}]`)
    })
    if (soldiers.length > 3) console.log(`  ... and ${soldiers.length - 3} more\n`)

    // Fetch Tasks
    console.log('📥 Fetching Tasks...')
    const tasksRaw = await getSheetData('Tasks!A:I')
    if (tasksRaw.length === 0) {
      console.error('❌ No tasks found')
      return
    }
    const taskHeaders = tasksRaw[0]
    const tasks = tasksRaw.slice(1).map(row => parseRow(row, taskHeaders))
    console.log(`✓ Found ${tasks.length} tasks`)
    tasks.slice(0, 3).forEach(t => {
      console.log(`  - ${t.ID || '?'}: ${t.TaskType || '?'} (${t.RoleRequirements || '?'})`)
    })
    if (tasks.length > 3) console.log(`  ... and ${tasks.length - 3} more\n`)

    // Fetch LeaveRequests
    console.log('📥 Fetching LeaveRequests...')
    const requestsRaw = await getSheetData('LeaveRequests!A:H')
    const requests = requestsRaw.length > 1 ? requestsRaw.slice(1) : []
    console.log(`✓ Found ${requests.length} leave requests\n`)

    // Analysis
    console.log('📊 Data Analysis')
    console.log('='.repeat(60))

    // Check soldier roles
    const roles = new Set(soldiers.map(s => s.Role))
    console.log(`\nSoldier Roles: ${Array.from(roles).join(', ')}`)

    // Check task requirements
    console.log(`\nTask Role Requirements:`)
    tasks.forEach(t => {
      if (t.RoleRequirements) {
        console.log(`  ${t.ID}: ${t.RoleRequirements}`)
      }
    })

    // Check service dates
    console.log(`\nService Date Range:`)
    const dates = soldiers.flatMap(s => [s.ServiceStart, s.ServiceEnd]).filter(Boolean)
    if (dates.length > 0) {
      const minDate = dates.sort()[0]
      const maxDate = dates.sort().reverse()[0]
      console.log(`  Min: ${minDate}, Max: ${maxDate}`)
    }

    // Check task dates
    console.log(`\nTask Dates:`)
    const taskDates = tasks.map(t => t.StartTime).filter(Boolean)
    if (taskDates.length > 0) {
      console.log(`  Earliest: ${taskDates.sort()[0]}`)
      console.log(`  Latest: ${taskDates.sort().reverse()[0]}`)
    }

    // Check for potential issues
    console.log(`\n⚠️  Potential Issues:`)
    let issues = 0

    // Check inactive soldiers
    const inactive = soldiers.filter(s => s.Status !== 'Active')
    if (inactive.length > 0) {
      console.log(`  ❌ ${inactive.length} inactive soldiers (won't be scheduled)`)
      issues++
    }

    // Check mismatched roles
    const taskRoles = new Set()
    tasks.forEach(t => {
      if (t.RoleRequirements) {
        // Parse role requirements (format: "Role1:count1, Role2:count2" or similar)
        const roleMatch = t.RoleRequirements.match(/\w+/g)
        if (roleMatch) roleMatch.forEach(r => taskRoles.add(r))
      }
    })
    const unavailableRoles = Array.from(taskRoles).filter(r => !Array.from(roles).includes(r))
    if (unavailableRoles.length > 0) {
      console.log(`  ❌ Tasks require roles not in soldier roster: ${unavailableRoles.join(', ')}`)
      issues++
    }

    // Check date mismatches
    const today = new Date().toISOString().split('T')[0]
    const futureTasks = tasks.filter(t => {
      const taskDate = t.StartTime?.split('T')[0]
      return taskDate && taskDate < today
    })
    if (futureTasks.length > 0) {
      console.log(`  ❌ ${futureTasks.length} tasks are in the past (before ${today})`)
      issues++
    }

    if (issues === 0) {
      console.log(`  ✓ No obvious issues detected`)
    }

    console.log('\n' + '='.repeat(60))
    console.log('✓ Test completed!\n')

    // Recommendations
    console.log('📝 Recommendations:')
    console.log('1. Verify soldier service dates include task dates')
    console.log('2. Ensure soldier roles match task requirements')
    console.log('3. Check that soldiers have "Active" status')
    console.log('4. Tasks should be in the future\n')

  } catch (err) {
    console.error('❌ Test failed:', err.message)
    process.exit(1)
  }
}

runTest()
