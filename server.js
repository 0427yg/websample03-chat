const express = require('express');
const session = require('express-session');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db = require('./database');

const app = express();
const server = http.createServer(app);

// CORS設定（デスクトップアプリ対応）
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002'
];

const corsOptions = {
  origin: function (origin, callback) {
    // originがない場合（同一オリジン）またはリストに含まれる場合は許可
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // デスクトップアプリのため全オリジン許可
    }
  },
  credentials: true
};

const io = new Server(server, {
  cors: corsOptions
});

const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// ===== ミドルウェア =====
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const sessionMiddleware = session({
  secret: 'chat-app-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24時間
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction
  },
  ...(isProduction && { proxy: true })
});
if (isProduction) app.set('trust proxy', 1);
app.use(sessionMiddleware);

// Socket.io にセッションを共有
io.engine.use(sessionMiddleware);

// ===== 認証ミドルウェア =====
function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'ログインが必要です' });
  }
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: '管理者権限が必要です' });
  }
}

// ===== 認証 API =====

// 会員登録
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: '全ての項目を入力してください' });
  }
  try {
    const user = db.createUser(name, email, password);
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      res.status(400).json({ error: 'このメールアドレスは既に登録されています' });
    } else {
      res.status(500).json({ error: '登録に失敗しました' });
    }
  }
});

// ログイン
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'メールアドレスとパスワードを入力してください' });
  }
  const user = db.authenticateUser(email, password);
  if (user) {
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.json({ success: true, user: req.session.user });
  } else {
    res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
  }
});

// ログアウト
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// 現在のユーザー情報
app.get('/api/me', requireLogin, (req, res) => {
  const user = db.getUserById(req.session.user.id);
  if (user) {
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.created_at });
  } else {
    res.status(404).json({ error: 'ユーザーが見つかりません' });
  }
});

// プロフィール更新
app.put('/api/me', requireLogin, (req, res) => {
  const { name, email } = req.body;
  try {
    db.updateUser(req.session.user.id, name, email);
    req.session.user.name = name;
    req.session.user.email = email;
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: '更新に失敗しました' });
  }
});

// ===== チャット API =====

// チャットルーム一覧
app.get('/api/rooms', requireLogin, (req, res) => {
  const rooms = db.getRooms();
  res.json(rooms);
});

// チャット履歴取得
app.get('/api/rooms/:roomId/messages', requireLogin, (req, res) => {
  const messages = db.getMessages(parseInt(req.params.roomId), 100);
  res.json(messages);
});

// オンラインユーザー一覧
app.get('/api/users/online', requireLogin, (req, res) => {
  res.json(Array.from(onlineUsers.values()));
});

// ===== DM API =====

// ユーザー検索（メールアドレス）
app.get('/api/users/search', requireLogin, (req, res) => {
  const { email } = req.query;
  if (!email || email.length < 2) {
    return res.json([]);
  }
  const users = db.searchUserByEmail(email, req.session.user.id);
  res.json(users);
});

// DM会話一覧
app.get('/api/dm/conversations', requireLogin, (req, res) => {
  const conversations = db.getDmConversations(req.session.user.id);
  res.json(conversations);
});

// DM会話を開始（または取得）
app.post('/api/dm/conversations', requireLogin, (req, res) => {
  const { partnerId } = req.body;
  if (!partnerId) {
    return res.status(400).json({ error: '相手のユーザーIDが必要です' });
  }
  const partner = db.getUserById(parseInt(partnerId));
  if (!partner) {
    return res.status(404).json({ error: 'ユーザーが見つかりません' });
  }
  const conv = db.getOrCreateDmConversation(req.session.user.id, parseInt(partnerId));
  res.json({ id: conv.id, partner_id: partner.id, partner_name: partner.name });
});

// DMメッセージ履歴
app.get('/api/dm/conversations/:convId/messages', requireLogin, (req, res) => {
  const messages = db.getDmMessages(parseInt(req.params.convId), req.session.user.id, 100);
  if (messages === null) {
    return res.status(403).json({ error: 'アクセス権がありません' });
  }
  res.json(messages);
});

// ===== 管理者 API =====

// 全ユーザー一覧
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = db.getAllUsers();
  res.json(users);
});

// ユーザー更新
app.put('/api/admin/users/:id', requireAdmin, (req, res) => {
  const { name, email, role } = req.body;
  try {
    db.adminUpdateUser(parseInt(req.params.id), name, email, role);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: '更新に失敗しました' });
  }
});

// ユーザー削除
app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  try {
    db.deleteUser(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: '削除に失敗しました' });
  }
});

// ===== ページルーティング =====
app.get('/chat', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.get('/mypage', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mypage.html'));
});

app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ===== Socket.io リアルタイムチャット =====
const onlineUsers = new Map();

io.on('connection', (socket) => {
  const session = socket.request.session;
  if (!session || !session.user) {
    socket.disconnect();
    return;
  }

  const user = session.user;
  onlineUsers.set(socket.id, { id: user.id, name: user.name });

  // 自分専用のルームに参加（DM受信用）
  socket.join(`user-${user.id}`);

  // オンラインユーザー通知
  io.emit('users:online', Array.from(onlineUsers.values()));
  io.emit('system:message', { text: `${user.name} さんが参加しました`, timestamp: new Date().toISOString() });

  // ルームに参加
  socket.on('room:join', (roomId) => {
    socket.join(`room-${roomId}`);
  });

  // メッセージ送信
  socket.on('chat:message', (data) => {
    const { roomId, message } = data;
    const saved = db.saveMessage(user.id, roomId, message);
    io.to(`room-${roomId}`).emit('chat:message', {
      id: saved.id,
      user_id: user.id,
      user_name: user.name,
      message: message,
      created_at: saved.created_at
    });
  });

  // 入力中の通知
  socket.on('chat:typing', (data) => {
    socket.to(`room-${data.roomId}`).emit('chat:typing', { name: user.name });
  });

  // ===== DM Socket イベント =====

  // DM会話に参加
  socket.on('dm:join', (convId) => {
    socket.join(`dm-${convId}`);
  });

  // DMメッセージ送信
  socket.on('dm:message', (data) => {
    const { conversationId, partnerId, message } = data;
    const saved = db.saveDmMessage(conversationId, user.id, message);
    const msgData = {
      id: saved.id,
      user_id: user.id,
      user_name: user.name,
      message: message,
      created_at: saved.created_at,
      conversation_id: conversationId
    };
    io.to(`dm-${conversationId}`).emit('dm:message', msgData);
    // 相手に会話リスト更新の通知
    io.to(`user-${partnerId}`).emit('dm:update');
  });

  // DM入力中の通知
  socket.on('dm:typing', (data) => {
    socket.to(`dm-${data.conversationId}`).emit('dm:typing', { name: user.name });
  });

  // 切断
  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    io.emit('users:online', Array.from(onlineUsers.values()));
    io.emit('system:message', { text: `${user.name} さんが退出しました`, timestamp: new Date().toISOString() });
  });
});

// ===== サーバー起動 =====
server.listen(PORT, () => {
  console.log(`🚀 チャットアプリが起動しました: http://localhost:${PORT}`);
});
