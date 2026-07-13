const validate = (schema) => async (req, res, next) => {
  const result = await schema.safeParseAsync({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (!result.success) {
    const errors = {};
    for (const issue of result.error.issues) {
      const [, ...fieldPath] = issue.path;
      const key = fieldPath.join(".") || issue.path[0];
      if (!errors[key]) errors[key] = [];
      errors[key].push(issue.message);
    }
    return res.status(400).json({ status: "fail", errors });
  }
  req.body = result.data.body ?? req.body;
  req.query = result.data.query ?? req.query;
  req.params = result.data.params ?? req.params;

  next();
};

module.exports = { validate };
