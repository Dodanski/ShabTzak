/**
 * Comprehensive offline scheduler test
 * Simulates the ENTIRE scheduling flow to find where tasks are lost
 */

// Sample data matching your spreadsheet
const soldiers = [
  // Unit1 (Command Post)
  { id: '6855906', firstName: 'עמית', lastName: 'ברנס', role: 'A Driver', unit: 'Command Post', serviceStart: '2026-03-27', serviceEnd: '2026-05-25', status: 'Active', currentFairness: 8 },
  { id: '7342496', firstName: 'סימן טוב', lastName: 'ג\'מברו', role: 'A Fighter', unit: 'Command Post', serviceStart: '2026-03-27', serviceEnd: '2026-05-25', status: 'Active', currentFairness: 6 },
  { id: '8458334', firstName: 'דניאל', lastName: 'יוסופוב', role: 'A Medic', unit: 'Command Post', serviceStart: '2026-03-27', serviceEnd: '2026-05-25', status: 'Active', currentFairness: 0 },
  { id: '5406834', firstName: 'עוז', lastName: 'לידני', role: 'A Radio Operator', unit: 'Command Post', serviceStart: '2026-03-27', serviceEnd: '2026-05-25', status: 'Active', currentFairness: 0 },
  { id: '6373994', firstName: 'תומר יוסף', lastName: 'רביד', role: 'A Fighter', unit: 'Command Post', serviceStart: '2026-03-27', serviceEnd: '2026-05-25', status: 'Active', currentFairness: 6 },
  
  // Unit1
  { id: '7470983', firstName: 'דמיטרי', lastName: 'איבצ\'נקו', role: 'Squad Leader', unit: 'Unit1', serviceStart: '2026-03-27', serviceEnd: '2026-05-25', status: 'Active', currentFairness: 7 },
  { id: '5335295', firstName: 'דניס', lastName: 'גולוביאן', role: 'Squad Leader', unit: 'Unit1', serviceStart: '2026-03-27', serviceEnd: '2026-05-25', status: 'Active', currentFairness: 8 },
  { id: '8527473', firstName: 'שחר', lastName: 'דקל', role: 'Driver', unit: 'Unit1', serviceStart: '2026-03-27', serviceEnd: '2026-05-25', status: 'Active', currentFairness: 0.5 },
  { id: '5360955', firstName: 'סמי', lastName: 'טבריקיאן', role: 'Medic', unit: 'Unit1', serviceStart: '2026-03-27', serviceEnd: '2026-05-25', status: 'Active', currentFairness: 0 },
  { id: '7097304', firstName: 'משה', lastName: 'יצחק', role: 'Fighter', unit: 'Unit1', serviceStart: '2026-03-27', serviceEnd: '2026-05-25', status: 'Active', currentFairness: 0 },
]

const tasks = [
  {
    id: 'task-gate-1',
    taskType: 'Gate Guard',
    startTime: '2026-03-27T06:00:00',
    endTime: '2026-03-27T18:00:00',
    durationHours: 12,
    roleRequirements: [{ roles: ['A Driver', 'A Fighter', 'A Medic'], count: 2 }],
    minRestAfter: 8,
    isSpecial: false,
  },
  {
    id: 'task-patrol-1',
    taskType: 'Patrol',
    startTime: '2026-03-27T06:00:00',
    endTime: '2026-03-27T12:00:00',
    durationHours: 6,
    roleRequirements: [{ roles: ['Fighter', 'A Fighter'], count: 2 }],
    minRestAfter: 4,
    isSpecial: false,
  },
]

console.log('\n╔════════════════════════════════════════╗')
console.log('║  COMPREHENSIVE SCHEDULER TEST          ║')
console.log('║  Testing dates, roles, and multi-unit  ║')
console.log('╚════════════════════════════════════════╝\n')

// Test 1: Date comparison
console.log('TEST 1: SERVICE DATE COMPARISON')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
const testDate = '2026-03-27'
const testSoldier = soldiers[0]
console.log(`Task date: ${testDate}`)
console.log(`Soldier: ${testSoldier.firstName} ${testSoldier.lastName}`)
console.log(`Service: ${testSoldier.serviceStart} to ${testSoldier.serviceEnd}`)
console.log(`String comparison: "${testDate}" >= "${testSoldier.serviceStart}"? ${testDate >= testSoldier.serviceStart}`)
console.log(`String comparison: "${testDate}" <= "${testSoldier.serviceEnd}"? ${testDate <= testSoldier.serviceEnd}`)
console.log(`Available? ${testDate >= testSoldier.serviceStart && testDate <= testSoldier.serviceEnd ? '✓ YES' : '✗ NO'}`)

// Test 2: Role matching
console.log('\n\nTEST 2: ROLE MATCHING')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
tasks.forEach(task => {
  console.log(`\nTask: ${task.taskType}`)
  task.roleRequirements.forEach(req => {
    console.log(`  Needs: ${req.roles.join(' OR ')} x${req.count}`)
    
    const matching = soldiers.filter(s => req.roles.includes(s.role))
    console.log(`  Found: ${matching.length} soldiers`)
    matching.forEach(s => {
      console.log(`    - ${s.firstName} ${s.lastName} (${s.role}) from ${s.unit}`)
    })
  })
})

// Test 3: Eligibility check (combining date + role + status)
console.log('\n\nTEST 3: SOLDIER ELIGIBILITY')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
const testTask = tasks[0]
const taskDate = testTask.startTime.split('T')[0]
const requirement = testTask.roleRequirements[0]

console.log(`Task: ${testTask.taskType} on ${taskDate}`)
console.log(`Requirement: ${requirement.roles.join('/')} x${requirement.count}`)

const eligible = soldiers.filter(s => {
  const matchesRole = requirement.roles.includes(s.role)
  const isActive = s.status === 'Active'
  const withinDates = taskDate >= s.serviceStart && taskDate <= s.serviceEnd
  
  const avail = matchesRole && isActive && withinDates
  
  if (!avail) {
    let reason = []
    if (!matchesRole) reason.push(`role ${s.role} not in [${requirement.roles.join(',')}]`)
    if (!isActive) reason.push(`status ${s.status}`)
    if (!withinDates) reason.push(`date ${taskDate} not in [${s.serviceStart}-${s.serviceEnd}]`)
    console.log(`  ✗ ${s.firstName}: ${reason.join(', ')}`)
  } else {
    console.log(`  ✓ ${s.firstName} ${s.lastName} (${s.role}) from ${s.unit}`)
  }
  
  return avail
})

console.log(`\nEligible: ${eligible.length}/${soldiers.length}`)

// Test 4: Assignment simulation
console.log('\n\nTEST 4: TASK ASSIGNMENT SIMULATION')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
const assignments = []
tasks.forEach(task => {
  const taskDate = task.startTime.split('T')[0]
  console.log(`\nTask: ${task.taskType} (${task.id})`)
  
  task.roleRequirements.forEach(req => {
    const needCount = req.count
    console.log(`  Requirement: ${req.roles.join('/')} x${needCount}`)
    
    const eligible = soldiers.filter(s => {
      return req.roles.includes(s.role) && 
             s.status === 'Active' && 
             taskDate >= s.serviceStart && 
             taskDate <= s.serviceEnd
    })
    
    console.log(`  Found ${eligible.length} eligible`)
    
    const assigned = eligible.slice(0, needCount)
    assigned.forEach(s => {
      assignments.push({ taskId: task.id, taskType: task.taskType, soldierId: s.id, soldierName: s.firstName + ' ' + s.lastName, role: s.role, unit: s.unit })
      console.log(`    ✓ Assigned ${s.firstName} from ${s.unit}`)
    })
    
    if (assigned.length < needCount) {
      console.log(`    ⚠️  Only ${assigned.length}/${needCount} assigned`)
    }
  })
})

console.log('\n\nTEST 5: RESULTS SUMMARY')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`Total assignments created: ${assignments.length}`)
console.log(`Total tasks: ${tasks.length}`)
console.log(`Total soldiers: ${soldiers.length}`)

if (assignments.length === 0) {
  console.log('\n❌ NO ASSIGNMENTS CREATED - SOMETHING IS WRONG!')
  console.log('\nPossible issues:')
  console.log('1. Role names don\'t match (e.g., "Fighter" vs "A Fighter")')
  console.log('2. Date comparison still broken')
  console.log('3. All soldiers have status !== "Active"')
} else {
  console.log('\n✓ ASSIGNMENTS CREATED:')
  const byUnit = {}
  assignments.forEach(a => {
    byUnit[a.unit] = (byUnit[a.unit] || 0) + 1
    console.log(`${a.taskType}: ${a.soldierName} (${a.role}) from ${a.unit}`)
  })
  
  console.log('\n📊 DISTRIBUTION BY UNIT:')
  Object.entries(byUnit).forEach(([unit, count]) => {
    console.log(`  ${unit}: ${count} assignments`)
  })
}

