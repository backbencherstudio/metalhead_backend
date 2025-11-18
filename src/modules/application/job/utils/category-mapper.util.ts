/**
 * Utility to map legacy category enum-like values to the canonical seeded
 * category names stored in the database. Kept for backward compatibility.
 */

export const ENUM_TO_CATEGORY_NAME_MAP: Record<string, string> = {
  // Old enum values to new category names
  'CLEANING': 'cleaning',
  'PLUMBING': 'plumbing',
  'ELECTRICAL': 'electrical',
  'HANDYMAN': 'handyman',
  'PAINTING': 'painting',
  'GARDENING': 'gardening',
  'MOVING': 'moving',
  'DELIVERY': 'delivery',
  'PET_CARE': 'pet_care',
  'TUTORING': 'tutoring',
  'TECHNOLOGY': 'technology',
  'PHOTOGRAPHY': 'photography',
  'EVENT_PLANNING': 'event_planning',
  'BEAUTY_WELLNESS': 'beauty_wellness',
  'FITNESS': 'fitness',
  'SECURITY': 'security',
  'CARPENTRY': 'carpentry',
  'ROOFING': 'roofing',
  'HVAC': 'hvac',
  'LANDSCAPING': 'landscaping',
  'CAR_SERVICES': 'car_services',
  'HOUSE_SITTING': 'house_sitting',
  'ERRANDS': 'errands',
  'ASSEMBLY': 'assembly',
  'PERSONAL_CARE': 'personal_care',
  'TRANSPORTATION': 'transportation',
  'OTHER': 'other'
};

/**
 * Convert old enum value to new category name
 * @param enumValue - The old enum value (e.g., 'CLEANING')
 * @returns The new category name (e.g., 'cleaning')
 */
export function convertEnumToCategoryName(enumValue: string): string {
  return ENUM_TO_CATEGORY_NAME_MAP[enumValue] || enumValue.toLowerCase();
}

/**
 * Convert array of enum values to category names
 * @param enumValues - Array of old enum values
 * @returns Array of new category names
 */
export function convertEnumArrayToCategoryNames(enumValues: string[]): string[] {
  return enumValues.map(convertEnumToCategoryName);
}

/**
 * Check if a value is an old enum value
 * @param value - The value to check
 * @returns True if it's an old enum value
 */
export function isOldEnumValue(value: string): boolean {
  return Object.keys(ENUM_TO_CATEGORY_NAME_MAP).includes(value);
}
