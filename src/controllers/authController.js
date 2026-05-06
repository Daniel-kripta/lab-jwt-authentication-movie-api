const authService = require('../services/authService');
const pool = require('../config/db');
const jwt = require("jsonwebtoken");



const register = async (req, res) =>{
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) return res.status(400).json({error: "Nombre, Password y Email son obligatorios"});
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({error: "Email no tiene formato correo"});
    if (password.length < 8) return res.status(400).json({error: "El Password debe tener al menos 8 caracteres"});

    try{
        const result = await authService.register({nombre, email, password});
        res.status(201).json(result);
    } catch (err){
        if (err.code === '23505') return res.status(409).json({error: "Este email ya está registrado"});
        res.status(500).json({error: err.message});
    } 
};

const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({error: "Email y Password son obligatorios"});

    try {
        const result = await authService.login({email, password});
        res.json(result);
    } catch (err) {
        res.status(401).json({error: err.message});
    }
};

const refresh = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) return res.status(400).json({ error: 'Refresh token obligatorio' });

    try {
        const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        const { rows } = await pool.query(
            'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
            [refreshToken]
        );

        if (rows.length === 0) return res.status(401).json({ error: 'Refresh token inválido o expirado' });

        const newToken = jwt.sign(
            { userId: payload.userId },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        res.json({ token: newToken });

    } catch (err) {
        res.status(401).json({ error: 'Refresh token inválido' });
    }
};


const getProfile = (req, res) => {
    res.json({profile: req.user, message: "Acceso autorizado"});
};


const logout = async (req, res) => {
    const token = req.headers.authorization.split(' ')[1];
    await pool.query('INSERT INTO tokens_invalidos (token) VALUES ($1)', [token]);
    res.json({message: 'Sesión cerrada con éxito'});
};

module.exports = {register, login, getProfile, logout, refresh};