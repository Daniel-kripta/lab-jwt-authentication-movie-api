const DirectorService = require("../services/DirectorService")

const listarDirectores = async (req, res, next) => {
  try {
    
    const directores = await DirectorService.obtenerTodos()
    res.json(directores)
  } catch (err) {
    next(err)
  }
}

const obtenerPeliculasDirector = async (req, res, next) => {
  try {
    const pelicula = await DirectorService.obtenerPorId(Number(req.params.id))
    res.json(pelicula)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listarDirectores,
  obtenerPeliculasDirector,
}