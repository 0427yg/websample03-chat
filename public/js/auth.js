// ===== ログイン / 登録 切り替え =====
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegister = document.getElementById('show-register');
const showLogin = document.getElementById('show-login');

showRegister.addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.style.display = 'none';
  registerForm.style.display = '';
});

showLogin.addEventListener('click', (e) => {
  e.preventDefault();
  registerForm.style.display = 'none';
  loginForm.style.display = '';
});

// ===== ログイン処理 =====
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  errorEl.style.display = 'none';

  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      window.location.href = '/mypage';
    } else {
      errorEl.textContent = data.error;
      errorEl.style.display = '';
    }
  } catch {
    errorEl.textContent = 'サーバーに接続できません';
    errorEl.style.display = '';
  }
});

// ===== 会員登録処理 =====
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('register-error');
  errorEl.style.display = 'none';

  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const passwordConfirm = document.getElementById('reg-password-confirm').value;

  if (password !== passwordConfirm) {
    errorEl.textContent = 'パスワードが一致しません';
    errorEl.style.display = '';
    return;
  }

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (res.ok) {
      window.location.href = '/mypage';
    } else {
      errorEl.textContent = data.error;
      errorEl.style.display = '';
    }
  } catch {
    errorEl.textContent = 'サーバーに接続できません';
    errorEl.style.display = '';
  }
});

// 既にログイン済みならリダイレクト
(async () => {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      window.location.href = '/mypage';
    }
  } catch {
    // 未ログイン — そのまま
  }
})();
