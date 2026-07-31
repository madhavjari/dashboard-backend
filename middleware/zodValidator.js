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
  // In Express 5, req.query is a getter that reparses the URL on every access.
  // Defining an own property preserves Zod transformations for downstream handlers.
  if (result.data.query !== undefined) {
    Object.defineProperty(req, "query", {
      value: result.data.query,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
  req.params = result.data.params ?? req.params;

  next();
};

module.exports = { validate };
