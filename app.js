const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const syncRouter = require("./routes/syncRouter");
const authRouter = require("./routes/authRouter");

const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

app.use(syncRouter);
app.use(authRouter);

module.exports = app;
