// ===== ユーザー情報 =====
let currentUser = null;

async function loadUser() {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) {
      window.location.href = '/';
      return;
    }
    currentUser = await res.json();
    document.getElementById('user-name').textContent = currentUser.name;
  } catch {
    window.location.href = '/';
  }
}

// ===== ユーザー一覧読み込み =====
async function loadUsers() {
  const res = await fetch('/api/admin/users');
  if (!res.ok) {
    window.location.href = '/';
    return;
  }
  const users = await res.json();

  // 統計更新
  document.getElementById('total-users').textContent = users.length;
  document.getElementById('admin-count').textContent = users.filter(u => u.role === 'admin').length;
  document.getElementById('member-count').textContent = users.filter(u => u.role === 'member').length;

  // テーブル描画
  const tbody = document.getElementById('user-table-body');
  tbody.innerHTML = '';

  users.forEach(user => {
    const tr = document.createElement('tr');
    const roleBadge = user.role === 'admin'
      ? '<span class="badge badge-admin">管理者</span>'
      : '<span class="badge badge-member">会員</span>';
    const date = new Date(user.created_at).toLocaleDateString('ja-JP');

    tr.innerHTML = `
      <td>${user.id}</td>
      <td>${escapeHtml(user.name)}</td>
      <td>${escapeHtml(user.email)}</td>
      <td>${roleBadge}</td>
      <td>${date}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-edit" onclick="openEditModal(${user.id}, '${escapeAttr(user.name)}', '${escapeAttr(user.email)}', '${user.role}')">編集</button>
          <button class="btn btn-delete" onclick="deleteUser(${user.id}, '${escapeAttr(user.name)}')">削除</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ===== 編集モーダル =====
function openEditModal(id, name, email, role) {
  document.getElementById('edit-user-id').value = id;
  document.getElementById('edit-user-name').value = name;
  document.getElementById('edit-user-email').value = email;
  document.getElementById('edit-user-role').value = role;
  document.getElementById('edit-modal').style.display = '';
}

function closeEditModal() {
  document.getElementById('edit-modal').style.display = 'none';
}

document.getElementById('modal-close').addEventListener('click', closeEditModal);
document.getElementById('modal-cancel').addEventListener('click', closeEditModal);
document.getElementById('edit-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeEditModal();
});

// ===== ユーザー更新 =====
document.getElementById('editUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-user-id').value;
  const name = document.getElementById('edit-user-name').value;
  const email = document.getElementById('edit-user-email').value;
  const role = document.getElementById('edit-user-role').value;

  try {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, role })
    });
    if (res.ok) {
      closeEditModal();
      loadUsers();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  } catch {
    alert('更新に失敗しました');
  }
});

// ===== ユーザー削除 =====
async function deleteUser(id, name) {
  if (!confirm(`「${name}」を削除しますか？この操作は取り消せません。`)) return;

  try {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadUsers();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  } catch {
    alert('削除に失敗しました');
  }
}

// ===== ユーティリティ =====
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ===== ログアウト =====
document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/';
});

// ===== 初期化 =====
(async () => {
  await loadUser();
  if (currentUser) {
    loadUsers();
  }
})();
