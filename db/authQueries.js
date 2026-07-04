const { prisma } = require("../lib/prisma");
async function findUserFromApi(apikey) {
  const user = await prisma.apikey.findFirst({
    select: {
      user: {
        id: true,
      },
    },
    where: {
      apikey: apikey,
    },
  });
  return user;
}

async function generateApikey(apikey, userId) {
  await prisma.apikey.create({
    data: {
      apikey,
      userId,
      createAt: Date.now(),
    },
  });
}

module.exports = { findUserFromApi };
