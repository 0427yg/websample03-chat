// ===== ユーザー情報 =====
let currentUser = null;
let currentRoomId = null;
let currentDmConvId = null;
let currentDmPartnerId = null;
let chatMode = 'room'; // 'room' or 'dm'
let socket = null;

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

// ===== Socket.io 接続 =====
function connectSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('Socket connected');
  });

  // メッセージ受信
  socket.on('chat:message', (msg) => {
    appendMessage(msg);
    scrollToBottom();
  });

  // オンラインユーザー更新
  socket.on('users:online', (users) => {
    renderOnlineUsers(users);
  });

  // システムメッセージ
  socket.on('system:message', (data) => {
    appendSystemMessage(data.text);
  });

  // 入力中通知
  socket.on('chat:typing', (data) => {
    if (chatMode === 'room') showTyping(data.name);
  });

  // ===== DM Socket イベント =====
  socket.on('dm:message', (msg) => {
    if (chatMode === 'dm' && msg.conversation_id === currentDmConvId) {
      appendMessage(msg);
      scrollToBottom();
    }
  });

  socket.on('dm:update', () => {
    loadDmConversations();
  });

  socket.on('dm:typing', (data) => {
    if (chatMode === 'dm') showTyping(data.name);
  });
}

// ===== ルーム一覧 =====
async function loadRooms() {
  const res = await fetch('/api/rooms');
  const rooms = await res.json();
  const list = document.getElementById('room-list');
  list.innerHTML = '';

  rooms.forEach(room => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="room-name"># ${room.name}</span>
      <span class="room-count">${room.message_count}</span>
    `;
    li.addEventListener('click', () => joinRoom(room.id, room.name, li));
    list.appendChild(li);
  });

  // 最初のルームに自動参加
  if (rooms.length > 0) {
    const firstLi = list.querySelector('li');
    joinRoom(rooms[0].id, rooms[0].name, firstLi);
  }
}

// ===== ルームに参加 =====
async function joinRoom(roomId, roomName, liElement) {
  chatMode = 'room';
  currentRoomId = roomId;
  currentDmConvId = null;
  currentDmPartnerId = null;

  // アクティブ表示（ルーム・DM両方リセット）
  document.querySelectorAll('.room-list li, .dm-list li').forEach(li => li.classList.remove('active'));
  liElement.classList.add('active');

  // ヘッダー更新
  document.getElementById('room-name').textContent = `# ${roomName}`;
  document.getElementById('chat-input-area').style.display = '';

  // Socket.ioでルームに参加
  socket.emit('room:join', roomId);

  // メッセージ履歴の読み込み
  const res = await fetch(`/api/rooms/${roomId}/messages`);
  const messages = await res.json();

  const container = document.getElementById('chat-messages');
  container.innerHTML = '';

  if (messages.length === 0) {
    container.innerHTML = '<div class="chat-welcome"><p>まだメッセージがありません。最初のメッセージを送りましょう！</p></div>';
  } else {
    messages.forEach(msg => appendMessage(msg));
  }

  scrollToBottom();
}

// ===== メッセージ表示 =====
function appendMessage(msg) {
  const container = document.getElementById('chat-messages');
  // ウェルカムを消す
  const welcome = container.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  const isOwn = msg.user_id === currentUser.id;
  const div = document.createElement('div');
  div.className = `message ${isOwn ? 'own' : ''}`;

  const time = new Date(msg.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  const initial = msg.user_name ? msg.user_name.charAt(0) : '?';

  div.innerHTML = `
    <div class="message-avatar">${initial}</div>
    <div class="message-body">
      <div class="message-name">${escapeHtml(msg.user_name)}</div>
      <div class="message-text">${escapeHtml(msg.message)}</div>
      <div class="message-time">${time}</div>
    </div>
  `;
  container.appendChild(div);
}

function appendSystemMessage(text) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'system-message';
  div.textContent = text;
  container.appendChild(div);
  scrollToBottom();
}

function scrollToBottom() {
  const container = document.getElementById('chat-messages');
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== 入力中表示 =====
let typingTimeout = null;
function showTyping(name) {
  const el = document.getElementById('typing-indicator');
  el.querySelector('span').textContent = name;
  el.style.display = '';
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    el.style.display = 'none';
  }, 2000);
}

// ===== オンラインユーザー表示 =====
function renderOnlineUsers(users) {
  const list = document.getElementById('online-users');
  const count = document.getElementById('online-count');
  count.textContent = users.length;
  list.innerHTML = '';

  // 重複除去
  const unique = [...new Map(users.map(u => [u.id, u])).values()];
  unique.forEach(user => {
    if (user.id === currentUser.id) return;
    const li = document.createElement('li');
    li.textContent = user.name;
    li.style.cursor = 'pointer';
    li.title = 'クリックしてDMを開始';
    li.addEventListener('click', () => startDmWithUser(user.id));
    list.appendChild(li);
  });
}

// ===== メッセージ送信 =====
document.getElementById('messageForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('message-input');
  const message = input.value.trim();
  if (!message) return;

  if (chatMode === 'room' && currentRoomId) {
    socket.emit('chat:message', { roomId: currentRoomId, message });
  } else if (chatMode === 'dm' && currentDmConvId) {
    socket.emit('dm:message', { conversationId: currentDmConvId, partnerId: currentDmPartnerId, message });
  }
  input.value = '';
});

// 入力中通知の送信
document.getElementById('message-input').addEventListener('input', () => {
  if (chatMode === 'room' && currentRoomId) {
    socket.emit('chat:typing', { roomId: currentRoomId });
  } else if (chatMode === 'dm' && currentDmConvId) {
    socket.emit('dm:typing', { conversationId: currentDmConvId });
  }
});

// ===== DM機能 =====

// ユーザー検索
let searchTimeout = null;
document.getElementById('user-search-input').addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim();
  const resultsList = document.getElementById('search-results');

  if (query.length < 2) {
    resultsList.style.display = 'none';
    return;
  }

  searchTimeout = setTimeout(async () => {
    const res = await fetch(`/api/users/search?email=${encodeURIComponent(query)}`);
    const users = await res.json();
    resultsList.innerHTML = '';

    if (users.length === 0) {
      resultsList.innerHTML = '<li class="search-no-result">見つかりません</li>';
    } else {
      users.forEach(user => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(user.email)}</span>`;
        li.addEventListener('click', () => {
          startDmWithUser(user.id);
          resultsList.style.display = 'none';
          document.getElementById('user-search-input').value = '';
        });
        resultsList.appendChild(li);
      });
    }
    resultsList.style.display = '';
  }, 300);
});

// 検索欄外をクリックで閉じる
document.addEventListener('click', (e) => {
  if (!e.target.closest('.dm-search')) {
    document.getElementById('search-results').style.display = 'none';
  }
});

// DM会話リスト読み込み
async function loadDmConversations() {
  const res = await fetch('/api/dm/conversations');
  const conversations = await res.json();
  const list = document.getElementById('dm-list');
  list.innerHTML = '';

  conversations.forEach(conv => {
    const li = document.createElement('li');
    const lastMsg = conv.last_message
      ? (conv.last_message.length > 20 ? conv.last_message.substring(0, 20) + '...' : conv.last_message)
      : '';
    li.innerHTML = `
      <span class="dm-name">📩 ${escapeHtml(conv.partner_name)}</span>
      <span class="dm-preview">${escapeHtml(lastMsg)}</span>
    `;
    li.addEventListener('click', () => openDmConversation(conv.id, conv.partner_name, conv.partner_id, li));
    if (chatMode === 'dm' && currentDmConvId === conv.id) {
      li.classList.add('active');
    }
    list.appendChild(li);
  });
}

// DM会話を開く
async function openDmConversation(convId, partnerName, partnerId, liElement) {
  chatMode = 'dm';
  currentDmConvId = convId;
  currentDmPartnerId = partnerId;
  currentRoomId = null;

  // アクティブ表示（ルーム・DM両方リセット）
  document.querySelectorAll('.room-list li, .dm-list li').forEach(li => li.classList.remove('active'));
  if (liElement) liElement.classList.add('active');

  // ヘッダー更新
  document.getElementById('room-name').textContent = `📩 ${partnerName}`;
  document.getElementById('chat-input-area').style.display = '';

  // Socket.ioでDMルームに参加
  socket.emit('dm:join', convId);

  // メッセージ履歴の読み込み
  const res = await fetch(`/api/dm/conversations/${convId}/messages`);
  const messages = await res.json();

  const container = document.getElementById('chat-messages');
  container.innerHTML = '';

  if (messages.length === 0) {
    container.innerHTML = '<div class="chat-welcome"><p>📩 ダイレクトメッセージを始めましょう！</p></div>';
  } else {
    messages.forEach(msg => appendMessage(msg));
  }

  scrollToBottom();
}

// オンラインユーザーまたは検索結果からDMを開始
async function startDmWithUser(partnerId) {
  const res = await fetch('/api/dm/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partnerId })
  });
  const conv = await res.json();
  await loadDmConversations();

  // 対応するリスト項目を見つけてアクティブにする
  const dmItems = document.querySelectorAll('#dm-list li');
  let targetLi = null;
  dmItems.forEach((li, i) => {
    // DM会話リストでクリック
    if (li.querySelector('.dm-name').textContent.includes(conv.partner_name)) {
      targetLi = li;
    }
  });

  openDmConversation(conv.id, conv.partner_name, conv.partner_id, targetLi);
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
    connectSocket();
    await loadRooms();
    await loadDmConversations();
  }
})();
