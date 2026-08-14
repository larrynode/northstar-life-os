import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.NORTHSTAR_DATA_DIR
      ? `${process.env.NORTHSTAR_DATA_DIR}/db/northstar.sqlite`
      : "./northstar-data/db/northstar.sqlite",
  },
});
