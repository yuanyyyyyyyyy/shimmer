/**
 * 光影手记 (Shimmer) API 接口测试脚本
 * 运行方式：node docs/tests/api-test.mjs
 * 前置条件：确保 MySQL 已运行、后端已启动 (npm run dev)
 */

const BASE = 'http://localhost:3000/api';
let token = '';
let testPhotoId = null;
let testTagId = null;
let testAlbumId = null;
let testShareId = null;

async function request(method, path, body = null, auth = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(`${BASE}${path}`, opts);
    const data = await res.json();
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: { error: err.message } };
  }
}

function log(category, testName, result) {
  const status = result.status >= 200 && result.status < 300 ? 'PASS' : 'FAIL';
  const detail = result.data?.error || JSON.stringify(result.data).slice(0, 120);
  console.log(`[${status}] ${category} > ${testName}`);
  console.log(`       → ${result.status} ${detail}\n`);
}

let passed = 0, failed = 0;
function check(category, testName, result) {
  if (result.status >= 200 && result.status < 300) {
    passed++;
    log(category, testName, result);
  } else {
    failed++;
    log(category, testName, result);
  }
}

console.log('='.repeat(60));
console.log('  光影手记 (Shimmer) API 接口测试');
console.log('='.repeat(60) + '\n');

// ============ 1. 用户注册 ============
console.log('--- 1. 用户认证模块 ---');
const username = 'test_' + Date.now();
let r = await request('POST', '/auth/register', {
  username, password: 'test123456', nickname: '测试用户'
});
check('注册', '新用户注册', r);

r = await request('POST', '/auth/register', {
  username, password: 'test123456'
});
check('注册', '重复用户名注册（应失败）', r);

// ============ 2. 用户登录 ============
r = await request('POST', '/auth/login', {
  username, password: 'test123456'
});
check('登录', '正确密码登录', r);
if (r.status === 200) token = r.data.token;

r = await request('POST', '/auth/login', {
  username, password: 'wrong_password'
});
check('登录', '错误密码登录（应失败）', r);

// ============ 3. 获取当前用户 ============
r = await request('GET', '/auth/me', null, true);
check('获取用户', '获取当前登录用户', r);

// ============ 4. 标签 CRUD ============
console.log('\n--- 2. 标签模块 ---');
r = await request('GET', '/tags');
check('标签列表', '获取全部标签', r);

r = await request('POST', '/tags', { name: '测试标签_' + Date.now(), color: '#ff6b6b' }, true);
check('创建标签', '创建新标签', r);
if (r.status === 201 || r.status === 200) testTagId = r.data.id;

r = await request('GET', '/tags/popular?limit=5');
check('热门标签', '获取热门标签 TOP5', r);

// ============ 5. 照片上传 & 创建 ============
console.log('\n--- 3. 照片模块 ---');

// 模拟创建照片记录（实际上传需要 multipart，这里模拟记录）
r = await request('POST', '/photos', {
  title: '测试照片',
  url: 'https://placehold.co/800x600',
  thumbnail_url: 'https://placehold.co/400x300',
  mood: '愉快',
  shot_date: '2025-06-01',
  location: '测试地点',
  visibility: 'public'
}, true);
check('创建照片', '创建照片记录', r);
if (r.status === 201 || r.status === 200) testPhotoId = r.data.id;

r = await request('GET', '/photos');
check('照片列表', '获取公开照片列表', r);

if (testPhotoId) {
  r = await request('GET', `/photos/${testPhotoId}`);
  check('照片详情', '获取单张照片详情', r);
}

// ============ 6. 照片标签关联 ============
console.log('\n--- 4. 照片-标签关联 ---');
if (testPhotoId && testTagId) {
  r = await request('POST', `/tags/photo/${testPhotoId}`, { tagIds: [testTagId] }, true);
  check('设置标签', '为照片设置标签', r);

  r = await request('GET', `/tags/photo/${testPhotoId}`);
  check('获取标签', '获取照片的标签', r);
}

// ============ 7. 相册 CRUD ============
console.log('\n--- 5. 相册模块 ---');
r = await request('POST', '/albums', {
  title: '测试相册',
  description: '这是一个测试相册',
  is_public: true
}, true);
check('创建相册', '创建新相册', r);
if (r.status === 201 || r.status === 200) testAlbumId = r.data.id;

if (testAlbumId && testPhotoId) {
  r = await request('POST', `/albums/${testAlbumId}/photos`, { photo_id: testPhotoId }, true);
  check('添加照片', '将照片添加到相册', r);
}

r = await request('GET', '/albums');
check('相册列表', '获取公开相册列表', r);

if (testAlbumId) {
  r = await request('GET', `/albums/${testAlbumId}`);
  check('相册详情', '获取相册详情', r);
}

// ============ 8. 收藏 ============
console.log('\n--- 6. 收藏模块 ---');
if (testPhotoId) {
  r = await request('POST', '/favorites', { photo_id: testPhotoId }, true);
  check('添加收藏', '收藏照片', r);

  r = await request('GET', '/favorites/check', null, true);
  // 修改为带 query 参数
  const checkRes = await fetch(`${BASE}/favorites/check?photo_id=${testPhotoId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const checkData = await checkRes.json();
  console.log(`[${checkRes.status === 200 ? 'PASS' : 'FAIL'}] 收藏检查 > 检查收藏状态`);
  console.log(`       → ${checkRes.status} ${JSON.stringify(checkData).slice(0, 80)}\n`);
  if (checkRes.status === 200) passed++; else failed++;

  r = await request('GET', '/favorites', null, true);
  check('收藏列表', '获取收藏列表', r);
}

// ============ 9. 权限控制测试 ============
console.log('\n--- 7. 权限控制 ---');

// 未登录访问需登录接口
r = await request('POST', '/photos', { title: '未登录测试' });
check('权限-未登录', '未登录不能创建照片（应 401）', r);

// 使用无效 token
try {
  const badRes = await fetch(`${BASE}/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer invalid_token' },
    body: JSON.stringify({ title: '无效token测试' })
  });
  console.log(`[${badRes.status === 401 || badRes.status === 403 ? 'PASS' : 'FAIL'}] 权限-无效token > 无效token访问受限接口`);
  console.log(`       → ${badRes.status}\n`);
  if (badRes.status === 401 || badRes.status === 403) passed++; else failed++;
} catch (e) { failed++; }

// ============ 10. 统计接口 ============
console.log('\n--- 8. 统计模块 ---');
r = await request('GET', '/stats');
check('站点统计', '获取站点概览统计', r);

r = await request('GET', '/review/years');
check('年度回顾', '获取有照片的年份列表', r);

// ============ 11. 故事线 ============
console.log('\n--- 9. 故事线模块 ---');
r = await request('GET', '/storylines');
check('故事线', '获取故事线列表', r);

// ============ 12. 分享卡片 ============
console.log('\n--- 10. 分享卡片模块 ---');
if (testPhotoId) {
  r = await request('POST', '/share', {
    photo_ids: [testPhotoId],
    template: 'cinematic'
  });
  check('创建分享', '创建分享卡片', r);
  if (r.status === 201 || r.status === 200) {
    testShareId = r.data.share_id;
    if (testShareId) {
      r = await request('GET', `/share/${testShareId}`);
      check('获取分享', '获取分享卡片', r);
    }
  }
}

// ============ 13. 删除测试数据 ============
console.log('\n--- 11. 清理 ---');
if (testPhotoId) {
  r = await request('DELETE', `/photos/${testPhotoId}`, null, true);
  check('删除照片', '清理测试照片', r);
}
if (testAlbumId) {
  r = await request('DELETE', `/albums/${testAlbumId}`, null, true);
  check('删除相册', '清理测试相册', r);
}

// ============ 结果汇总 ============
console.log('='.repeat(60));
console.log(`  测试完成: 通过 ${passed} 项, 失败 ${failed} 项`);
console.log('='.repeat(60));
process.exit(failed > 0 ? 1 : 0);
