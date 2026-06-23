import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });

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

    // 读取所有迁移脚本
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

    if (sqlFiles.length === 0) {
      console.log('⚠️ 未找到迁移脚本');
      await connection.end();
      return;
    }

    for (const file of sqlFiles) {
      const migrationPath = path.join(migrationsDir, file);
      const sql = await fs.readFile(migrationPath, 'utf8');
      console.log('📄 正在执行迁移脚本:', file);
      await connection.query(sql);
    }

    console.log('✅ 数据库迁移成功！');

    // 验证所有表
    const [tables] = await connection.query('SHOW TABLES');
    console.log('📊 验证结果 (' + tables.length + ' 张表):');
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
