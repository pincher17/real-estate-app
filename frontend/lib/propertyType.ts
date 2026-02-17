export const PROPERTY_TYPE_OPTIONS = [
  { value: "apartment", label: "Квартиры" },
  { value: "house_land", label: "Дома и участки" },
  { value: "commercial", label: "Коммерческая недвижимость" }
] as const;

export type PropertyType = (typeof PROPERTY_TYPE_OPTIONS)[number]["value"];

export const DEFAULT_PROPERTY_TYPE: PropertyType = "apartment";

export function normalizePropertyType(
  value: string | null | undefined
): PropertyType {
  if (value === "house_land" || value === "commercial") {
    return value;
  }
  return DEFAULT_PROPERTY_TYPE;
}
