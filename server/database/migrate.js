import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  let connection;
  
  try {
    // 创建数据库连接
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'shimmer',
      multipleStatements: true // 允许执行多条 SQL 语句
    });

    console.log('✅ 数据库连接成功');

    // 读取迁移脚本
    const migrationPath = path.join(__dirname, 'migrations', '001_create_albums.sql');
    const sql = await fs.readFile(migrationPath, 'utf8');

    console.log('📄 正在执行迁移脚本:', migrationPath);

    // 执行 SQL 脚本
    await connection.query(sql);

    console.log('✅ 数据库迁移成功！');
    console.log('   已创建表: albums, album_photos');

    // 验证表是否创建成功
    const [tables] = await connection.query('SHOW TABLES LIKE "album%"');
    console.log('📊 验证结果:');
    tables.forEach(table => {
      console.log('   -', Object.values(table)[0]);
    });

  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

// 执行迁移
runMigration();
