import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function checkTableStructure() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'shimmer'
    });

    console.log('✅ 数据库连接成功\n');

    // 查看 users 表结构
    console.log('📊 users 表结构:');
    const [userColumns] = await connection.query('SHOW COLUMNS FROM users');
    userColumns.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Key ? `(${col.Key})` : ''}`);
    });

    console.log('\n📊 photos 表结构:');
    const [photoColumns] = await connection.query('SHOW COLUMNS FROM photos');
    photoColumns.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Key ? `(${col.Key})` : ''}`);
    });

    // 查看建表语句
    console.log('\n📝 users 表创建语句:');
    const [userCreate] = await connection.query('SHOW CREATE TABLE users');
    console.log(userCreate[0]['Create Table']);

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkTableStructure();
