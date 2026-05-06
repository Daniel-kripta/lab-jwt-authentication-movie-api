const { Router } = require('express')
const {
  listarDirectores,
  obtenerPeliculasDirector,
} = require('../controllers/directoresController')

const router = Router()

router.get('/', listarDirectores)
router.get('/:id/peliculas', obtenerPeliculasDirector)


module.exports = router
