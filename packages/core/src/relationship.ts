/**
 * Relationship taxonomy + Vietnamese kinship honorifics (§6). Pure/platform-
 * agnostic (R2). A relationship row stores ONE direction (from → to) where
 * `type` means "to is from's <type>"; the reverse view is inferred, and
 * symmetric types read the same both ways. Sibling honorific (anh/chị/em) is
 * DERIVED from gender + age, never stored.
 */

export const RELATIONSHIP_CATEGORIES = ['FAMILY', 'SOCIAL'] as const
export type RelationshipCategory = (typeof RELATIONSHIP_CATEGORIES)[number]

export const RELATIONSHIP_TYPES = [
  'SIBLING',
  'GRANDPARENT',
  'GRANDCHILD',
  'AUNT_UNCLE',
  'NIECE_NEPHEW',
  'COUSIN',
  'RELATIVE',
  'SPOUSE',
  'FRIEND',
] as const
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number]

const CATEGORY_OF: Record<RelationshipType, RelationshipCategory> = {
  SIBLING: 'FAMILY',
  GRANDPARENT: 'FAMILY',
  GRANDCHILD: 'FAMILY',
  AUNT_UNCLE: 'FAMILY',
  NIECE_NEPHEW: 'FAMILY',
  COUSIN: 'FAMILY',
  RELATIVE: 'FAMILY',
  SPOUSE: 'FAMILY',
  FRIEND: 'SOCIAL',
}

export function categoryOf(type: RelationshipType): RelationshipCategory {
  return CATEGORY_OF[type]
}

/** Types that read the same from both sides (store one row, query both ways). */
const SYMMETRIC = new Set<RelationshipType>(['SIBLING', 'COUSIN', 'SPOUSE', 'RELATIVE', 'FRIEND'])
/** Directional types → their reverse label. */
const REVERSE: Partial<Record<RelationshipType, RelationshipType>> = {
  GRANDPARENT: 'GRANDCHILD',
  GRANDCHILD: 'GRANDPARENT',
  AUNT_UNCLE: 'NIECE_NEPHEW',
  NIECE_NEPHEW: 'AUNT_UNCLE',
}

export function isSymmetric(type: RelationshipType): boolean {
  return SYMMETRIC.has(type)
}

/** The relationship AS SEEN FROM THE OTHER SIDE (`to`'s perspective). */
export function reverseType(type: RelationshipType): RelationshipType {
  return REVERSE[type] ?? type
}

function isMale(gender: string | null | undefined): boolean {
  return (gender ?? '').toLowerCase().startsWith('m')
}
function isFemale(gender: string | null | undefined): boolean {
  return (gender ?? '').toLowerCase().startsWith('f')
}

/**
 * How to address the other person in Vietnamese, from `type` (as seen from the
 * viewer) + the other's gender + whether the other is older. Returns null when
 * there's no common honorific / not enough info. Sibling → anh/chị/em (§6).
 */
export function kinshipHonorific(
  type: RelationshipType,
  otherGender: string | null | undefined,
  otherIsOlder: boolean,
): string | null {
  switch (type) {
    case 'SIBLING':
    case 'COUSIN':
      if (!otherIsOlder) return 'em'
      return isMale(otherGender) ? 'anh' : isFemale(otherGender) ? 'chị' : 'anh/chị'
    case 'GRANDPARENT':
      return isMale(otherGender) ? 'ông' : isFemale(otherGender) ? 'bà' : 'ông/bà'
    case 'GRANDCHILD':
    case 'NIECE_NEPHEW':
      return 'cháu'
    case 'AUNT_UNCLE':
      return isMale(otherGender) ? 'chú/bác' : isFemale(otherGender) ? 'cô/dì' : null
    case 'SPOUSE':
      return isMale(otherGender) ? 'chồng' : isFemale(otherGender) ? 'vợ' : null
    default:
      return null
  }
}
