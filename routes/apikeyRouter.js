const { Router } = require("express");
const crypto = require("crypto");

const apikeyRouter = Router();

// apikeyRouter.post("/api/:username/generateApikey", (req, res) => {
const apikey = crypto.randomBytes(32).toString("hex");
console.log(apikey);
// });

module.exports = apikeyRouter;
