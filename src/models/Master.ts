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
  createdAt: string
  createdBy: string
}

export interface CreateUnitInput {
  name: string
  spreadsheetId: string
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
