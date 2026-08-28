import jwt from "jsonwebtoken";

const isProduction = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  sameSite: isProduction ? "none" : "lax",
  secure: isProduction,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

export function setToken(res, id) {
  const token = jwt.sign(
    { id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("token", token, cookieOptions);
}

export function clearToken(res) {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    path: "/",
  });
}
