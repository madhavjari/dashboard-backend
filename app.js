const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const syncRouter = require("./routes/syncRouter");
const authRouter = require("./routes/authRouter");
const dashboardRouter = require("./routes/dashboardRouter");
const salesReportRouter = require("./routes/salesReportRouter");
const purchaseReportRouter = require("./routes/purchaseReportRouter");
const outstandingRouter = require("./routes/outstandingRouter");
const cashflowRouter = require("./routes/cashflowRouter");

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
app.use(dashboardRouter);
app.use(salesReportRouter);
app.use(purchaseReportRouter);
app.use(outstandingRouter);
app.use(cashflowRouter);

module.exports = app;
