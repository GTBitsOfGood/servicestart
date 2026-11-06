import { customType } from "drizzle-orm/pg-core";

// Drizzle's jsonb column JSON.parses the value node-postgres has already
// parsed, so a stored string that looks like JSON ("7", "4045550123", "true")
// reads back as a number or boolean. Use this for columns that can hold a bare
// string; it keeps the driver's value as is.
export function parsedJsonb<T>(name: string) {
  return customType<{ data: T; driverData: unknown }>({
    dataType: () => "jsonb",
    toDriver: (value) => JSON.stringify(value),
    fromDriver: (value) => value as T,
  })(name);
}
