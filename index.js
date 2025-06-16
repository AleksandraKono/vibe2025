// index.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

// пул соединений, чтобы не открывать новое на каждый запрос
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// GET /list
app.get('/list', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, text FROM items ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// POST /add
app.post('/add', async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Invalid text' });
  }
  try {
    await pool.query('INSERT INTO items (text) VALUES (?)', [text]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB insert error' });
  }
});

// DELETE /delete/:id
app.delete('/delete/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM items WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB delete error' });
  }
});

// PUT /edit/:id
app.put('/edit/:id', async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Invalid text' });
  }
  try {
    await pool.query('UPDATE items SET text = ? WHERE id = ?', [text, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB update error' });
  }
});

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Express server listening on 0.0.0.0:${PORT}`);
});
