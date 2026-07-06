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

async function emailExists(email) {
  const user = await prisma.user.findFirst({
    where: {
      email: email,
    },
  });
  if (!user) return false;
  else return true;
}

async function createCompanyAndUser(user) {
  await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: user.companyName,
      },
    });
    const newUser = await tx.user.create({
      data: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        password: user.hashedPassword,
      },
    });

    await tx.companyUser.create({
      data: {
        companyId: company.id,
        userId: newUser.id,
        role: "OWNER",
      },
    });
    return { company, newUser };
  });
}

module.exports = {
  findUserFromApi,
  emailExists,
  generateApikey,
  createCompanyAndUser,
};
