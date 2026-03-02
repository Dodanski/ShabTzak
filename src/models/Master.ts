export interface Admin {
  id: string
  email: string
  addedAt: string
  addedBy: string
}

export interface CreateAdminInput {
  email: string
}

export interface Unit {
  id: string
  name: string
  spreadsheetId: string
  tabPrefix: string      // auto-derived from name at creation; empty = legacy (no prefix)
  createdAt: string
  createdBy: string
}

export interface CreateUnitInput {
  name: string
  spreadsheetId: string
  tabPrefix: string
}

export interface Commander {
  id: string
  email: string
  unitId: string
  addedAt: string
  addedBy: string
}

export interface CreateCommanderInput {
  email: string
  unitId: string
}
