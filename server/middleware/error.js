export function notFound(req, res) {
  res.status(404).json({ error: "Route not found" });
}

export function errorHandler(err, req, res, next) {
  console.error(err);

  const status = Number(err?.status) || 500;
  const message =
    process.env.NODE_ENV === "production" && status >= 500
      ? "Something went wrong on the server."
      : err?.message || "Server error";

  res.status(status).json({ error: message });
}
