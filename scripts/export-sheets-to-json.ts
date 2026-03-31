// scripts/export-sheets-to-json.ts
import { GoogleSheetsService } from '../src/services/googleSheets'
import { SoldierRepository } from '../src/services/soldierRepository'
import { TaskRepository } from '../src/services/taskRepository'
import { LeaveRequestRepository } from '../src/services/leaveRequestRepository'
import { LeaveAssignmentRepository } from '../src/services/leaveAssignmentRepository'
import { TaskAssignmentRepository } from '../src/services/taskAssignmentRepository'
import { UnitRepository } from '../src/services/unitRepository'
import { ConfigRepository } from '../src/services/configRepository'
import { AdminRepository } from '../src/services/adminRepository'
import { CommanderRepository } from '../src/services/commanderRepository'
import { MasterTaskAssignmentRepository } from '../src/services/masterTaskAssignmentRepository'
import { MasterLeaveAssignmentRepository } from '../src/services/masterLeaveAssignmentRepository'
import { SheetCache } from '../src/services/cache'
import * as fs from 'fs'

// You need to provide your access token and spreadsheet ID
const ACCESS_TOKEN = process.env.GOOGLE_ACCESS_TOKEN || ''
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || ''

if (!ACCESS_TOKEN || !SPREADSHEET_ID) {
  console.error('Error: GOOGLE_ACCESS_TOKEN and SPREADSHEET_ID environment variables are required')
  console.error('Usage: GOOGLE_ACCESS_TOKEN=xxx SPREADSHEET_ID=yyy npx tsx scripts/export-sheets-to-json.ts')
  process.exit(1)
}

async function exportToJson() {
  console.log('Starting export from Google Sheets...')

  const sheets = new GoogleSheetsService(ACCESS_TOKEN)
  const cache = new SheetCache()

  // Initialize repositories
  const soldierRepo = new SoldierRepository(sheets, SPREADSHEET_ID, cache)
  const taskRepo = new TaskRepository(sheets, SPREADSHEET_ID, cache)
  const leaveRequestRepo = new LeaveRequestRepository(sheets, SPREADSHEET_ID, cache)
  const leaveAssignmentRepo = new LeaveAssignmentRepository(sheets, SPREADSHEET_ID, cache)
  const taskAssignmentRepo = new TaskAssignmentRepository(sheets, SPREADSHEET_ID, cache)
  const unitRepo = new UnitRepository(sheets, SPREADSHEET_ID, cache)
  const configRepo = new ConfigRepository(sheets, SPREADSHEET_ID, cache)
  const adminRepo = new AdminRepository(sheets, SPREADSHEET_ID, cache)
  const commanderRepo = new CommanderRepository(sheets, SPREADSHEET_ID, cache)
  const masterTaskRepo = new MasterTaskAssignmentRepository(sheets, SPREADSHEET_ID, cache)
  const masterLeaveRepo = new MasterLeaveAssignmentRepository(sheets, SPREADSHEET_ID, cache)

  console.log('Fetching soldiers...')
  const soldiers = await soldierRepo.list()
  console.log(`✓ Found ${soldiers.length} soldiers`)

  console.log('Fetching tasks...')
  const tasks = await taskRepo.list()
  console.log(`✓ Found ${tasks.length} tasks`)

  console.log('Fetching units...')
  const units = await unitRepo.list()
  console.log(`✓ Found ${units.length} units`)

  console.log('Fetching leave requests...')
  const leaveRequests = await leaveRequestRepo.list()
  console.log(`✓ Found ${leaveRequests.length} leave requests`)

  console.log('Fetching leave assignments...')
  const leaveAssignments = await leaveAssignmentRepo.list()
  console.log(`✓ Found ${leaveAssignments.length} leave assignments`)

  console.log('Fetching task assignments...')
  const taskAssignments = await taskAssignmentRepo.list()
  console.log(`✓ Found ${taskAssignments.length} task assignments`)

  console.log('Fetching config...')
  const config = await configRepo.read()
  console.log('✓ Config loaded')

  console.log('Fetching admins...')
  const admins = await adminRepo.list()
  console.log(`✓ Found ${admins.length} admins`)

  console.log('Fetching commanders...')
  const commanders = await commanderRepo.list()
  console.log(`✓ Found ${commanders.length} commanders`)

  console.log('Fetching roles...')
  // Assuming roles are stored in a Roles tab
  const rolesValues = await sheets.getValues(SPREADSHEET_ID, 'Roles!A:A')
  const roles = rolesValues.slice(1).map(row => row[0]).filter(Boolean)
  console.log(`✓ Found ${roles.length} roles`)

  const database = {
    version: 1,
    lastModified: new Date().toISOString(),
    soldiers,
    tasks,
    units,
    leaveRequests,
    leaveAssignments,
    taskAssignments,
    config,
    roles,
    admins,
    commanders,
  }

  const outputPath = 'public/data/database.json'
  fs.writeFileSync(outputPath, JSON.stringify(database, null, 2))

  console.log(`\n✅ Export complete!`)
  console.log(`Database saved to: ${outputPath}`)
  console.log(`\nSummary:`)
  console.log(`  - Soldiers: ${soldiers.length}`)
  console.log(`  - Tasks: ${tasks.length}`)
  console.log(`  - Units: ${units.length}`)
  console.log(`  - Leave Requests: ${leaveRequests.length}`)
  console.log(`  - Leave Assignments: ${leaveAssignments.length}`)
  console.log(`  - Task Assignments: ${taskAssignments.length}`)
  console.log(`  - Roles: ${roles.length}`)
  console.log(`  - Admins: ${admins.length}`)
  console.log(`  - Commanders: ${commanders.length}`)
}

exportToJson().catch(err => {
  console.error('Export failed:', err)
  process.exit(1)
})
