/**
 * Test script to debug scheduling algorithm
 * Runs task and leave scheduling with detailed logging
 */

// Note: This is a Node.js test - needs ESM imports
// Run with: node --input-type=module test-scheduling-debug.js

import { generateCyclicalLeaves } from './dist/algorithms/cyclicalLeaveScheduler.js'
import { scheduleLeave } from './dist/algorithms/leaveScheduler.js'
import { scheduleTasks } from './dist/algorithms/taskScheduler.js'

// Mock data
const today = new Date().toISOString().split('T')[0]
const endDate = new Date()
endDate.setDate(endDate.getDate() + 30)
const scheduleEnd = endDate.toISOString().split('T')[0]

console.log('\n=== SCHEDULING TEST ===')
console.log(`Testing schedule from ${today} to ${scheduleEnd}`)
console.log('=' .repeat(50))

// Sample soldiers
const soldiers = [
  {
    id: 'S1',
    role: 'Driver',
    status: 'Active',
    unit: 'Unit1',
    serviceStart: '2026-03-01',
    serviceEnd: '2026-04-30',
    fairness: 0,
  },
  {
    id: 'S2',
    role: 'Medic',
    status: 'Active',
    unit: 'Unit1',
    serviceStart: '2026-03-01',
    serviceEnd: '2026-04-30',
    fairness: 0,
  },
  {
    id: 'S3',
    role: 'Driver',
    status: 'Active',
    unit: 'Unit2',
    serviceStart: '2026-03-01',
    serviceEnd: '2026-04-30',
    fairness: 0,
  },
]

// Sample tasks
const tasks = [
  {
    id: 'T1',
    taskType: 'Transport',
    startTime: `${today}T08:00:00Z`,
    endTime: `${today}T12:00:00Z`,
    durationHours: 4,
    roleRequirements: [{ role: 'Driver', count: 2 }],
    minRestAfter: 6,
  },
  {
    id: 'T2',
    taskType: 'Medical Check',
    startTime: `${today}T10:00:00Z`,
    endTime: `${today}T14:00:00Z`,
    durationHours: 4,
    roleRequirements: [{ role: 'Medic', count: 1 }],
    minRestAfter: 6,
  },
]

// Config
const config = {
  leaveRatioDaysInBase: 10,
  leaveRatioDaysHome: 4,
  longLeaveMaxDays: 4,
  minBasePresence: 20,
  maxDrivingHours: 8,
  defaultRestPeriod: 6,
  leaveBaseExitHour: '06:00',
  leaveBaseReturnHour: '22:00',
}

console.log('\n--- INPUT DATA ---')
console.log(`Soldiers: ${soldiers.length}`)
soldiers.forEach(s => {
  console.log(`  ${s.id}: ${s.role} (${s.status}) [${s.serviceStart} to ${s.serviceEnd}]`)
})
console.log(`\nTasks: ${tasks.length}`)
tasks.forEach(t => {
  const roles = t.roleRequirements.map(r => `${r.count}x ${r.role}`).join(', ')
  console.log(`  ${t.id}: ${t.taskType} - ${roles} (${t.startTime})`)
})

// Test task scheduling
console.log('\n--- TASK SCHEDULING ---')
try {
  const taskSchedule = scheduleTasks(
    tasks,
    soldiers,
    [], // existing assignments
    tasks, // all tasks for validation
    [], // leave assignments (none yet)
    config
  )

  console.log(`\n✓ Task scheduling completed`)
  console.log(`  Assignments created: ${taskSchedule.assignments.length}`)
  console.log(`  Conflicts: ${taskSchedule.conflicts.length}`)

  if (taskSchedule.assignments.length > 0) {
    console.log(`\n  Assignments:`)
    taskSchedule.assignments.forEach(a => {
      console.log(`    - ${a.taskId}: ${a.soldierId} as ${a.assignedRole}`)
    })
  } else {
    console.log(`\n  ⚠️ NO TASK ASSIGNMENTS CREATED!`)
  }

  if (taskSchedule.conflicts.length > 0) {
    console.log(`\n  Conflicts:`)
    taskSchedule.conflicts.forEach(c => {
      console.log(`    - ${c.taskId}: ${c.message}`)
    })
  }
} catch (err) {
  console.error(`✗ Task scheduling failed:`, err.message)
}

// Test leave scheduling
console.log('\n--- LEAVE SCHEDULING ---')
try {
  const leaveSchedule = scheduleLeave(
    [], // leave requests
    soldiers,
    [], // existing leaves
    config,
    today,
    scheduleEnd
  )

  console.log(`✓ Leave scheduling completed`)
  console.log(`  Assignments created: ${leaveSchedule.assignments.length}`)
  console.log(`  Conflicts: ${leaveSchedule.conflicts.length}`)

  if (leaveSchedule.assignments.length > 0) {
    console.log(`\n  Assignments (first 5):`)
    leaveSchedule.assignments.slice(0, 5).forEach(a => {
      console.log(`    - ${a.soldierId}: ${a.startDate} to ${a.endDate} (${a.leaveType})`)
    })
    if (leaveSchedule.assignments.length > 5) {
      console.log(`    ... and ${leaveSchedule.assignments.length - 5} more`)
    }
  }
} catch (err) {
  console.error(`✗ Leave scheduling failed:`, err.message)
}

console.log('\n' + '='.repeat(50))
console.log('Test completed!\n')
