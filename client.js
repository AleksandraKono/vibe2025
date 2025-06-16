const API = '';
let token = null;
let editingId = null;

// UI
const authModal  = document.getElementById('authModal');
const authMsg    = document.getElementById('authMsg');
const usernameEl = document.getElementById('username');
const passwordEl = document.getElementById('password');
const loginBtn   = document.getElementById('loginBtn');
const registerBtn= document.getElementById('registerBtn');

const todoApp    = document.getElementById('todoApp');
const logoutBtn  = document.getElementById('logoutBtn');
const listBody   = document.getElementById('listBody');
const newItemEl  = document.getElementById('newItem');
const addBtn     = document.getElementById('addBtn');

// Устанавливаем/снимаем токен
function setToken(t) {
  token = t;
  if (token) {
    localStorage.setItem('todoToken', token);
    authModal.style.display = 'none';
    todoApp.style.display = 'block';
  } else {
    localStorage.removeItem('todoToken');
    authModal.style.display = '';
    todoApp.style.display = 'none';
  }
}

// Обёртка fetch, добавляет Authorization
async function apiFetch(url, opts = {}) {
  opts.headers = opts.headers || {};
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API + url, opts);
  if (res.status === 401) setToken(null);
  return res;
}

// Авторизация/регистрация
async function handleAuth(path) {
  authMsg.textContent = '';
  const username = usernameEl.value.trim();
  const password = passwordEl.value.trim();
  if (!username || !password) {
    authMsg.textContent = 'Both fields required';
    return;
  }
  const res = await apiFetch(`/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (path === 'login' && res.ok && data.token) {
    setToken(data.token);
    await fetchList();
  } else if (path === 'register' && res.ok) {
    authMsg.style.color = 'green';
    authMsg.textContent = 'Registered! Now login.';
  } else {
    authMsg.style.color = 'red';
    authMsg.textContent = data.error || 'Error';
  }
}

loginBtn.addEventListener('click',    () => handleAuth('login'));
registerBtn.addEventListener('click', () => handleAuth('register'));
logoutBtn.addEventListener('click',   () => setToken(null));

// Рендер списка с inline‑редактированием
function renderList(items) {
  listBody.innerHTML = '';
  items.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.id = item.id;

    if (editingId === item.id) {
      tr.innerHTML = `
        <td>${idx+1}</td>
        <td><input class="edit-input" value="${item.text}"></td>
        <td>
          <button class="save-btn">Save</button>
          <button class="cancel-btn">Cancel</button>
        </td>`;
    } else {
      tr.innerHTML = `
        <td>${idx+1}</td>
        <td>${item.text}</td>
        <td>
          <button class="edit-btn">Edit</button>
          <button class="delete-btn">Delete</button>
        </td>`;
    }
    listBody.appendChild(tr);
  });

  // Delete
  document.querySelectorAll('.delete-btn').forEach(b =>
    b.onclick = async () => {
      const id = b.closest('tr').dataset.id;
      await apiFetch(`/items/${id}`, { method: 'DELETE' });
      fetchList();
    }
  );

  // Edit
  document.querySelectorAll('.edit-btn').forEach(b =>
    b.onclick = () => {
      editingId = Number(b.closest('tr').dataset.id);
      fetchList();
    }
  );

  // Save
  document.querySelectorAll('.save-btn').forEach(b =>
    b.onclick = async () => {
      const tr = b.closest('tr');
      const id = tr.dataset.id;
      const text = tr.querySelector('.edit-input').value.trim();
      if (text) {
        await apiFetch(`/items/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
      }
      editingId = null;
      fetchList();
    }
  );

  // Cancel
  document.querySelectorAll('.cancel-btn').forEach(b =>
    b.onclick = () => {
      editingId = null;
      fetchList();
    }
  );
}

// Загрузить и отобразить список
async function fetchList() {
  const res = await apiFetch('/items');
  if (!res.ok) return;
  const items = await res.json();
  renderList(items);
}

// Добавить
addBtn.onclick = async () => {
  const text = newItemEl.value.trim();
  if (!text) return;
  await apiFetch('/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  newItemEl.value = '';
  fetchList();
};

// Инициализация при загрузке
window.onload = () => {
  const saved = localStorage.getItem('todoToken');
  if (saved) setToken(saved), fetchList();
};
