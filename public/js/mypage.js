// ===== 共通: ユーザー情報取得 & ナビ設定 =====
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
    if (currentUser.role === 'admin') {
      const adminLink = document.getElementById('admin-link');
      if (adminLink) adminLink.style.display = '';
    }
  } catch {
    window.location.href = '/';
  }
}

// ===== プロフィール表示 =====
async function loadProfile() {
  await loadUser();
  if (!currentUser) return;

  document.getElementById('profile-name').textContent = currentUser.name;
  document.getElementById('profile-email').textContent = currentUser.email;
  document.getElementById('profile-avatar').textContent = currentUser.name.charAt(0);

  const roleEl = document.getElementById('profile-role');
  if (currentUser.role === 'admin') {
    roleEl.textContent = '管理者';
    roleEl.className = 'badge badge-admin';
  } else {
    roleEl.textContent = '一般会員';
    roleEl.className = 'badge badge-member';
  }

  document.getElementById('profile-date').textContent = new Date(currentUser.created_at).toLocaleDateString('ja-JP');
  document.getElementById('edit-name').value = currentUser.name;
  document.getElementById('edit-email').value = currentUser.email;
}

// ===== プロフィール更新 =====
document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const messageEl = document.getElementById('profile-message');
  const errorEl = document.getElementById('profile-error');
  messageEl.style.display = 'none';
  errorEl.style.display = 'none';

  const name = document.getElementById('edit-name').value;
  const email = document.getElementById('edit-email').value;

  try {
    const res = await fetch('/api/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    });
    if (res.ok) {
      messageEl.textContent = 'プロフィールを更新しました';
      messageEl.style.display = '';
      loadProfile();
    } else {
      const data = await res.json();
      errorEl.textContent = data.error;
      errorEl.style.display = '';
    }
  } catch {
    errorEl.textContent = '更新に失敗しました';
    errorEl.style.display = '';
  }
});

// ===== ログアウト =====
document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/';
});

// ===== 初期化 =====
loadProfile();
