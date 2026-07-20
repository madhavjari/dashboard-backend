const { PrismaPg } = require("@prisma/adapter-pg");
const {
  PrismaClient: NeonPrismaClient,
} = require("../generated/neon/client.js");
require("dotenv/config");

const isProduction = process.env.NODE_ENV === "production";

const connectionString = isProduction
  ? process.env.NEON_DATABASE_URL
  : process.env.NEON_DATABASE_URL;

const adapter = new PrismaPg({ connectionString });
const neonprisma = new NeonPrismaClient({ adapter });

module.exports = { neonprisma };
