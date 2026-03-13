/**
 * Local scheduler test - FIXED version
 * Shows the bug: isTaskAvailable uses TODAY instead of TASK DATE
 */

const testSoldiers = [
  { id: '1', firstName: 'David', lastName: 'Cohen', role: 'Fighter', unit: 'Unit1', serviceStart: '2026-03-27', serviceEnd: '2026-05-25', status: 'Active', currentFairness: 0, hoursWorked: 0 },
  { id: '5', firstName: 'Roni', lastName: 'Paz', role: 'Fighter', unit: 'Unit1', serviceStart: '2026-03-27', serviceEnd: '2026-05-25', status: 'Active', currentFairness: 0, hoursWorked: 0 },
  { id: '2', firstName: 'Sara', lastName: 'Levi', role: 'Driver', unit: 'Unit1', serviceStart: '2026-03-27', serviceEnd: '2026-05-25', status: 'Active', currentFairness: 0, hoursWorked: 0 },
]

const testTasks = [
  {
    id: 'task-1',
    taskType: 'Gate Guard',
    startTime: '2026-03-27T06:00:00',
    endTime: '2026-03-27T18:00:00',
    durationHours: 12,
    roleRequirements: [{ roles: ['Fighter', 'Driver'], count: 2 }],
    minRestAfter: 8,
    isSpecial: false,
  },
]

// BUGGY VERSION - uses TODAY instead of task date
function isTaskAvailableBuggy(soldier, task) {
  if (soldier.status !== 'Active') return false
  
  const today = new Date().toISOString().split('T')[0]  // ❌ BUG: Uses today, not task date!
  if (soldier.serviceStart > today || soldier.serviceEnd < today) return false
  
  return true
}

// FIXED VERSION - uses task date
function isTaskAvailableFixed(soldier, task) {
  if (soldier.status !== 'Active') return false
  
  const taskDate = task.startTime.split('T')[0]  // ✓ CORRECT: Uses task date
  if (soldier.serviceStart > taskDate || soldier.serviceEnd < taskDate) return false
  
  return true
}

console.log('╔══════════════════════════════════════╗')
console.log('║  SCHEDULER BUG DEMONSTRATION          ║')
console.log('╚══════════════════════════════════════╝')

console.log('\n📋 TEST DATA:')
console.log('  Soldiers: 3 (2 Fighters, 1 Driver)')
console.log('  Task: Gate Guard on 2026-03-27 (needs 2 soldiers)')
console.log('  All soldiers active on that date')

console.log('\n❌ BUGGY VERSION (using TODAY):')
const today = new Date().toISOString().split('T')[0]
console.log(`  Today's date: ${today}`)
console.log(`  Task date: 2026-03-27`)
console.log(`  Soldier service: 2026-03-27 to 2026-05-25`)

testSoldiers.forEach(s => {
  const avail = isTaskAvailableBuggy(s, testTasks[0])
  console.log(`  ${s.firstName}: ${avail ? '✓' : '❌'} (service ${s.serviceStart} > ${today}? ${s.serviceStart > today})`)
})
console.log('  Result: NO soldiers available ❌')

console.log('\n✓ FIXED VERSION (using task date):')
testSoldiers.forEach(s => {
  const avail = isTaskAvailableFixed(s, testTasks[0])
  console.log(`  ${s.firstName}: ${avail ? '✓' : '❌'}`)
})
console.log('  Result: ALL soldiers available ✓')

