async function postRegister(req, res) {
  try {
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      username,
      password,
      confirmPassword,
    } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      firstName,
      lastName,
      email,
      phoneNumber,
      username,
      hashedPassword,
    };
    await createUser(user);
    res.status(201).json({
      user,
      message: "Registered Successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = { postRegister };
