const API_URL = 'http://localhost:3000';

// Текущее редактируемое id (null, если ни один)
let editingId = null;

// Рендерит список: если editingId === item.id, рисуем row в режиме редактирования
function renderList(data) {
  const tbody = document.getElementById('listBody');
  tbody.innerHTML = '';

  data.forEach((item, index) => {
    const row = document.createElement('tr');
    row.setAttribute('data-id', item.id);

    if (editingId == item.id) {
      // --- Режим редактирования этой строки ---
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>
          <input type="text" class="edit-input" value="${item.text}" />
        </td>
        <td>
          <button class="save-btn" data-id="${item.id}">Save</button>
          <button class="cancel-btn">Cancel</button>
        </td>
      `;
    } else {
      // --- Обычный режим вывода ---
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${item.text}</td>
        <td>
          <button class="edit-btn" data-id="${item.id}">Edit</button>
          <button class="remove-btn" data-id="${item.id}">Remove</button>
        </td>
      `;
    }

    tbody.appendChild(row);
  });

  // Навешиваем handler’ы:
  // 1) Remove
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      try {
        const resp = await fetch(`${API_URL}/delete/${id}`, { method: 'DELETE' });
        if (!resp.ok) throw new Error('Ошибка при удалении');
        await fetchList();
      } catch (err) {
        console.error(err);
      }
    });
  });

  // 2) Edit → устанавливаем editingId и перерисовываем
document.querySelectorAll('.edit-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    editingId = Number(e.target.dataset.id); // преобразуем к числу
    console.log('Editing id set to', editingId);
    fetchList();
  });
});

  // 3) Save (только те, что в режиме редактирования)
  document.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      // Находим <input> в той же строке:
      const input = document.querySelector(`tr[data-id="${id}"] .edit-input`);
      const newText = input.value.trim();
      if (!newText) {
        editingId = null;
        fetchList();
        return;
      }
      try {
        const resp = await fetch(`${API_URL}/edit/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: newText })
        });
        if (!resp.ok) throw new Error('Ошибка при сохранении');
        editingId = null;
        await fetchList();
      } catch (err) {
        console.error(err);
      }
    });
  });

  // 4) Cancel (также только в режиме редактирования)
  document.querySelectorAll('.cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      editingId = null;
      fetchList();
    });
  });
}

// Получение списка (GET /list)
async function fetchList() {
  try {
    const resp = await fetch(`${API_URL}/list`);
    if (!resp.ok) throw new Error('Ошибка при загрузке списка');
    const data = await resp.json();
    renderList(data);
  } catch (err) {
    console.error(err);
  }
}

// Добавление нового элемента (POST /add)
async function addItem() {
  const input = document.getElementById('newItem');
  const text = input.value.trim();
  if (!text) return;
  try {
    const resp = await fetch(`${API_URL}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!resp.ok) throw new Error('Ошибка при добавлении');
    input.value = '';
    await fetchList();
  } catch (err) {
    console.error(err);
  }
}

// Привязываем Add btn и Enter
document.getElementById('addBtn').addEventListener('click', addItem);
document.getElementById('newItem').addEventListener('keyup', e => {
  if (e.key === 'Enter') addItem();
});

// Loader initial
window.addEventListener('DOMContentLoaded', fetchList);