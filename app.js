const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { corsOptions } = require("./config/cors");

const syncRouter = require("./routes/syncRouter");
const authRouter = require("./routes/authRouter");
const dashboardRouter = require("./routes/dashboardRouter");
const salesReportRouter = require("./routes/salesReportRouter");
const purchaseReportRouter = require("./routes/purchaseReportRouter");
const outstandingRouter = require("./routes/outstandingRouter");
const cashflowRouter = require("./routes/cashflowRouter");
const syncSourceRouter = require("./routes/syncSourceRouter");

const app = express();

app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));

app.get("/", (_req, res) => {
  res.status(200).json({
    service: "dashboard-backend",
    status: "ok",
    apiBasePath: "/api/v1",
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
app.use(cookieParser());

app.use(syncRouter);
app.use(authRouter);
app.use(syncSourceRouter);
app.use(dashboardRouter);
app.use(salesReportRouter);
app.use(purchaseReportRouter);
app.use(outstandingRouter);
app.use(cashflowRouter);

module.exports = app;
