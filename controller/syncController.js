async function postBillData(req, res) {
  const data = req.body;
  const { user } = req.params;
  console.log(data);
  console.log(user);
  res.status(200).json({
    success: true,
    message: `Received ${data.length || 0} rows successfully!`,
  });
}

module.exports = { postBillData };
