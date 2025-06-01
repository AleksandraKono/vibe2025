const API_URL = 'http://localhost:3000';

function renderList(data) {
  const tbody = document.getElementById('listBody');
  tbody.innerHTML = '';

  data.forEach((item, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${item.text}</td>
      <td>
        <button class="remove-btn" data-id="${item.id}">Remove</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // в feature/add-item пока просто чисто логируем
      console.log('Remove clicked for id =', e.target.dataset.id);
    });
  });
}

async function fetchList() {
  try {
    const resp = await fetch(`${API_URL}/list`);
    if (!resp.ok) throw new Error('Ошибка при загрузке списка');
    const json = await resp.json();
    renderList(json);
  } catch (err) {
    console.error(err);
  }
}

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

document.getElementById('addBtn').addEventListener('click', addItem);
document.getElementById('newItem').addEventListener('keyup', e => {
  if (e.key === 'Enter') addItem();
});

window.addEventListener('DOMContentLoaded', fetchList);