const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const SALT_ROUNDS = 10;

const register = async ({ nombre, email, password }) => {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const { rows } = await pool.query(
    "INSERT INTO usuarios (nombre, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email, rol",
    [nombre, email, passwordHash],
  );

  const user = rows[0];
  const token = signToken(user);
  return { user, token };
};

const login = async ({ email, password }) => {
  const { rows } = await pool.query("SELECT * FROM usuarios WHERE email = $1 AND activo = true", [
    email,
  ]);
  const user = rows[0];

  if (!user) throw new Error("Credenciales incorrectas");

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) throw new Error("Credenciales incorrectas");

  const { password_hash, ...safeUser } = user;
  const token = signToken(safeUser);
  const refreshToken = signRefreshToken(user);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await pool.query(
    'INSERT INTO refresh_tokens (usuario_id, token, expires_at) VALUES ($1, $2, $3)',
    [user.id, refreshToken, expiresAt]
);

  return { user: safeUser, token, refreshToken };
};

const signToken = (user) => {
  return jwt.sign(
    { userId: user.id, email: user.email, rol: user.rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "24h" },
  );
};

const signRefreshToken = (user) => {
  return jwt.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
};

module.exports = { register, login };