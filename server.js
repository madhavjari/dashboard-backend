const express = require("express");
const app = express();
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));
const syncRouter = require("./routes/syncRouter");
const authRouter = require("./routes/authRouter");

app.use(syncRouter);
app.use(authRouter);
const PORT = 5000;
app.listen(PORT, (error) => {
  if (error) {
    throw error;
  }
  console.log(`Server running on port ${PORT}`);
});
