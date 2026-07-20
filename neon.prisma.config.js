require("dotenv/config");
const { defineConfig } = require("prisma/config");

module.exports = defineConfig({
  schema: "prisma/neon.schema.prisma",
  datasource: {
    url: process.env.NEON_DATABASE_URL,
  },
});
