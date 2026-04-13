import { JsonRepository } from './JsonRepository'
import type { Admin, CreateAdminInput } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'

export class AdminRepository extends JsonRepository<Admin> {
  constructor(context: ReturnType<typeof useDatabase>) {
    super(context, 'admins')
  }

  async createAdmin(input: CreateAdminInput, createdBy: string): Promise<Admin> {
    const admin: Admin = {
      id: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      email: input.email,
      addedAt: new Date().toISOString(),
      addedBy: createdBy,
    }
    return super.create(admin)
  }

  async remove(id: string): Promise<void> {
    await super.delete(id)
  }
}
