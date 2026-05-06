const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const verificarToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token válido no localizado" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await pool.query(
      "SELECT id FROM tokens_invalidos WHERE token = $1",
      [token],
    );

    if (rows.length > 0) {
      return res.status(401).json({ error: "Token inválido" });
    }

    req.user = payload;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ error: "Token expirado. Reinicia sesión." });
    }
    return res.status(401).json({ error: "Token inválido" });
  }
};

module.exports = verificarToken;
