const verificarRol = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "No autenticado" });

    if (!roles.includes(req.user.rol)) {
      return res
        .status(403)
        .json({
          error: `Acceso denegado. Requiere rol: ${roles.join(" o ")}, Tu rol es: ${req.user.rol}`,
        });
    }

    next();
  };
};

module.exports = verificarRol;