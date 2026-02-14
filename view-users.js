const db = require('./database');

console.log('\n===== 登録されている会員情報 =====\n');

const users = db.getAllUsers();

if (users.length === 0) {
  console.log('会員がいません');
} else {
  users.forEach((user, index) => {
    console.log(`${index + 1}. ID: ${user.id}`);
    console.log(`   名前: ${user.name}`);
    console.log(`   メール: ${user.email}`);
    console.log(`   権限: ${user.role === 'admin' ? '管理者' : '一般会員'}`);
    console.log(`   登録日: ${new Date(user.created_at).toLocaleString('ja-JP')}`);
    console.log('');
  });
}

console.log(`総会員数: ${users.length}`);
