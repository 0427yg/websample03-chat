# ChatConnect - リアルタイムチャットアプリ

オンライン会員同士でルームチャット・ダイレクトメッセージが可能な Node.js + Socket.io によるリアルタイムチャットアプリです。

## 📋 プロジェクト概要

- **会員登録・ログイン** - メールアドレスとパスワードでアカウント管理
- **ルームチャット** - 複数ユーザーで同時にチャット可能
- **ダイレクトメッセージ（DM）** - 他のユーザーと 1:1 でチャット
- **管理者パネル** - 会員情報の閲覧・編集・削除
- **リアルタイム通信** - WebSocket を用いた即時メッセージ配信・入力中通知

---

## 🏗️ システムアーキテクチャ

```
┌─────────────────────────────────────┐
│   ブラウザ（クライアント側）          │
│  HTML / CSS / JavaScript            │
│  Socket.io クライアント              │
└─────────────┬───────────────────────┘
              │ HTTP / WebSocket
┌─────────────▼───────────────────────┐
│   Node.js + Express サーバー          │
│  RESTful API / Socket.io サーバー     │
└─────────────┬───────────────────────┘
              │ SQL
┌─────────────▼───────────────────────┐
│   SQLite データベース                 │
│  Users / Rooms / Messages            │
└─────────────────────────────────────┘
```

---

## 📁 ディレクトリ構成

```
WebSample03/
├── server.js                 # Express + Socket.io サーバー
├── database.js              # SQLite データベース操作
├── chat-app.db              # SQLite データベースファイル
├── package.json             # 依存パッケージ管理
├── view-users.js            # 会員情報確認用スクリプト
├── public/                  # フロントエンド（静的ファイル）
│   ├── index.html           # ログイン・会員登録ページ
│   ├── mypage.html          # マイページ
│   ├── chat.html            # チャットメイン画面
│   ├── admin.html           # 管理者パネル
│   ├── css/
│   │   └── style.css        # スタイルシート（780行以上）
│   └── js/
│       ├── auth.js          # ログイン・登録処理
│       ├── mypage.js        # マイページ機能
│       ├── chat.js          # チャット機能
│       └── admin.js         # 管理者機能
└── node_modules/            # 依存パッケージ
```

---

## 🔧 バックエンド コンポーネント

### server.js
**役割:** Express + Socket.io サーバーのメインファイル

**主な機能:**
- HTTP ルーティング（認証、API エンドポイント）
- WebSocket コネクション管理
- セッション管理（express-session）
- ルームチャット・DM のリアルタイム配信

**主要な API エンドポイント:**
```javascript
POST   /api/register              // 会員登録
POST   /api/login                 // ログイン
POST   /api/logout                // ログアウト
GET    /api/me                    // 現在のユーザー情報
PUT    /api/me                    // プロフィール更新
GET    /api/rooms                 // ルーム一覧
GET    /api/rooms/:id/messages    // ルームのメッセージ履歴
GET    /api/users/online          // オンラインユーザー一覧
GET    /api/users/search          // ユーザー検索（メールアドレス）
GET    /api/dm/conversations      // DM会話一覧
POST   /api/dm/conversations      // DM会話作成
GET    /api/dm/conversations/:id/messages  // DM メッセージ履歴
GET    /api/admin/users           // 全会員一覧（管理者のみ）
PUT    /api/admin/users/:id       // 会員情報編集（管理者のみ）
DELETE /api/admin/users/:id       // 会員削除（管理者のみ）
```

**Socket.io イベント:**
```javascript
// ルームチャット
room:join           // ルームに参加
chat:message        // メッセージ送受信
chat:typing         // 入力中通知

// ダイレクトメッセージ
dm:join             // DM会話に参加
dm:message          // DM メッセージ送受信
dm:typing           // DM 入力中通知
dm:update           // DM 会話リスト更新通知

// ユーザー情報
users:online        // オンラインユーザー更新

// システムメッセージ
system:message      // 参加・退出通知
```

### database.js
**役割:** SQLite データベース操作の抽象化層

**主要な関数:**
```javascript
// ユーザー管理
createUser(name, email, password)         // 会員登録
authenticateUser(email, password)         // ログイン認証
getUserById(id)                           // ユーザー取得
updateUser(id, name, email)               // プロフィール更新
getAllUsers()                             // 全会員一覧
adminUpdateUser(id, name, email, role)    // 管理者による更新
deleteUser(id)                            // 会員削除

// ルームチャット
getRooms()                                // ルーム一覧
getMessages(roomId, limit)                // メッセージ取得
saveMessage(userId, roomId, message)      // メッセージ保存

// ダイレクトメッセージ
searchUserByEmail(email, excludeUserId)   // ユーザー検索
getOrCreateDmConversation(user1Id, user2Id)  // DM会話作成・取得
getDmConversations(userId)                // DM会話一覧
getDmMessages(convId, userId, limit)      // DM メッセージ取得
saveDmMessage(convId, senderId, message)  // DM メッセージ保存
```

**セキュリティ:**
- パスワード暗号化: bcryptjs（10ラウンド）
- SQL インジェクション対策: プリペアドステートメント使用

### chat-app.db
**役割:** SQLite データベース（永続データストレージ）

**テーブル構成:**
```sql
-- ユーザーテーブル
users (id, name, email, password, role, created_at, updated_at)

-- ルームテーブル
rooms (id, name, description, created_at)

-- ルームメッセージテーブル
messages (id, user_id, room_id, message, created_at)

-- DM会話テーブル
dm_conversations (id, user1_id, user2_id, created_at)

-- DM メッセージテーブル
dm_messages (id, conversation_id, sender_id, message, created_at)
```

**初期データ:**
- 管理者アカウント: `admin@example.com` / `admin123`
- 3つのルームチャット: 一般、雑談、質問・相談

---

## 🎨 フロントエンド コンポーネント

### HTML ページ

| ファイル | 役割 |
|---------|------|
| **index.html** | ログイン・会員登録フォーム。アカウント認証を行い、ログイン済みの場合は自動的に /mypage にリダイレクト |
| **mypage.html** | 登録済みユーザーのマイページ。プロフィール表示・名前やメールアドレスの変更が可能 |
| **chat.html** | チャットメイン画面。ルーム一覧・DM会話一覧・オンラインユーザー・メッセージ入力欄を備えたレイアウト |
| **admin.html** | 管理者専用パネル。全会員の一覧表示・編集・削除機能。統計情報（総会員数・管理者数）も表示 |

### JavaScript ファイル

| ファイル | 役割 | 主な機能 |
|---------|------|---------|
| **js/auth.js** | ログイン・会員登録フォーム処理 | フォーム送信 → API呼び出し → 成功時にリダイレクト |
| **js/mypage.js** | マイページ機能 | ユーザー情報表示・プロフィール編集・ログアウト |
| **js/chat.js** | チャット機能（270行以上） | ルーム・DM切り替え、メッセージ送受信、リアルタイム通知、ユーザー検索、オンラインユーザー表示 |
| **js/admin.js** | 管理者パネル機能 | ユーザー一覧・編集・削除、モーダルUI制御 |

### CSS ファイル

| ファイル | 内容 |
|---------|------|
| **css/style.css** | 全ページの統一スタイル（780行以上）。ダークテーマ採用。Flexbox/Grid によるレスポンシブレイアウト。スムーズなアニメーション |

---

## 💻 使用している技術スタック

### バックエンド
| 技術 | バージョン | 用途 |
|-----|-----------|------|
| **Node.js** | 22.19.0 | JavaScriptランタイム |
| **Express.js** | 4.21.0 | Web フレームワーク |
| **Socket.io** | 4.7.0 | リアルタイム双方向通信（WebSocket） |
| **better-sqlite3** | 11.0.0 | SQLite同期データベースドライバ |
| **express-session** | 1.18.0 | HTTP セッション管理 |
| **bcryptjs** | 2.4.3 | パスワード暗号化・検証 |

### フロントエンド
| 技術 | 用途 |
|-----|------|
| **HTML5** | マークアップ |
| **CSS3** | スタイリング（Flexbox, Grid, アニメーション） |
| **Vanilla JavaScript** | フロントエンドロジック（フレームワーク不使用） |
| **Socket.io Client** | WebSocket 双方向通信 |
| **Fetch API** | REST API 通信 |

### データベース
| 技術 | 用途 |
|-----|------|
| **SQLite 3** | ローカルリレーショナルデータベース |
| **UNIQUE 制約** | メールアドレスの重複防止 |
| **外部キー制約** | データ整合性の保証 |
| **WAL モード** | 同時アクセスのパフォーマンス最適化 |

---

## 🔐 セキュリティ機能

| 機能 | 実装方法 |
|-----|--------|
| **パスワード暗号化** | bcryptjs（10ラウンド ハッシング） |
| **セッション管理** | express-session（24時間有効） |
| **認証チェック** | `requireLogin` / `requireAdmin` ミドルウェア |
| **XSS 対策** | `escapeHtml()` 関数でテキスト検証 |
| **SQL インジェクション対策** | プリペアドステートメント使用 |
| **アクセス制御** | 管理者機能へのアクセス制限 |

---

## 🚀 セットアップ & 実行

### インストール
```bash
cd WebSample03
npm install
```

### サーバー起動
```bash
npm start
# または
node server.js
```

### ブラウザアクセス
```
http://localhost:3000
```

### 会員情報確認
```bash
node view-users.js
```

---

## 👥 テストアカウント

| ユーザー | メール | パスワード | 権限 |
|---------|--------|-----------|------|
| 管理者 | `admin@example.com` | `admin123` | 管理者 |

他の会員は会員登録ページから新規作成できます。

---

## ⚙️ 初期データ

サーバー起動時に以下の初期データが自動作成されます：

**ルームチャット:**
1. **一般** - みんなで自由に話しましょう
2. **雑談** - 気軽な雑談はこちら
3. **質問・相談** - 困りごとを相談できます

---

## 📊 リアルタイム通信フロー

```
ユーザーA                    サーバー                    ユーザーB
   │                           │                            │
   ├─ socket.emit('chat:message') ──┤                        │
   │                           ├─ db に保存                  │
   │                           ├─ room-X に配信              │
   │                           │                            │
   │                   ◄──────────────────────────────────┤
   │   ◄─ io.to('room-X').emit('chat:message') ─┘           │
   │   (受信)                   │                    │
   │                           │         ◄─ Socket.io
   │                           │       (リアルタイム)
```

**チャットフロー:**
1. ユーザーがメッセージを入力 → `socket.emit('chat:message')`
2. サーバーが受信 → データベースに保存
3. ルーム内全員に配信 → `io.to('room-X').emit('chat:message')`
4. クライアント側で即座にメッセージ表示

DM（ダイレクトメッセージ）も同様のフローで動作します（`dm-{conversationId}` へ配信）。

---

## 🎯 主な機能

### 認証機能
- ✅ メールアドレスとパスワードによる会員登録
- ✅ ログイン・ログアウト
- ✅ セッション管理（24時間有効）

### チャット機能
- ✅ ルームチャット（複数人同時）
- ✅ ダイレクトメッセージ（1:1 プライベートチャット）
- ✅ メールアドレスでユーザー検索
- ✅ オンラインユーザー表示
- ✅ 入力中の通知

### ユーザー機能
- ✅ プロフィール表示・編集
- ✅ マイページ

### 管理者機能
- ✅ 全会員一覧表示
- ✅ 会員情報の編集
- ✅ 会員削除

---

## 📝 ファイル説明

### server.js
Express と Socket.io を用いたメインサーバーファイル。全ての API エンドポイントと WebSocket イベントハンドラが実装されています。

### database.js
SQLite データベース操作を管理。ユーザー管理、メッセージ保存、DM 処理など全てのデータベース操作をここで行います。

### public/index.html
ログイン・会員登録画面。フォーム入力後、API を通じてサーバーと通信します。

### public/chat.html
チャットのメイン画面。サイドバーに「ルーム一覧」「DM一覧」「オンラインユーザー」を表示し、中央にメッセージエリア・入力フォームを配置。

### public/js/chat.js
チャット機能の中核。ルーム・DM 切り替え、メッセージ送受信、ユーザー検索、Socket.io イベント処理など複雑な処理が実装されています。

### public/css/style.css
全ページの統一スタイル。レスポンシブデザインに対応し、スマートフォンでも閲覧可能。

---

## 🔄 データベーススキーマ

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rooms (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  room_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TABLE dm_conversations (
  id INTEGER PRIMARY KEY,
  user1_id INTEGER NOT NULL,
  user2_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user1_id, user2_id)
);

CREATE TABLE dm_messages (
  id INTEGER PRIMARY KEY,
  conversation_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES dm_conversations(id),
  FOREIGN KEY (sender_id) REFERENCES users(id)
);
```

---

## 📚 学習ポイント

このプロジェクトから学べること：

- **Node.js + Express** - サーバーサイド JavaScript の基本
- **Socket.io** - リアルタイム双方向通信
- **SQLite** - ローカルデータベース
- **セッション管理** - ユーザー認証・管理
- **REST API** - HTTP エンドポイント設計
- **Vanilla JavaScript** - フレームワークなしでの DOM 操作
- **CSS** - レスポンシブデザイン・アニメーション
- **セキュリティ** - パスワード暗号化・認証・アクセス制御

---

## 📄 ライセンス

このプロジェクトは学習用サンプルコードです。

---

**最終更新:** 2026年2月13日
