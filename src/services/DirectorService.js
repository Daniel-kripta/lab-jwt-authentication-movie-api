const pool = require("../config/db");
const AppError = require("../utils/AppError");

class DirectorService {
  async obtenerTodos() {
    const { rows } = await pool.query(
      "SELECT * FROM directores ORDER BY nombre",
    );
    return rows;
  }

  async obtenerPorId(director_id) {
    const { rows } = await pool.query(
      `SELECT
        p.id, p.titulo, p.anio, p.nota,
        d.id AS director_id, d.nombre AS director, d.nacionalidad,
        g.id AS genero_id, g.nombre AS genero
       FROM peliculas p
       LEFT JOIN directores d ON p.director_id = d.id
       LEFT JOIN generos g ON p.genero_id = g.id
       WHERE p.director_id = $1`,
      [director_id],
    );

    if (rows.length === 0)
      throw new AppError("El director no existe o no tiene películas", 404);
    return rows;
  }
}

module.exports = new DirectorService();
