import { JsonRepository } from './JsonRepository'
import type { Task, CreateTaskInput, UpdateTaskInput } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'

function generateId(taskType: string): string {
  // Use taskType (task name) as the ID - this is editable and user-friendly
  return taskType
}

function calcDurationHours(startTime: string, endTime: string): number {
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()
  return Math.round((end - start) / (1000 * 60 * 60))
}

export class TaskRepository extends JsonRepository<Task> {
  constructor(context: ReturnType<typeof useDatabase>) {
    super(context, 'tasks')
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    const task: Task = {
      id: generateId(input.taskType),
      taskType: input.taskType,
      startTime: input.startTime,
      endTime: input.endTime,
      durationHours: input.durationHours !== undefined ? input.durationHours : calcDurationHours(input.startTime, input.endTime),
      roleRequirements: input.roleRequirements,
      minRestAfter: input.minRestAfter ?? 6,
      isSpecial: input.isSpecial ?? false,
      specialDurationDays: input.specialDurationDays,
    }
    return super.create(task)
  }

  async updateTask(input: UpdateTaskInput): Promise<void> {
    const existing = await this.getById(input.id)
    if (!existing) {
      throw new Error(`Task with id "${input.id}" not found`)
    }

    const updated: Task = {
      ...existing,
      ...(input.taskType !== undefined && { taskType: input.taskType }),
      ...(input.startTime !== undefined && { startTime: input.startTime }),
      ...(input.endTime !== undefined && { endTime: input.endTime }),
      ...(input.durationHours !== undefined && { durationHours: input.durationHours }),
      ...(input.roleRequirements !== undefined && { roleRequirements: input.roleRequirements }),
      ...(input.minRestAfter !== undefined && { minRestAfter: input.minRestAfter }),
      ...(input.isSpecial !== undefined && { isSpecial: input.isSpecial }),
      ...(input.specialDurationDays !== undefined && { specialDurationDays: input.specialDurationDays }),
    }

    await super.update(input.id, updated)
  }
}
