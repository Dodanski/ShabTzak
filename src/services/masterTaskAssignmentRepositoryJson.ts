import type { TaskAssignment } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'
import type { SoldierRole } from '../constants'

function generateId(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const time = now.toISOString().slice(11, 16).replace(/:/g, '')
  const random = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `task_${date}_${time}_${random}`
}

interface CreateTaskAssignmentInput {
  taskId: string
  soldierId: string
  assignedRole: SoldierRole
  createdBy: string
}

/**
 * JSON-based repository for shared task assignments
 * Used by all units - ONE schedule shared across organization
 */
export class MasterTaskAssignmentRepositoryJson {
  constructor(private context: ReturnType<typeof useDatabase>) {}

  async list(): Promise<TaskAssignment[]> {
    const db = this.context.getData()
    return db.taskAssignments
  }

  async listByTask(taskId: string): Promise<TaskAssignment[]> {
    const all = await this.list()
    return all.filter(a => a.taskId === taskId)
  }

  async listBySoldier(soldierId: string): Promise<TaskAssignment[]> {
    const all = await this.list()
    return all.filter(a => a.soldierId === soldierId)
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
    const updated = {
      ...db,
      taskAssignments: [...db.taskAssignments, assignment]
    }
    this.context.setData(updated)
    return assignment
  }

  async delete(scheduleId: string): Promise<void> {
    const db = this.context.getData()
    const updated = {
      ...db,
      taskAssignments: db.taskAssignments.filter(a => a.scheduleId !== scheduleId)
    }
    this.context.setData(updated)
  }

  async createBatch(inputs: CreateTaskAssignmentInput[], _onProgress?: (completed: number, total: number) => void): Promise<TaskAssignment[]> {
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
    const updated = {
      ...db,
      taskAssignments: [...db.taskAssignments, ...assignments]
    }
    this.context.setData(updated)
    return assignments
  }

  async clearFutureAssignments(_tasks: any[]): Promise<TaskAssignment[]> {
    const today = new Date().toISOString().split('T')[0]
    const db = this.context.getData()
    // Keep assignments from the past
    const past = db.taskAssignments.filter(a => {
      // Task assignments don't have dates directly, so we keep all for now
      // TODO: Filter by task date when needed
      return a.createdAt < today
    })
    this.context.setData({
      ...db,
      taskAssignments: past
    })
    return past
  }
}
