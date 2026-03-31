import type { Database } from '../types/Database'
import type { useDatabase } from '../contexts/DatabaseContext'

export abstract class JsonRepository<T extends { id: string }> {
  protected context: ReturnType<typeof useDatabase>
  protected entityKey: keyof Database

  constructor(context: ReturnType<typeof useDatabase>, entityKey: keyof Database) {
    this.context = context
    this.entityKey = entityKey
  }

  async list(): Promise<T[]> {
    const db = this.context.getData()
    return db[this.entityKey] as T[]
  }

  async getById(id: string): Promise<T | null> {
    const items = await this.list()
    return items.find(item => item.id === id) ?? null
  }

  async create(entity: T): Promise<T> {
    const db = this.context.getData()
    const items = db[this.entityKey] as T[]
    const newItems = [...items, entity]
    this.context.setData({ ...db, [this.entityKey]: newItems })
    return entity
  }

  async update(id: string, updates: Partial<T>): Promise<void> {
    const db = this.context.getData()
    const items = db[this.entityKey] as T[]
    const index = items.findIndex(item => item.id === id)
    if (index === -1) throw new Error(`Entity ${id} not found`)
    const newItems = [...items]
    newItems[index] = { ...items[index], ...updates }
    this.context.setData({ ...db, [this.entityKey]: newItems })
  }

  async delete(id: string): Promise<void> {
    const db = this.context.getData()
    const items = db[this.entityKey] as T[]
    const filtered = items.filter(item => item.id !== id)
    this.context.setData({ ...db, [this.entityKey]: filtered })
  }
}
