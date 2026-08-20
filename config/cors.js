const DEVELOPMENT_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

function normalizeOrigin(value) {
  if (!value || typeof value !== "string") return null;

  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

function getAllowedOrigins() {
  const configuredOrigins = [
    process.env.CLIENT_URL,
    ...(process.env.CORS_ORIGINS || "").split(","),
  ];

  return [
    ...new Set(
      [...DEVELOPMENT_ORIGINS, ...configuredOrigins]
        .map(normalizeOrigin)
        .filter(Boolean),
    ),
  ];
}

function isAllowedOrigin(origin) {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);
  return (
    normalizedOrigin !== null && getAllowedOrigins().includes(normalizedOrigin)
  );
}

const corsOptions = {
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  credentials: true,
  maxAge: 86400,
};

module.exports = { corsOptions, getAllowedOrigins, isAllowedOrigin };
