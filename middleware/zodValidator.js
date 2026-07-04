const validate = (schema) => async (req, res, next) => {
  const result = await schema.safeParseAsync({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (!result.success) {
    return res.status(400).json({
      status: "fail",
      errors: result.error.flatten().fieldErrors,
    });
  }
  req.body = result.data.body;
  req.query = result.data.query;
  req.params = result.data.params;

  next();
};

module.exports = { validate };
