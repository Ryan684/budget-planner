export interface Category {
  label: string
  dot: string // CSS color or custom-property reference
}

export const SUGGESTED_CATEGORIES: Category[] = [
  { label: 'Housing',    dot: '#3a4f82' },
  { label: 'Utilities',  dot: '#1f8a5b' },
  { label: 'Childcare',  dot: '#6b5bd2' },
  { label: 'Transport',  dot: '#a9780c' },
  { label: 'Insurance',  dot: '#59616f' },
  { label: 'One-off',    dot: '#c0392b' },
]

const SUGGESTED_ORDER = new Map(SUGGESTED_CATEGORIES.map((c, i) => [c.label, i]))

export function getDot(category: string): string {
  return SUGGESTED_CATEGORIES.find(c => c.label === category)?.dot ?? '#8b93a2'
}

export function categoryOrder(label: string): number {
  const idx = SUGGESTED_ORDER.get(label)
  return idx !== undefined ? idx : SUGGESTED_CATEGORIES.length
}
