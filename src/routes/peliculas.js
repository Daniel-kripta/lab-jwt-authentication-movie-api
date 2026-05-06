const { Router } = require('express')
const {
  listarPeliculas,
  obtenerPelicula,
  crearPelicula,
  actualizarPelicula,
  eliminarPelicula,
  listarResenas,
  crearResena
} = require('../controllers/peliculasController')

const router = Router()

const verificarToken = require('../middleware/verificarToken');
const verificarRol = require('../middleware/verificarRol');


router.get('/', listarPeliculas)
router.get('/:id', obtenerPelicula)
router.post('/', verificarToken, crearPelicula)
router.put('/:id', verificarToken, verificarRol('admin', 'moderador'), actualizarPelicula)
router.delete('/:id', verificarToken, verificarRol('admin'), eliminarPelicula)

router.get('/:id/resenas', listarResenas)
router.post('/:id/resenas', verificarToken, crearResena)

module.exports = router
