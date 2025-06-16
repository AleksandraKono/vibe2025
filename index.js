require('dotenv').config();

const express = require('express');
const path    = require('path');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const mysql   = require('mysql2/promise');

const {
  PORT        = 3000,
  DB_HOST,
  DB_USER,
  DB_PASS,
  DB_NAME,
  JWT_SECRET
} = process.env;

// Проверяем обязательные переменные
if (!DB_HOST || !DB_USER || !DB_PASS || !DB_NAME || !JWT_SECRET) {
  console.error('❌ Missing one of DB_HOST, DB_USER, DB_PASS, DB_NAME or JWT_SECRET in .env');
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// Настраиваем пул соединений MySQL
const pool = mysql.createPool({
  host:            DB_HOST,
  user:            DB_USER,
  password:        DB_PASS,
  database:        DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit:     0
});

// ── JWT Auth middleware ─────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── Registration ────────────────────────────────────────────────────────────────
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, hash]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── Login ───────────────────────────────────────────────────────────────────────
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT id, password_hash FROM users WHERE username = ?',
      [username]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '4h' });
    res.json({ success: true, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── CRUD для To‑Do items ────────────────────────────────────────────────────────

// Получить все задачи текущего пользователя
app.get('/items', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, text FROM items WHERE user_id = ? ORDER BY id',
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch items error:', err);
    res.status(500).json({ error: 'Could not retrieve items' });
  }
});

// Добавить новую задачу
app.post('/items', authMiddleware, async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO items (text, user_id) VALUES (?, ?)',
      [text, req.userId]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('Add item error:', err);
    res.status(500).json({ error: 'Could not add item' });
  }
});

// Обновить задачу
app.put('/items/:id', authMiddleware, async (req, res) => {
  const { id }   = req.params;
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }
  try {
    const [result] = await pool.query(
      'UPDATE items SET text = ? WHERE id = ? AND user_id = ?',
      [text, id, req.userId]
    );
    if (result.affectedRows === 0) {
      return res.status(403).json({ error: 'Item not found or not yours' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Edit item error:', err);
    res.status(500).json({ error: 'Could not edit item' });
  }
});

// Удалить задачу
app.delete('/items/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      'DELETE FROM items WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );
    if (result.affectedRows === 0) {
      return res.status(403).json({ error: 'Item not found or not yours' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete item error:', err);
    res.status(500).json({ error: 'Could not delete item' });
  }
});

// ── Сервинг фронтенда ──────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Запуск сервера ─────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Express server listening on 0.0.0.0:${PORT}`);
});
