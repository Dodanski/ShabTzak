import type { Soldier } from '../models'

export function fullName(soldier: Soldier): string {
  const parts = [soldier.firstName, soldier.lastName].filter(Boolean)
  return parts.join(' ')
}
