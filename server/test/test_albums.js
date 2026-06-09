// 快速测试相册 API
const http = require('http');

const BASE_URL = 'http://localhost:3000/api';

// 辅助函数：发送 HTTP 请求
function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(`${BASE_URL}${path}`, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: body ? JSON.parse(body) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function test() {
  console.log('🧪 开始测试相册 API...\n');

  let token = null;
  let albumId = null;

  // 1. 测试获取相册列表（未登录）
  console.log('1️⃣  测试获取相册列表（未登录）');
  let res = await request('GET', '/albums');
  console.log(`   状态码: ${res.status}`);
  console.log(`   结果: ${JSON.stringify(res.data).slice(0, 100)}...\n`);

  // 2. 登录
  console.log('2️⃣  登录获取 token');
  res = await request('POST', '/auth/login', {
    username: 'test',  // 替换为你的测试账号
    password: 'test123'  // 替换为你的密码
  });

  if (res.status === 200 && res.data.token) {
    token = res.data.token;
    console.log('   ✅ 登录成功\n');
  } else {
    console.log('   ❌ 登录失败，请手动提供 token');
    console.log('   响应:', res.data);
    return;
  }

  // 3. 创建相册
  console.log('3️⃣  创建相册');
  res = await request('POST', '/albums', {
    title: '测试相册',
    description: '这是一个测试相册',
    is_public: true
  }, token);
  console.log(`   状态码: ${res.status}`);
  console.log(`   结果: ${JSON.stringify(res.data)}\n`);

  if (res.status === 201) {
    albumId = res.data.album.id;
  }

  // 4. 获取相册列表（已登录）
  console.log('4️⃣  获取相册列表（已登录）');
  res = await request('GET', '/albums', null, token);
  console.log(`   状态码: ${res.status}`);
  console.log(`   结果: 找到 ${res.data?.albums?.length || 0} 个相册\n`);

  // 5. 获取相册详情
  if (albumId) {
    console.log('5️⃣  获取相册详情');
    res = await request('GET', `/albums/${albumId}`, null, token);
    console.log(`   状态码: ${res.status}`);
    console.log(`   结果: ${JSON.stringify(res.data).slice(0, 200)}...\n`);

    // 6. 更新相册
    console.log('6️⃣  更新相册');
    res = await request('PUT', `/albums/${albumId}`, {
      title: '更新后的相册标题',
      description: '更新后的描述'
    }, token);
    console.log(`   状态码: ${res.status}`);
    console.log(`   结果: ${JSON.stringify(res.data)}\n`);

    // 7. 删除相册
    console.log('7️⃣  删除相册');
    res = await request('DELETE', `/albums/${albumId}`, null, token);
    console.log(`   状态码: ${res.status}`);
    console.log(`   结果: ${JSON.stringify(res.data)}\n`);
  }

  console.log('✅ 测试完成！');
}

test().catch(console.error);
