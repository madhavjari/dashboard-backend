const jwt = require("jsonwebtoken");
const { findUser } = require("../db/authQueries");

async function verifyToken(req, res, next) {
  const bearerHeader = req.headers["authorization"];
  if (!bearerHeader || !bearerHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Required: Sign in" });
  }
  const bearer = bearerHeader.split(" ");
  const bearerToken = bearer[1];
  try {
    const payload = jwt.verify(bearerToken, process.env.JWT_SECRET_KEY, {
      algorithms: ["HS256"],
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    });
    const user = await findUser(
      ["id", "email", "firstName", "lastName", "emailVerified", "companies"],
      { id: payload.sub },
    );
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    req.user = user;
    next();
  } catch (err) {
    if (
      err instanceof jwt.JsonWebTokenError ||
      err instanceof jwt.TokenExpiredError
    ) {
      return res.status(401).json({ message: "Invalid Credentials" });
    }
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = verifyToken;
