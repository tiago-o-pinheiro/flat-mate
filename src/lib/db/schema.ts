import {
  pgTable,
  text,
  jsonb,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import type { Community } from "../domain/types";
// One locked aggregate per household: expense, shares and audit commit atomically.
export const communities = pgTable(
  "communities",
  {
    id: text("id").primaryKey(),
    ownerKey: text("owner_key").notNull(),
    state: jsonb("state").$type<Community>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("communities_owner_idx").on(t.ownerKey)],
);
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});
