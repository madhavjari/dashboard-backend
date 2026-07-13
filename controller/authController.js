const argon2 = require("argon2");
const {
  createCompanyAndUser,
  findUser,
  createRefreshToken,
  findRefreshToken,
  updateTokenStatus,
  rotateRefreshToken,
  createEmailVerification,
  findVerificationToken,
  updateAndDeleteVerificationToken,
  deleteVerificationToken,
} = require("../db/authQueries");
const {
  getAccessToken,
  generatedRefreshToken,
  generateToken,
  refreshCookieOptions,
  refreshExpiry,
  hashString,
} = require("../utils/token");

const { sendWithRetry } = require("../utils/sendWithRetry");

const sendVerificationEmail = require("../services/email");

async function postRegister(req, res) {
  try {
    const { firstName, lastName, email, phoneNumber, companyName, password } =
      req.body;
    const hashedPassword = await argon2.hash(password);
    const user = {
      firstName,
      lastName,
      email,
      phoneNumber,
      companyName,
      hashedPassword,
    };
    const { newUser } = await createCompanyAndUser(user);
    if (!newUser)
      return res.status(400).json({ message: "error in creating user" });
    const { token, tokenHash } = generateToken();
    await createEmailVerification(tokenHash, newUser.id);
    try {
      await sendWithRetry(() => sendVerificationEmail(email, token));
    } catch (err) {
      console.error("Verification email failed after retries:", err);
    }
    return res.status(201).json({ message: "user registered successfully" });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ message: "Email already taken" });
    }
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function postLogin(req, res) {
  const { email, password } = req.body;
  try {
    const user = await findUser(
      ["id", "email", "password", ["emailVerified"]],
      { email: email },
    );
    if (!user) {
      return res.status(401).json({ message: "Invalid username or password" });
    }
    const match = await argon2.verify(user.password, password);
    if (!match) {
      return res.status(401).json({
        message: "Invalid username or Password",
      });
    }
    const accessToken = getAccessToken(user.id);
    const { refreshToken, refreshTokenHash } = generatedRefreshToken();
    await createRefreshToken({
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: refreshExpiry(),
      family: crypto.randomUUID(),
    });
    res
      .cookie("refresh_token", refreshToken, refreshCookieOptions)
      .json({ accessToken, isVerified: user.emailVerified });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
}

async function postResendVerification(req, res) {
  try {
    const { email } = req.body;
    const user = await findUser(["id", "emailVerified"], { email });
    if (!user || user.emailVerified) {
      return res.status(200).json({
        message: "If an account exists, a verification email has been sent.",
      });
    }

    const { token, tokenHash } = generateToken();
    await deleteVerificationToken(user.id);
    await createEmailVerification(tokenHash, user.id);
    try {
      await sendWithRetry(() => sendVerificationEmail(email, token));
    } catch (err) {
      console.error("Verification email failed after retries:", err);
    }

    return res.status(200).json({
      message: "If an account exists, a verification email has been sent.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function postVerifyEmail(req, res) {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({
        message: "Verification token is required.",
      });
    }
    const tokenHash = hashString(token);
    const verification = await findVerificationToken(tokenHash);
    if (!verification) {
      return res.status(400).json({
        message: "Invalid Token",
      });
    }
    if (verification.expiresAt < new Date()) {
      return res.status(400).json({
        message: "Verification token has expired.",
      });
    }
    await updateAndDeleteVerificationToken(verification);
    return res.status(200).json({
      message: "Email verified successfully.",
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
}

async function postRefreshToken(req, res) {
  try {
    const presentedToken = req.cookies?.refresh_token;
    if (!presentedToken) {
      return res.status(401).json({ error: "Missing refresh token" });
    }
    const presentedHash = hashString(presentedToken);
    const stored = await findRefreshToken({ tokenHash: presentedHash });
    if (!stored || stored.expiresAt < new Date() || stored.revoked) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }
    if (stored.used) {
      await updateTokenStatus({ family: stored.family, revoked: true });
      return res.status(401).json({ error: "Refresh token reuse detected" });
    }
    const { newRefreshToken, newRefreshTokenHash } = generatedRefreshToken();

    await rotateRefreshToken({
      id: stored.id,
      userId: stored.userId,
      newHash: newRefreshTokenHash,
      family: stored.family,
      expiresAt: refreshExpiry(),
    });
    const newAccessToken = getAccessToken(stored.userId);
    res
      .cookie("refresh_token", newRefreshToken, refreshCookieOptions)
      .json({ accessToken: newAccessToken });
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function postLogout(req, res) {
  try {
    const presentedToken = req.cookies?.refresh_token;

    if (presentedToken) {
      const hash = hashString(presentedToken);
      await updateTokenStatus({ tokenHash: hash, revoked: true });
    }
    res.clearCookie("refresh_token", refreshCookieOptions).status(204).end();
  } catch {
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = {
  postRegister,
  postLogin,
  postRefreshToken,
  postLogout,
  postVerifyEmail,
  postResendVerification,
};
