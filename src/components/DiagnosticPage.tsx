import { useState, useEffect } from 'react'
import type { MasterDataService } from '../services/masterDataService'

interface DiagnosticPageProps {
  masterDs: MasterDataService
}

export default function DiagnosticPage({ masterDs }: DiagnosticPageProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [logs, setLogs] = useState<string[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setLogs([])
    const newLogs: string[] = []

    try {
      newLogs.push('📥 Loading Soldiers...')
      const soldiers = await masterDs.soldiers.list()
      newLogs.push(`✓ Found ${soldiers.length} soldiers`)
      soldiers.slice(0, 3).forEach(s => {
        newLogs.push(`  - ${s.id}: ${s.role} (${s.status}) [${s.serviceStart} to ${s.serviceEnd}]`)
      })

      newLogs.push('\n📥 Loading Tasks...')
      const tasks = await masterDs.tasks.list()
      newLogs.push(`✓ Found ${tasks.length} tasks`)
      tasks.slice(0, 5).forEach(t => {
        // Handle both old (role) and new (roles) format
        const roles = t.roleRequirements.map(r => {
          const roleList = r.roles ?? (r.role ? [r.role] : [])
          return `${r.count}x [${roleList.join('|')}]`
        }).join(', ')
        newLogs.push(`  - ${t.id}: ${t.taskType} requires: ${roles || '⚠️ NO ROLES'}`)
        newLogs.push(`      startTime: ${t.startTime}`)
      })

      newLogs.push('\n📥 Loading LeaveRequests...')
      const requests = await masterDs.leaveRequests.list()
      newLogs.push(`✓ Found ${requests.length} leave requests`)

      newLogs.push('\n📥 Loading LeaveAssignments...')
      const leaves = await masterDs.leaveAssignments.list()
      newLogs.push(`✓ Found ${leaves.length} leave assignments`)

      newLogs.push('\n📥 Loading TaskAssignments...')
      const taskAssignments = await masterDs.taskAssignments.list()
      newLogs.push(`✓ Found ${taskAssignments.length} task assignments`)

      // Analysis
      newLogs.push('\n' + '='.repeat(50))
      newLogs.push('📊 ANALYSIS')
      newLogs.push('='.repeat(50))

      const soldierRoles = new Map<string, number>()
      soldiers.forEach(s => {
        soldierRoles.set(s.role, (soldierRoles.get(s.role) || 0) + 1)
      })
      newLogs.push(`\nSoldier Roles: ${Array.from(soldierRoles.entries()).map(([r, c]) => `${r}(${c})`).join(', ') || '⚠️ NONE'}`)

      const taskRoles = new Set(tasks.flatMap(t =>
        t.roleRequirements.flatMap(r => r.roles ?? (r.role ? [r.role] : []))
      ))
      newLogs.push(`Task Roles Required: ${Array.from(taskRoles).join(', ') || '⚠️ NONE'}`)

      // Check for role mismatches
      const soldierRoleSet = new Set(soldiers.map(s => s.role))
      const missingRoles = Array.from(taskRoles).filter(r => r !== 'Any' && !soldierRoleSet.has(r))
      if (missingRoles.length > 0) {
        newLogs.push(`\n⚠️ ROLE MISMATCH: Tasks require ${missingRoles.join(', ')} but no soldiers have these roles!`)
      }

      const activeCount = soldiers.filter(s => s.status === 'Active').length
      newLogs.push(`\nActive Soldiers: ${activeCount} / ${soldiers.length}`)

      const inactive = soldiers.filter(s => s.status !== 'Active')
      if (inactive.length > 0) {
        newLogs.push(`⚠️  Inactive soldiers (won't be scheduled):`)
        inactive.forEach(s => newLogs.push(`  - ${s.id}: ${s.status}`))
      }

      const today = new Date().toISOString().split('T')[0]
      const futureTasks = tasks.filter(t => t.startTime.split('T')[0] >= today)
      newLogs.push(`\nFuture Tasks (>= ${today}): ${futureTasks.length} / ${tasks.length}`)

      if (taskAssignments.length === 0) {
        newLogs.push('\n❌ NO TASK ASSIGNMENTS! This is the problem.')
        newLogs.push('Possible reasons:')
        newLogs.push('  1. All soldiers filtered out as unavailable')
        newLogs.push('  2. Task dates in the past')
        newLogs.push('  3. Role mismatches')
        newLogs.push('  4. Service date conflicts')

        // Detailed eligibility check for first task
        if (futureTasks.length > 0) {
          newLogs.push('\n📋 DETAILED CHECK for first future task:')
          const testTask = futureTasks[0]
          const taskDate = testTask.startTime.split('T')[0]
          newLogs.push(`  Task: ${testTask.id} (${testTask.taskType})`)
          newLogs.push(`  Date: ${taskDate}`)
          const reqRoles = testTask.roleRequirements.flatMap(r => r.roles ?? (r.role ? [r.role] : []))
          newLogs.push(`  Requires: ${reqRoles.join(', ') || '⚠️ EMPTY'}`)

          if (reqRoles.length === 0) {
            newLogs.push('\n  ⚠️ Task has NO role requirements - check RoleRequirements column format!')
            newLogs.push('     Expected format: [{"roles":["Driver"],"count":1}]')
          }

          soldiers.forEach(s => {
            const issues: string[] = []
            if (s.status !== 'Active') issues.push(`status=${s.status}`)
            if (!reqRoles.includes('Any') && !reqRoles.includes(s.role)) {
              issues.push(`role mismatch (${s.role} not in [${reqRoles.join(',')}])`)
            }
            if (taskDate < s.serviceStart) issues.push(`before service start`)
            if (taskDate > s.serviceEnd) issues.push(`after service end`)
            if (issues.length > 0) {
              newLogs.push(`  ❌ ${s.id} (${s.role}): ${issues.join(', ')}`)
            } else {
              newLogs.push(`  ✓ ${s.id} (${s.role}): ELIGIBLE`)
            }
          })
        }
      } else {
        newLogs.push(`\n✓ Tasks ARE being scheduled (${taskAssignments.length} assignments)`)
      }

      setData({ soldiers, tasks, requests, leaves, taskAssignments })
    } catch (err) {
      newLogs.push(`❌ Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLogs(newLogs)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <p className="text-sm text-blue-700">
          <strong>Diagnostic Page:</strong> Loads all data and analyzes scheduling issues
        </p>
      </div>

      <button
        onClick={loadData}
        disabled={loading}
        className="px-4 py-2 bg-olive-700 text-white rounded hover:bg-olive-800 disabled:opacity-50"
      >
        {loading ? 'Loading...' : 'Reload Data'}
      </button>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold mb-3">Diagnostic Output:</h3>
        <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto max-h-96 font-mono text-xs">
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </pre>
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded border p-4">
            <h4 className="font-semibold mb-2">Soldiers ({data.soldiers.length})</h4>
            <ul className="text-sm space-y-1">
              {data.soldiers.map((s: any) => (
                <li key={s.id} className="text-gray-700">
                  {s.id}: {s.role} ({s.status})
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded border p-4">
            <h4 className="font-semibold mb-2">Tasks ({data.tasks.length})</h4>
            <ul className="text-sm space-y-1">
              {data.tasks.map((t: any) => {
                const roles = t.roleRequirements.map((r: any) => {
                  const roleList = r.roles ?? (r.role ? [r.role] : [])
                  return `${r.count}x[${roleList.join('|') || '?'}]`
                }).join(', ')
                return (
                  <li key={t.id} className="text-gray-700">
                    {t.id}: {roles || <span className="text-red-600">NO ROLES</span>}
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="bg-white rounded border p-4">
            <h4 className="font-semibold mb-2">
              Task Assignments ({data.taskAssignments.length})
            </h4>
            {data.taskAssignments.length === 0 ? (
              <p className="text-sm text-red-600">None (this is the problem!)</p>
            ) : (
              <ul className="text-sm space-y-1">
                {data.taskAssignments.slice(0, 5).map((a: any) => (
                  <li key={a.scheduleId} className="text-gray-700">
                    {a.taskId}: {a.soldierId} ({a.assignedRole})
                  </li>
                ))}
                {data.taskAssignments.length > 5 && (
                  <li className="text-gray-500">... and {data.taskAssignments.length - 5} more</li>
                )}
              </ul>
            )}
          </div>

          <div className="bg-white rounded border p-4">
            <h4 className="font-semibold mb-2">
              Leave Assignments ({data.leaveAssignments.length})
            </h4>
            {data.leaveAssignments.length === 0 ? (
              <p className="text-sm text-gray-600">None</p>
            ) : (
              <ul className="text-sm space-y-1">
                {data.leaveAssignments.slice(0, 5).map((a: any) => (
                  <li key={a.id} className="text-gray-700">
                    {a.soldierId}: {a.startDate} to {a.endDate}
                  </li>
                ))}
                {data.leaveAssignments.length > 5 && (
                  <li className="text-gray-500">... and {data.leaveAssignments.length - 5} more</li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
