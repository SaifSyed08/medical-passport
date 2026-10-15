import { sqliteTable, text } from "drizzle-orm/sqlite-core";
export const passports = sqliteTable("passports", {
  id: text("id").primaryKey(), owner: text("owner").notNull(),
  token: text("token").notNull().unique(), number: text("number").notNull().unique(),
  status: text("status").notNull(), data: text("data").notNull(),
  created: text("created").notNull(), expires: text("expires").notNull(), arrival: text("arrival").notNull(),
});
export const photos = sqliteTable("photos", {
  id: text("id").primaryKey(), owner: text("owner").notNull(),
});
