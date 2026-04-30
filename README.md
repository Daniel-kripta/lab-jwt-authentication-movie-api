![logo_ironhack_blue 7](https://user-images.githubusercontent.com/23629340/40541063-a07a0a8a-601a-11e8-91b5-2f13e4e6b441.png)

# Lab D1: Autenticación JWT — Proteger la API de Películas

## Objetivo

Añadir un sistema de autenticación completo a la API de películas usando **bcrypt** para hashear contraseñas y **JWT** para emitir tokens. Al terminar, las rutas de escritura estarán protegidas y solo los usuarios con rol `admin` podrán crear, actualizar o eliminar películas.

## Requisitos previos

- Haber completado la API de películas con PostgreSQL (Lab D4 de w6)
- Haber leído el material del D1 de w7
- PostgreSQL en marcha con la base de datos `peliculas_db`
- Postman o Thunder Client

## Lo que vas a construir

```
POST /api/auth/registro   ← Crea un usuario (hashea contraseña, devuelve JWT)
POST /api/auth/login      ← Verifica credenciales, devuelve JWT

GET  /api/peliculas       ← Pública (sin token)
GET  /api/peliculas/:id   ← Pública

POST /api/peliculas       ← Protegida (cualquier usuario autenticado)
PUT  /api/peliculas/:id   ← Protegida (solo admin)
DELETE /api/peliculas/:id ← Protegida (solo admin)
```

## Paso 1: Instalar dependencias

```bash
npm install bcrypt jsonwebtoken
```

Añade al `.env`:

```
JWT_SECRET=mi-secreto-jwt-muy-largo-2024
JWT_EXPIRES_IN=24h
```

## Paso 2: Crear la tabla de usuarios

En psql:

```sql
-- c peliculas_db

CREATE TABLE usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol           VARCHAR(20) NOT NULL DEFAULT 'usuario'
                CHECK (rol IN ('usuario', 'admin')),
  activo        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

Inserta un admin de prueba manualmente (luego lo haremos desde la API):

```sql
-- La contraseña es "admin123" — el hash lo generaremos desde Node
-- Este paso es solo para verificar la tabla; la crearemos vía API en el paso 6
SELECT 'Tabla usuarios creada' AS resultado;
```

## Paso 3: Crear el controlador de autenticación

Crea `src/controllers/authController.js`:

```javascript
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const pool = require('../config/db')
const AppError = require('../utils/AppError')

const SALT_ROUNDS = 10

const generarToken = (usuario) => {
  return jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  )
}

// POST /api/auth/registro
const registro = async (req, res, next) => {
  try {
    const { nombre, email, password, rol } = req.body

    if (!nombre || !email || !password) {
      throw new AppError('nombre, email y password son obligatorios', 400)
    }

    if (password.length < 6) {
      throw new AppError('La contraseña debe tener al menos 6 caracteres', 400)
    }

    // Comprobar si el email ya existe
    const existe = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email])
    if (existe.rows.length > 0) {
      throw new AppError('Ya existe un usuario con ese email', 409)
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS)

    // Solo permitir crear admins si se especifica el rol (en producción esto estaría más restringido)
    const rolFinal = rol === 'admin' ? 'admin' : 'usuario'

    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, email, rol, created_at`,
      [nombre, email, password_hash, rolFinal]
    )

    const usuario = rows[0]
    const token = generarToken(usuario)

    res.status(201).json({ token, usuario })

  } catch (err) {
    next(err)
  }
}

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      throw new AppError('email y password son obligatorios', 400)
    }

    const { rows } = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1 AND activo = true',
      [email]
    )

    if (rows.length === 0) {
      throw new AppError('Credenciales incorrectas', 401)
    }

    const usuario = rows[0]
    const passwordValida = await bcrypt.compare(password, usuario.password_hash)

    if (!passwordValida) {
      throw new AppError('Credenciales incorrectas', 401)
    }

    const token = generarToken(usuario)

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      }
    })

  } catch (err) {
    next(err)
  }
}

// GET /api/auth/perfil
const perfil = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, email, rol, created_at FROM usuarios WHERE id = $1',
      [req.usuario.id]
    )

    if (rows.length === 0) {
      throw new AppError('Usuario no encontrado', 404)
    }

    res.json(rows[0])
  } catch (err) {
    next(err)
  }
}

module.exports = { registro, login, perfil }
```

## Paso 4: Crear el middleware `verificarToken`

Crea `src/middleware/verificarToken.js`:

```javascript
const jwt = require('jsonwebtoken')
const AppError = require('../utils/AppError')

const verificarToken = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Token no proporcionado', 401))
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.usuario = payload
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token expirado', 401))
    }
    return next(new AppError('Token inválido', 401))
  }
}

module.exports = verificarToken
```

## Paso 5: Crear el middleware `verificarRol`

Crea `src/middleware/verificarRol.js`:

```javascript
const AppError = require('../utils/AppError')

// Uso: verificarRol('admin') o verificarRol('admin', 'moderador')
const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return next(new AppError('No autenticado', 401))
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return next(new AppError(
        `Acceso denegado. Se requiere rol: ${rolesPermitidos.join(' o ')}`,
        403
      ))
    }

    next()
  }
}

module.exports = verificarRol
```

## Paso 6: Crear el router de autenticación

Crea `src/routes/auth.js`:

```javascript
const { Router } = require('express')
const router = Router()
const { registro, login, perfil } = require('../controllers/authController')
const verificarToken = require('../middleware/verificarToken')

router.post('/registro', registro)
router.post('/login', login)
router.get('/perfil', verificarToken, perfil)

module.exports = router
```

## Paso 7: Proteger las rutas de películas

Modifica `src/routes/peliculas.js` para añadir los middlewares de autenticación:

```javascript
const { Router } = require('express')
const router = Router()
const verificarToken = require('../middleware/verificarToken')
const verificarRol = require('../middleware/verificarRol')
const {
  listarPeliculas,
  obtenerPelicula,
  crearPelicula,
  actualizarPelicula,
  eliminarPelicula,
  listarResenas,
  crearResena
} = require('../controllers/peliculasController')

// Rutas públicas
router.get('/', listarPeliculas)
router.get('/:id', obtenerPelicula)
router.get('/:id/resenas', listarResenas)

// Rutas protegidas: cualquier usuario autenticado
router.post('/', verificarToken, crearPelicula)
router.post('/:id/resenas', verificarToken, crearResena)

// Rutas protegidas: solo admin
router.put('/:id', verificarToken, verificarRol('admin'), actualizarPelicula)
router.delete('/:id', verificarToken, verificarRol('admin'), eliminarPelicula)

module.exports = router
```

## Paso 8: Montar el router de auth en index.js

```javascript
// Añade en index.js junto a los demás routers:
const authRouter = require('./src/routes/auth')

app.use('/api/auth', authRouter)
```

## Paso 9: Probar el flujo completo

### 9.1 Registro

```bash
curl -X POST http://localhost:3000/api/auth/registro \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Carlos Admin",
    "email": "carlos@test.com",
    "password": "segura123",
    "rol": "admin"
  }'
```

Guarda el `token` de la respuesta.

### 9.2 Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "carlos@test.com", "password": "segura123"}'
```

### 9.3 Ruta pública (sin token)

```bash
curl http://localhost:3000/api/peliculas
```
→ Debe funcionar sin token.

### 9.4 Ruta protegida sin token

```bash
curl -X POST http://localhost:3000/api/peliculas \
  -H "Content-Type: application/json" \
  -d '{"titulo": "Test", "anio": 2024}'
```
→ Debe devolver **401**.

### 9.5 Ruta protegida con token

```bash
TOKEN="pega_aqui_tu_token"

curl -X POST http://localhost:3000/api/peliculas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "titulo": "Dune",
    "anio": 2021,
    "nota": 8.0,
    "director": "Denis Villeneuve",
    "genero": "ciencia-ficcion"
  }'
```
→ Debe devolver **201** con la nueva película.

### 9.6 Ruta de admin con usuario normal

```bash
# Primero crea un usuario sin rol admin
curl -X POST http://localhost:3000/api/auth/registro \
  -H "Content-Type: application/json" \
  -d '{"nombre": "User Normal", "email": "user@test.com", "password": "pass123"}'

# Usa el token del usuario normal para intentar eliminar
TOKEN_NORMAL="token_del_usuario_normal"

curl -X DELETE http://localhost:3000/api/peliculas/1 \
  -H "Authorization: Bearer $TOKEN_NORMAL"
```

→ Debe devolver **403 Acceso denegado**.

### 9.7 Perfil del usuario autenticado

```bash
curl http://localhost:3000/api/auth/perfil \
  -H "Authorization: Bearer $TOKEN"
```
→ Devuelve los datos del usuario extraídos del token.

## Parte 2: Reflexión

Responde en un archivo `NOTAS.md`:

1. **¿Por qué es importante que el mensaje de error del login sea genérico** ("Credenciales incorrectas") en lugar de especificar si fue el email o la contraseña lo que falló?

2. **¿Qué información NO deberías guardar nunca en el payload del JWT?** (pista: piensa en qué información es visible para cualquiera que tenga el token)

3. **¿Por qué usamos `bcrypt.compare` en lugar de hashear la contraseña y compararla con `===`?**

## Criterios de evaluación

- [ ] `POST /api/auth/registro` crea el usuario y devuelve un token JWT
- [ ] `POST /api/auth/registro` con email duplicado devuelve 409
- [ ] `POST /api/auth/login` con credenciales correctas devuelve token
- [ ] `POST /api/auth/login` con contraseña incorrecta devuelve 401
- [ ] `GET /api/peliculas` funciona sin token (pública)
- [ ] `POST /api/peliculas` sin token devuelve 401
- [ ] `POST /api/peliculas` con token válido crea la película (201)
- [ ] `DELETE /api/peliculas/:id` con token de usuario normal devuelve 403
- [ ] `DELETE /api/peliculas/:id` con token de admin funciona correctamente
- [ ] Las contraseñas NO se guardan en texto plano en la base de datos

## Bonus

1. **Refresh tokens**: Implementa un endpoint `POST /api/auth/refresh` que acepte un refresh token (guardado en la base de datos) y emita un nuevo access token de corta duración (15 minutos). El refresh token debe tener una duración de 7 días.

2. **Blacklist de tokens**: Crea una tabla `tokens_invalidos` y un endpoint `POST /api/auth/logout` que guarde el token actual en esa tabla. Modifica `verificarToken` para rechazar tokens que estén en esa blacklist.

3. **Middleware de auditoría**: Crea un middleware que registre en una tabla `log_accesos` cada petición a rutas protegidas: usuario, ruta, método, fecha y código de respuesta.