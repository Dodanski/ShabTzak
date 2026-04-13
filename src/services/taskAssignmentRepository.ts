import type { TaskAssignment, SoldierRole } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'

function generateId(): string {
  // Generate plain text ID: sched_YYYYMMDD_HHMM_RANDOM
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const time = now.toISOString().slice(11, 16).replace(/:/g, '')
  const random = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `sched_${date}_${time}_${random}`
}

export interface CreateTaskAssignmentInput {
  taskId: string
  soldierId: string
  assignedRole: SoldierRole
  createdBy: string
}

export class TaskAssignmentRepository {
  private context: ReturnType<typeof useDatabase>

  constructor(context: ReturnType<typeof useDatabase>) {
    this.context = context
  }

  async list(): Promise<TaskAssignment[]> {
    const db = this.context.getData()
    return [...(db.taskAssignments ?? [])]
  }

  async getByScheduleId(scheduleId: string): Promise<TaskAssignment | null> {
    const items = await this.list()
    return items.find(item => item.scheduleId === scheduleId) ?? null
  }

  async listByTask(taskId: string): Promise<TaskAssignment[]> {
    const all = await this.list()
    return all.filter(a => a.taskId === taskId)
  }

  async create(input: CreateTaskAssignmentInput): Promise<TaskAssignment> {
    const assignment: TaskAssignment = {
      scheduleId: generateId(),
      taskId: input.taskId,
      soldierId: input.soldierId,
      assignedRole: input.assignedRole,
      isLocked: false,
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy,
    }
    const db = this.context.getData()
    const items = [...(db.taskAssignments ?? []), assignment]
    this.context.setData({ ...db, taskAssignments: items })
    return assignment
  }

  async createBatch(inputs: CreateTaskAssignmentInput[], onProgress?: (completed: number, total: number) => void): Promise<TaskAssignment[]> {
    const assignments: TaskAssignment[] = inputs.map(input => ({
      scheduleId: generateId(),
      taskId: input.taskId,
      soldierId: input.soldierId,
      assignedRole: input.assignedRole,
      isLocked: false,
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy,
    }))

    const db = this.context.getData()
    const items = [...(db.taskAssignments ?? []), ...assignments]
    this.context.setData({ ...db, taskAssignments: items })

    // Simulate progress callbacks for batch operations
    const BATCH_SIZE = 20
    for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
      const completed = Math.min(i + BATCH_SIZE, assignments.length)
      onProgress?.(completed, assignments.length)
    }

    return assignments
  }

  async setLocked(scheduleId: string, locked: boolean): Promise<void> {
    const existing = await this.getByScheduleId(scheduleId)
    if (!existing) {
      throw new Error(`Task assignment with scheduleId "${scheduleId}" not found`)
    }
    const db = this.context.getData()
    const items = [...(db.taskAssignments ?? [])]
    const index = items.findIndex(item => item.scheduleId === scheduleId)
    if (index !== -1) {
      items[index] = { ...items[index], isLocked: locked }
      this.context.setData({ ...db, taskAssignments: items })
    }
  }

  async deleteByScheduleIds(scheduleIds: string[]): Promise<void> {
    if (scheduleIds.length === 0) return

    const db = this.context.getData()
    const items = [...(db.taskAssignments ?? [])]
    const idsSet = new Set(scheduleIds)
    const filtered = items.filter(item => !idsSet.has(item.scheduleId))
    this.context.setData({ ...db, taskAssignments: filtered })
  }
}
