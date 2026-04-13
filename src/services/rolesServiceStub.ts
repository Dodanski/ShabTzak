import type { useDatabase } from '../contexts/DatabaseContext'

/**
 * Stub implementation of RolesService for JSON database.
 * Reads roles from database.roles array.
 */
export class RolesServiceStub {
  constructor(private dbContext: ReturnType<typeof useDatabase>) {}

  async list(): Promise<string[]> {
    const db = this.dbContext.getData()
    return db.roles ?? []
  }

  async create(name: string): Promise<void> {
    const db = this.dbContext.getData()
    const roles = db.roles ?? []
    if (!roles.includes(name)) {
      this.dbContext.setData({
        ...db,
        roles: [...roles, name]
      })
    }
  }

  async delete(name: string): Promise<void> {
    const db = this.dbContext.getData()
    const roles = db.roles ?? []
    this.dbContext.setData({
      ...db,
      roles: roles.filter(r => r !== name)
    })
  }
}
