require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Инициализация бота
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Сессии
const sessions = new Map();
function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, { state: 'idle', temp: {}, token: null });
  }
  return sessions.get(chatId);
}

// Клавиатура в меню
const mainKeyboard = {
  reply_markup: {
    keyboard: [
      ['📋 My To-Do List', '➕ Add Task'],
      ['✏️ Edit Task', '❌ Delete Task'],
      ['🔑 Login', '🆕 Register'],
      ['🚪 Logout']
    ],
    resize_keyboard: true
  }
};

// Старт
bot.onText(/\/start/, msg => {
  const chatId = msg.chat.id;
  const session = getSession(chatId);
  session.state = 'idle'; session.temp = {}; session.token = null;
  bot.sendMessage(chatId, 'Welcome! Choose an action:', mainKeyboard);
});

bot.on('message', async msg => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const session = getSession(chatId);

  try {
    // Logout
    if (text === '🚪 Logout') {
      sessions.delete(chatId);
      return bot.sendMessage(chatId, 'You have been logged out.', mainKeyboard);
    }

    // Registration
    if (text === '🆕 Register') {
      session.state = 'register_username'; session.temp = {};
      return bot.sendMessage(chatId, 'Enter new username:');
    }
    if (session.state === 'register_username') {
      session.temp.username = text.trim();
      session.state = 'register_password';
      return bot.sendMessage(chatId, 'Enter password:');
    }
    if (session.state === 'register_password') {
      const { username } = session.temp;
      const password = text.trim();
      try {
        const resp = await axios.post(`http://localhost:3000/register`, { username, password });
        session.state = 'idle'; session.temp = {};
        return bot.sendMessage(chatId, 'Registration successful! Please login.', mainKeyboard);
      } catch (err) {
        const e = err.response?.data.error || err.message;
        return bot.sendMessage(chatId, 'Registration error: ' + e);
      }
    }

    // Login
    if (text === '🔑 Login') {
      session.state = 'login_username'; session.temp = {};
      return bot.sendMessage(chatId, 'Enter username:');
    }
    if (session.state === 'login_username') {
      session.temp.username = text.trim();
      session.state = 'login_password';
      return bot.sendMessage(chatId, 'Enter password:');
    }
    if (session.state === 'login_password') {
      const { username } = session.temp;
      const password = text.trim();
      try {
        const resp = await axios.post(`http://localhost:3000/login`, { username, password });
        session.token = resp.data.token;
        session.state = 'idle'; session.temp = {};
        return bot.sendMessage(chatId, 'Login successful.', mainKeyboard);
      } catch (err) {
        const e = err.response?.data.error || err.message;
        return bot.sendMessage(chatId, 'Login error: ' + e);
      }
    }

    // View list
    if (text === '📋 My To-Do List') {
      if (!session.token) return bot.sendMessage(chatId, 'Please login first.', mainKeyboard);
      try {
        const resp = await axios.get(`http://localhost:3000/items`, { headers: { Authorization: `Bearer ${session.token}` } });
        const items = resp.data;
        if (!items.length) {
          return bot.sendMessage(chatId, 'Your list is empty.', mainKeyboard);
        }
        const list = items.map((it, i) => `${i+1}. ${it.text}`).join('\n');
        return bot.sendMessage(chatId, `Your To-Do:\n${list}`, mainKeyboard);
      } catch (err) {
        const e = err.response?.data.error || err.message;
        return bot.sendMessage(chatId, 'Error fetching list: ' + e, mainKeyboard);
      }
    }

    // Add task
    if (text === '➕ Add Task') {
      if (!session.token) return bot.sendMessage(chatId, 'Please login first.', mainKeyboard);
      session.state = 'add_task';
      return bot.sendMessage(chatId, 'Enter new task text:');
    }
    if (session.state === 'add_task') {
      const textTask = text.trim();
      try {
        await axios.post(`http://localhost:3000/items`, { text: textTask }, { headers: { Authorization: `Bearer ${session.token}` } });
        session.state = 'idle';
        return bot.sendMessage(chatId, 'Task added.', mainKeyboard);
      } catch (err) {
        const e = err.response?.data.error || err.message;
        return bot.sendMessage(chatId, 'Error adding: ' + e, mainKeyboard);
      }
    }

    // Edit task
    if (text === '✏️ Edit Task') {
      if (!session.token) return bot.sendMessage(chatId, 'Please login first.', mainKeyboard);
      session.state = 'edit_ask_id';
      return bot.sendMessage(chatId, 'Enter task number to edit:');
    }
    if (session.state === 'edit_ask_id') {
      session.temp.id = parseInt(text);
      session.state = 'edit_ask_text';
      return bot.sendMessage(chatId, 'Enter new text:');
    }
    if (session.state === 'edit_ask_text') {
      const id = session.temp.id;
      const newText = text.trim();
      try {
        await axios.put(`http://localhost:3000/items/${id}`, { text: newText }, { headers: { Authorization: `Bearer ${session.token}` } });
        session.state = 'idle'; session.temp = {};
        return bot.sendMessage(chatId, 'Task edited.', mainKeyboard);
      } catch (err) {
        const e = err.response?.data.error || err.message;
        return bot.sendMessage(chatId, 'Error editing: ' + e, mainKeyboard);
      }
    }

    // Delete task
    if (text === '❌ Delete Task') {
      if (!session.token) return bot.sendMessage(chatId, 'Please login first.', mainKeyboard);
      session.state = 'delete_ask_id';
      return bot.sendMessage(chatId, 'Enter task number to delete:');
    }
    if (session.state === 'delete_ask_id') {
      const id = parseInt(text);
      try {
        await axios.delete(`http://localhost:3000/items/${id}`, { headers: { Authorization: `Bearer ${session.token}` } });
        session.state = 'idle'; session.temp = {};
        return bot.sendMessage(chatId, 'Task deleted.', mainKeyboard);
      } catch (err) {
        const e = err.response?.data.error || err.message;
        return bot.sendMessage(chatId, 'Error deleting: ' + e, mainKeyboard);
      }
    }

  } catch (error) {
    console.error('Handler error:', error);
    bot.sendMessage(chatId, 'Unexpected error.', mainKeyboard);
  }
});
