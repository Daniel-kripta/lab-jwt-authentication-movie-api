const { Router } = require('express')
const { register, login, getProfile, logout, refresh} = require('../controllers/authController')
const verificarToken = require('../middleware/verificarToken')

const router = Router()


router.post('/registro', register)
router.post('/login', login)
router.post('/refresh', refresh)
router.post('/logout', verificarToken, logout)
router.get('/perfil', verificarToken, getProfile)


module.exports = router