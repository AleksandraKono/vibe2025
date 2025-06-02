const http = require('http');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const PORT = 3000;
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '1310',
  database: 'todolist'
};

// Функция для получения списка из БД
async function retrieveListItems() {
  const conn = await mysql.createConnection(dbConfig);
  const [rows] = await conn.execute('SELECT id, text FROM items ORDER BY id');
  await conn.end();
  return rows; // массив {id, text}
}

// Endpoint GET /list → возвращаем JSON-массив
async function handleList(req, res) {
  try {
    const todoItems = await retrieveListItems();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(todoItems));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'DB error' }));
  }
}

// Endpoint POST /add → принимает JSON { text }, вставляет в БД
async function handleAdd(req, res) {
  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    const { text } = JSON.parse(body);
    if (!text || typeof text !== 'string') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid text' }));
      return;
    }
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute('INSERT INTO items (text) VALUES (?)', [text]);
    await conn.end();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'DB insert error' }));
  }
}

// Основной обработчик запросов
async function handleRequest(req, res) {
  if (await handleStaticFile(req, res)) return;

  if (req.method === 'GET' && req.url === '/list') {
    await handleList(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/add') {
    await handleAdd(req, res);
    return;
  }

  if (req.method === 'DELETE' && req.url.startsWith('/delete/')) {
  try {
    const id = req.url.split('/')[2]; // получаем id из пути
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute('DELETE FROM items WHERE id = ?', [id]);
    await conn.end();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'DB delete error' }));
  }
  return;
}

  if (req.method === 'GET' && req.url === '/') {
    try {
      const html = await fs.promises.readFile(path.join(__dirname, 'index.html'), 'utf8');
      // Сразу отрендерим пустые {{rows}} или не используем рендеринг сервер‐шаблона,
      // так как клиентская часть будет подтягивать через AJAX
      const processedHtml = html.replace('{{rows}}', '');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(processedHtml);
    } catch (err) {
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading index.html');
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Route not found');
}

const server = http.createServer(handleRequest);

const url = require('url');

// Отдача статических файлов (client.js, стили и т.д.)
async function handleStaticFile(req, res) {
  const parsedUrl = url.parse(req.url);
  const safePath = path.normalize(parsedUrl.pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const fileStream = fs.createReadStream(filePath);
    res.writeHead(200, { 'Content-Type': getContentType(filePath) });
    fileStream.pipe(res);
    return true; // файл найден и отдан
  }
  return false; // не файл
}

function getContentType(filePath) {
  if (filePath.endsWith('.js')) return 'application/javascript';
  if (filePath.endsWith('.css')) return 'text/css';
  if (filePath.endsWith('.html')) return 'text/html';
  return 'application/octet-stream';
}

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));