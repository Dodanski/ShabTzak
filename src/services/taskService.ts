import type { TaskRepository } from './taskRepository'
import type { HistoryService } from './historyService'
import type { Task, CreateTaskInput } from '../models'

/**
 * Orchestrates task configuration CRUD with audit history logging.
 */
export class TaskService {
  constructor(
    private repo: TaskRepository,
    private history: HistoryService,
  ) {}

  async create(input: CreateTaskInput, changedBy: string): Promise<Task> {
    const task = await this.repo.create(input)
    await this.history.append('CREATE', 'Task', task.id, changedBy, `Created task ${task.taskType}`)
    return task
  }

  async list(): Promise<Task[]> {
    return this.repo.list()
  }
}
