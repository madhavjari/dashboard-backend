require("dotenv").config();
const express = require("express");
const app = express();
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));
const { Router } = require("express");

const dataRouter = Router();

dataRouter.post("/data", (req, res) => {
  const data = req.body;
  console.log("Successfully received data sample from Port 3000:");
  console.log(data);
  res.status(200).json({
    success: true,
    message: `Received ${data.length || 0} rows successfully!`,
  });
});

app.use(dataRouter);
const PORT = 5000;
app.listen(PORT, (error) => {
  if (error) {
    throw error;
  }
  console.log(`Server running on port ${PORT}`);
});
