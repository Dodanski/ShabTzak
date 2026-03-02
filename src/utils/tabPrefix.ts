/**
 * Derives a spreadsheet tab prefix from a unit name.
 * "Alpha Company" → "Alpha_Company"
 * "מחלקה א"       → "מחלקה_א"
 */
export function deriveTabPrefix(unitName: string): string {
  return unitName.trim().replace(/\s+/g, '_')
}

/**
 * Returns the full tab name with prefix applied.
 * prefixTab('Alpha_Company', 'Soldiers') → 'Alpha_Company_Soldiers'
 * prefixTab('', 'Soldiers')             → 'Soldiers'  (legacy behavior)
 */
export function prefixTab(prefix: string, tabName: string): string {
  return prefix ? `${prefix}_${tabName}` : tabName
}
