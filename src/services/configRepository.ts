import type { AppConfig } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'

export class ConfigRepository {
  private context: ReturnType<typeof useDatabase>

  constructor(context: ReturnType<typeof useDatabase>) {
    this.context = context
  }

  async read(): Promise<AppConfig> {
    const db = this.context.getData()
    return db.config
  }

  async update(updates: Partial<AppConfig>): Promise<void> {
    const db = this.context.getData()
    const updated = { ...db.config, ...updates }
    this.context.setData({ ...db, config: updated })
  }

  // Aliases for backward compatibility
  async write(updates: Partial<AppConfig>): Promise<void> {
    return this.update(updates)
  }

  async writeConfig(updates: Partial<AppConfig>): Promise<void> {
    return this.update(updates)
  }

  async writeAdminEmails(emails: string[]): Promise<void> {
    await this.update({ adminEmails: emails })
  }
}
