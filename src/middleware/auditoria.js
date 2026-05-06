const pool = require('../config/db');

const auditoria = (req, res, next) => {

    res.on('finish', () => {

      pool.query(
      `INSERT INTO log_accesos (usuario_id, email, ruta, metodo, estado)
         VALUES ($1, $2, $3, $4, $5)
       `,
      [req.user?.userId, req.user?.email, req.url, req.method, res.statusCode],
    );
    

    });
next();

};

module.exports = auditoria;