import { pgEnum, pgTable, timestamp, index, text } from "drizzle-orm/pg-core";
import { organizations } from "@/core/tenant/schema";

// Enum for media type values
export enum MediaType {
  Image = "image",
}

export const MEDIA_TYPE_VALUES = Object.values(
  MediaType,
) as unknown as readonly [string, ...string[]];

export const mediaTypeEnum = pgEnum("media_type", MEDIA_TYPE_VALUES);

export const media = pgTable(
  "media",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    fileName: text("file_name").notNull(),
    type: mediaTypeEnum("type").notNull(),
    altText: text("alt_text").notNull(),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  },
  (table) => [index("media_fileName_idx").on(table.fileName)],
);
