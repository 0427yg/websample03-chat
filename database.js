const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'chat-app.db'));

// WALモード有効化（パフォーマンス向上）
db.pragma('journal_mode = WAL');

// ===== テーブル作成 =====
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS dm_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1_id INTEGER NOT NULL,
    user2_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user1_id, user2_id)
  );

  CREATE TABLE IF NOT EXISTS dm_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES dm_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ===== 初期データ =====
const roomCount = db.prepare('SELECT COUNT(*) as count FROM rooms').get().count;
if (roomCount === 0) {
  const insertRoom = db.prepare('INSERT INTO rooms (name, description) VALUES (?, ?)');
  insertRoom.run('一般', 'みんなで自由に話しましょう');
  insertRoom.run('雑談', '気軽な雑談はこちら');
  insertRoom.run('質問・相談', '困りごとを相談できます');
}

// 管理者アカウント作成（初回のみ）
const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;
if (adminCount === 0) {
  const hashedPw = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(
    '管理者', 'admin@example.com', hashedPw, 'admin'
  );
  console.log('📋 管理者アカウントを作成しました: admin@example.com / admin123');
}

// ===== ユーザー関連 =====
function createUser(name, email, password) {
  const hashedPw = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(name, email, hashedPw);
  return { id: result.lastInsertRowid, name, email, role: 'member' };
}

function authenticateUser(email, password) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (user && bcrypt.compareSync(password, user.password)) {
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
  return null;
}

function getUserById(id) {
  return db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(id);
}

function updateUser(id, name, email) {
  db.prepare('UPDATE users SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, email, id);
}

function getAllUsers() {
  return db.prepare('SELECT id, name, email, role, created_at, updated_at FROM users ORDER BY created_at DESC').all();
}

function adminUpdateUser(id, name, email, role) {
  db.prepare('UPDATE users SET name = ?, email = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, email, role, id);
}

function deleteUser(id) {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

// ===== ルーム関連 =====
function getRooms() {
  return db.prepare(`
    SELECT r.*, 
      (SELECT COUNT(*) FROM messages WHERE room_id = r.id) as message_count
    FROM rooms r ORDER BY r.id
  `).all();
}

// ===== メッセージ関連 =====
function getMessages(roomId, limit = 100) {
  return db.prepare(`
    SELECT m.id, m.message, m.created_at, m.user_id,
           u.name as user_name
    FROM messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.room_id = ?
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(roomId, limit).reverse();
}

function saveMessage(userId, roomId, message) {
  const result = db.prepare('INSERT INTO messages (user_id, room_id, message) VALUES (?, ?, ?)').run(userId, roomId, message);
  return { id: result.lastInsertRowid, created_at: new Date().toISOString() };
}

// ===== DM 関連 =====
function searchUserByEmail(email, excludeUserId) {
  return db.prepare(
    'SELECT id, name, email FROM users WHERE email LIKE ? AND id != ? LIMIT 10'
  ).all(`%${email}%`, excludeUserId);
}

function getOrCreateDmConversation(user1Id, user2Id) {
  const minId = Math.min(user1Id, user2Id);
  const maxId = Math.max(user1Id, user2Id);

  let conv = db.prepare(
    'SELECT * FROM dm_conversations WHERE user1_id = ? AND user2_id = ?'
  ).get(minId, maxId);

  if (!conv) {
    const result = db.prepare(
      'INSERT INTO dm_conversations (user1_id, user2_id) VALUES (?, ?)'
    ).run(minId, maxId);
    conv = { id: result.lastInsertRowid, user1_id: minId, user2_id: maxId };
  }
  return conv;
}

function getDmConversations(userId) {
  return db.prepare(`
    SELECT c.id, c.user1_id, c.user2_id,
      CASE WHEN c.user1_id = ? THEN u2.name ELSE u1.name END as partner_name,
      CASE WHEN c.user1_id = ? THEN u2.id ELSE u1.id END as partner_id,
      (SELECT dm.message FROM dm_messages dm WHERE dm.conversation_id = c.id ORDER BY dm.created_at DESC LIMIT 1) as last_message,
      (SELECT dm.created_at FROM dm_messages dm WHERE dm.conversation_id = c.id ORDER BY dm.created_at DESC LIMIT 1) as last_message_at
    FROM dm_conversations c
    JOIN users u1 ON c.user1_id = u1.id
    JOIN users u2 ON c.user2_id = u2.id
    WHERE c.user1_id = ? OR c.user2_id = ?
    ORDER BY last_message_at DESC
  `).all(userId, userId, userId, userId);
}

function getDmMessages(conversationId, userId, limit = 100) {
  // ユーザーがこの会話に参加しているか確認
  const conv = db.prepare(
    'SELECT * FROM dm_conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)'
  ).get(conversationId, userId, userId);
  if (!conv) return null;

  return db.prepare(`
    SELECT m.id, m.message, m.created_at, m.sender_id as user_id,
           u.name as user_name
    FROM dm_messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(conversationId, limit).reverse();
}

function saveDmMessage(conversationId, senderId, message) {
  const result = db.prepare(
    'INSERT INTO dm_messages (conversation_id, sender_id, message) VALUES (?, ?, ?)'
  ).run(conversationId, senderId, message);
  return { id: result.lastInsertRowid, created_at: new Date().toISOString() };
}

module.exports = {
  createUser,
  authenticateUser,
  getUserById,
  updateUser,
  getAllUsers,
  adminUpdateUser,
  deleteUser,
  getRooms,
  getMessages,
  saveMessage,
  searchUserByEmail,
  getOrCreateDmConversation,
  getDmConversations,
  getDmMessages,
  saveDmMessage
};
