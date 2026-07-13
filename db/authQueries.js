const { prisma } = require("../lib/prisma");

async function createCompanyAndUser(user) {
  return await prisma.$transaction(async (tx) => {
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
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
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

async function findUser(columns, where = {}) {
  const selectClause = columns.reduce((acc, columnName) => {
    acc[columnName] = true;
    return acc;
  }, {});
  const user = await prisma.user.findFirst({
    where: where,
    select: selectClause,
  });
  return user;
}

async function createRefreshToken({ userId, tokenHash, expiresAt, family }) {
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      family,
    },
  });
}

async function createEmailVerification(tokenHash, userId) {
  await prisma.emailVerificationToken.create({
    data: {
      token: tokenHash,
      userId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
}

async function findVerificationToken(token) {
  const user = await prisma.emailVerificationToken.findUnique({
    where: {
      token,
    },
    include: {
      user: true,
    },
  });
  return user;
}

async function updateAndDeleteVerificationToken(verification) {
  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: verification.userId,
      },
      data: {
        emailVerified: true,
      },
    }),

    prisma.emailVerificationToken.delete({
      where: {
        id: verification.id,
      },
    }),
  ]);
}

async function deleteVerificationToken(userId) {
  await prisma.emailVerificationToken.deleteMany({
    where: {
      userId,
    },
  });
}

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

async function findRefreshToken({ tokenHash }) {
  const token = await prisma.refreshToken.findFirst({
    select: {
      id: true,
      expiresAt: true,
      userId: true,
      tokenHash: true,
      family: true,
      used: true,
    },
    where: {
      tokenHash: tokenHash,
    },
  });
  return token;
}

async function updateTokenStatus({ tokenHash, family, revoked }) {
  const whereClause = tokenHash ? { tokenHash } : { family };

  return await prisma.refreshToken.updateMany({
    where: whereClause,
    data: { revoked },
  });
}

async function rotateRefreshToken({ id, userId, newHash, family, expiresAt }) {
  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: {
        id: id,
      },
      data: {
        used: true,
      },
    });

    await tx.refreshToken.create({
      data: {
        userId: userId,
        tokenHash: newHash,
        family: family,
        expiresAt,
      },
    });
  });
}

module.exports = {
  findUserFromApi,
  generateApikey,
  createCompanyAndUser,
  findUser,
  findVerificationToken,
  createRefreshToken,
  findRefreshToken,
  updateTokenStatus,
  rotateRefreshToken,
  createEmailVerification,
  updateAndDeleteVerificationToken,
  deleteVerificationToken,
};
