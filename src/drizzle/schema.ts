import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  integer,
  timestamp,
  bigserial,
  index,
  boolean,
} from "drizzle-orm/pg-core";

export const uploadedFiles = pgTable("uploaded_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  columns: jsonb("columns").$type<string[]>().notNull(),
  columnTypes: jsonb("column_types")
    .$type<Record<string, string>>()
    .notNull(),
  sampleValues: jsonb("sample_values").$type<Record<string, string[]>>(),
  rowCount: integer("row_count"),
  isDemo: boolean("is_demo").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const uploadedRows = pgTable(
  "uploaded_rows",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    fileId: uuid("file_id").references(() => uploadedFiles.id, {
      onDelete: "cascade",
    }),
    userId: varchar("user_id", { length: 255 }).notNull(),
    rowData: jsonb("row_data").$type<Record<string, unknown>>().notNull(),
  },
  (table) => ({
    fileIdx: index("idx_rows_file").on(table.fileId),
    userIdx: index("idx_rows_user").on(table.userId),
  })
);
