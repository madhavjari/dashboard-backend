const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("../generated/prisma/client.js");
require("dotenv/config");

const isProduction = process.env.NODE_ENV === "production";

const connectionString = isProduction
  ? process.env.DATABASE_URL
  : process.env.DATABASE_URL;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

module.exports = { prisma };
