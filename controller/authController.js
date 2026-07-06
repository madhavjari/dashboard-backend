const argon2 = require("argon2");
const { createUser } = require("../db/authQueries");

async function postRegister(req, res) {
  try {
    const { firstName, lastName, email, phoneNumber, companyName, password } =
      req.body;
    const hashedPassword = await argon2.hash(password);
    if (!hashedPassword)
      return res.status(400).json({ message: "Error in hashing password" });
    const user = {
      firstName,
      lastName,
      email,
      phoneNumber,
      companyName,
      hashedPassword,
    };
    const newUser = await createUser(user);
    if (!newUser)
      return res.status(400).json({ message: "error in creating user" });
    return res.status(201).json({
      newUser,
      message: "Registered Successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = { postRegister };
