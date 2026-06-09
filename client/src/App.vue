<script setup>
import { ref, onMounted, watch, computed, onBeforeUnmount } from 'vue'
import { RouterLink, RouterView, useRouter, useRoute } from 'vue-router'
import { tags, ai } from './api'
import { useAuthStore } from './stores'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const searchQuery = ref('')
const searchSuggestions = ref([])
const suggestionsLoading = ref(false)
const popularTags = ref([])
const showTags = ref(false)
const isDarkMode = ref(false)
const showUserMenu = ref(false)
const showPopularTags = computed(() => showTags.value && !searchQuery.value.trim())

// 加载热门标签
const loadPopularTags = async () => {
  try {
    const res = await tags.getPopular(8)
    popularTags.value = res.tags
  } catch (e) {}
}

// 搜索
const handleSearch = () => {
  const query = searchQuery.value.trim()
  if (query) {
    router.push({ path: '/', query: { search: query } })
    showTags.value = false
    searchSuggestions.value = []
  }
}

const selectSuggestion = (value) => {
  searchQuery.value = value
  router.push({ path: '/', query: { search: value } })
  searchSuggestions.value = []
  showTags.value = false
}

const fetchSearchSuggestions = async (query) => {
  if (!query) {
    searchSuggestions.value = []
    return
  }
  suggestionsLoading.value = true
  try {
    const res = await ai.rewriteSearch(query)
    const suggestions = [
      ...(Array.isArray(res.keywords) ? res.keywords : []),
      ...(Array.isArray(res.tags) ? res.tags : [])
    ]
      .map(item => String(item).trim())
      .filter(Boolean)

    searchSuggestions.value = [...new Set(suggestions)].slice(0, 6)
  } catch (e) {
    searchSuggestions.value = []
  } finally {
    suggestionsLoading.value = false
  }
}

// 按标签筛选
const filterByTag = (tagId) => {
  router.push({ path: '/', query: { tag: tagId } })
  showTags.value = false
}

// 清除筛选
const clearFilters = () => {
  searchQuery.value = ''
  router.push({ path: '/' })
}

// 切换深色模式
const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value
  localStorage.setItem('darkMode', isDarkMode.value)
  document.documentElement.classList.toggle('dark', isDarkMode.value)
  document.documentElement.style.colorScheme = isDarkMode.value ? 'dark' : 'light'
}

// 退出登录
const handleLogout = () => {
  authStore.logout()
  showUserMenu.value = false
  router.push('/')
}

// 关闭用户菜单
const closeUserMenu = () => {
  showUserMenu.value = false
}

// 点击外部关闭菜单
const handleClickOutside = (e) => {
  if (showUserMenu.value && !e.target.closest('.user-menu-wrapper')) {
    showUserMenu.value = false
  }
}

// 初始化
onMounted(async () => {
  // 读取深色模式设置
  const saved = localStorage.getItem('darkMode')
  if (saved === 'true') {
    isDarkMode.value = true
    document.documentElement.classList.add('dark')
    document.documentElement.style.colorScheme = 'dark'
  } else {
    document.documentElement.style.colorScheme = 'light'
  }
  searchQuery.value = route.query.search || ''
  if (searchQuery.value.trim()) {
    fetchSearchSuggestions(searchQuery.value.trim())
  }
  loadPopularTags()

  // 获取用户信息
  if (authStore.token && !authStore.user) {
    await authStore.fetchUser()
  }

  // 添加点击事件监听
  document.addEventListener('click', handleClickOutside)
})

watch(() => route.query.search, (newSearch) => {
  searchQuery.value = newSearch || ''
  fetchSearchSuggestions(searchQuery.value)
})

let searchDebounceTimer = null
watch(searchQuery, (newQuery) => {
  clearTimeout(searchDebounceTimer)
  const trimmed = newQuery.trim()
  if (!trimmed) {
    searchSuggestions.value = []
    showTags.value = true
    return
  }
  showTags.value = false
  searchDebounceTimer = setTimeout(() => fetchSearchSuggestions(trimmed), 300)
})

onBeforeUnmount(() => {
  clearTimeout(searchDebounceTimer)
})

// 监听用户菜单状态
watch(showUserMenu, (newVal) => {
  if (newVal) {
    document.addEventListener('click', handleClickOutside)
  } else {
    document.removeEventListener('click', handleClickOutside)
  }
})
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="container">
        <RouterLink to="/" class="logo">光影手记</RouterLink>
        <div class="header-center">
          <!-- 搜索框 -->
          <div class="search-box">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索照片..."
              @keyup.enter="handleSearch"
              @focus="showTags = !searchQuery.trim()"
            />
            <button @click="handleSearch">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
            </button>
          </div>
          <div v-if="searchSuggestions.length > 0" class="search-suggestions">
            <span class="suggestion-label">AI 搜索建议：</span>
            <button
              v-for="suggestion in searchSuggestions"
              :key="suggestion"
              type="button"
              class="suggestion-pill"
              @click="selectSuggestion(suggestion)"
            >
              {{ suggestion }}
            </button>
            <span class="suggestion-loading" v-if="suggestionsLoading">AI 生成中...</span>
          </div>
          <!-- 热门标签 -->
          <div v-if="showPopularTags && popularTags.length > 0" class="tags-dropdown">
            <div class="tags-label">热门标签</div>
            <div class="tags-list">
              <span 
                v-for="tag in popularTags" 
                :key="tag.id" 
                class="tag-item"
                :style="{ backgroundColor: tag.color }"
                @click="filterByTag(tag.id)"
              >
                {{ tag.name }}
              </span>
            </div>
          </div>
        </div>
        <nav class="nav">
          <RouterLink to="/">首页</RouterLink>
          <RouterLink to="/timeline">时间轴</RouterLink>
          <RouterLink to="/darkroom">暗房</RouterLink>

          <!-- 未登录状态 -->
          <template v-if="!authStore.isLoggedIn">
            <RouterLink to="/login">登录</RouterLink>
          </template>

          <!-- 已登录状态 -->
          <template v-else>
            <RouterLink to="/favorites">收藏</RouterLink>
          </template>

          <RouterLink to="/review">回顾</RouterLink>
          <RouterLink to="/albums">相册</RouterLink>

          <button class="dark-toggle" @click="toggleDarkMode" :title="isDarkMode ? '切换亮色模式' : '切换深色模式'">
            {{ isDarkMode ? '☀️' : '🌙' }}
          </button>

          <!-- 用户菜单（已登录） -->
          <div v-if="authStore.isLoggedIn" class="user-menu-wrapper">
            <button class="user-btn" @click.stop="showUserMenu = !showUserMenu">
              <span class="user-avatar">
                {{ (authStore.user?.nickname || authStore.user?.username || 'U').charAt(0).toUpperCase() }}
              </span>
              <span class="user-name">{{ authStore.user?.nickname || authStore.user?.username }}</span>
              <span class="dropdown-arrow">▼</span>
            </button>
            <div v-if="showUserMenu" class="user-dropdown">
              <div class="dropdown-header">
                <span class="role-badge" :class="authStore.user?.role">
                  {{ authStore.user?.role === 'admin' ? '管理员' : '用户' }}
                </span>
              </div>
              <router-link :to="`/user/${authStore.user?.id}`" class="dropdown-item" @click="closeUserMenu">
                我的主页
              </router-link>
              <router-link to="/favorites" class="dropdown-item" @click="closeUserMenu">
                我的收藏
              </router-link>
              <router-link v-if="authStore.isAdmin" to="/admin" class="dropdown-item admin" @click="closeUserMenu">
                管理后台
              </router-link>
              <router-link v-if="authStore.isAdmin" to="/settings" class="dropdown-item admin" @click="closeUserMenu">
                AI 设置
              </router-link>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item logout" @click="handleLogout">
                退出登录
              </button>
            </div>
          </div>
        </nav>
      </div>
    </header>
    <main class="main">
      <RouterView />
    </main>
    <footer class="footer">
      <p>© 光影手记 · 用光影记录生活</p>
    </footer>
  </div>
</template>

<style>
:root {
  --primary-color: #2c3e50;
  --secondary-color: #3498db;
  --text-color: #333;
  --text-secondary: #666;
  --text-tertiary: #999;
  --bg-color: #fafafa;
  --card-bg: #fff;
}

:root.dark {
  --primary-color: #e0e0e0;
  --secondary-color: #64b5f6;
  --text-color: #e0e0e0;
  --text-secondary: #b0b0b0;
  --text-tertiary: #888;
  --bg-color: #1a1a1a;
  --card-bg: #2d2d2d;
  --hover-bg: rgba(255,255,255,0.1);
  color-scheme: dark;
}

/* 确保 dark 模式下图片保持原始色彩 */
:root.dark img {
  opacity: 1 !important;
}

:root {
  --hover-bg: rgba(0,0,0,0.05);
}

body {
  background-color: var(--bg-color);
  color: var(--text-color);
  line-height: 1.6;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.header {
  background: var(--card-bg);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header .container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
}

.header-center {
  position: relative;
  flex: 1;
  max-width: 400px;
  margin: 0 24px;
}

.search-box {
  display: flex;
  align-items: center;
  background: #f5f5f5;
  border-radius: 20px;
  padding: 4px 12px;
}

.search-box input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 8px;
  font-size: 14px;
  outline: none;
}

.search-box button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
  opacity: 0.5;
}

.tags-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 12px;
  margin-top: 8px;
}

.search-suggestions {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.search-suggestions .suggestion-label {
  color: var(--text-secondary);
  font-size: 12px;
}
.search-suggestions .suggestion-pill {
  background: #eef6ff;
  border: 1px solid #d6e8ff;
  color: #1558b5;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
}
.search-suggestions .suggestion-pill:hover {
  background: #d6e8ff;
}
.search-suggestions .suggestion-loading {
  color: var(--text-tertiary);
  font-size: 12px;
}

.tags-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-item {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  color: #fff;
  cursor: pointer;
  transition: transform 0.2s;
}

.tag-item:hover {
  transform: scale(1.05);
}

.logo {
  font-size: 1.5rem;
  color: var(--primary-color);
  text-decoration: none;
}

.nav {
  display: flex;
  align-items: center;
  gap: 24px;
}

.nav a {
  text-decoration: none;
  color: var(--text-color);
  font-weight: 500;
  transition: color 0.2s;
}

.nav a:hover,
.nav a.router-link-active {
  color: var(--secondary-color);
}

.admin-link {
  opacity: 0.6;
}

.dark-toggle {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background 0.2s;
}

.dark-toggle:hover {
  background: var(--hover-bg);
}

/* 用户菜单 */
.user-menu-wrapper {
  position: relative;
}

.user-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: 1px solid #ddd;
  border-radius: 20px;
  padding: 4px 12px 4px 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.user-btn:hover {
  background: var(--hover-bg);
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--secondary-color);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: bold;
}

.user-name {
  font-size: 0.9rem;
  color: var(--text-color);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-arrow {
  font-size: 0.6rem;
  color: var(--text-secondary);
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--card-bg);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  min-width: 180px;
  padding: 8px 0;
  z-index: 200;
}

.dropdown-header {
  padding: 8px 16px;
  border-bottom: 1px solid #eee;
  margin-bottom: 8px;
}

.role-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  background: #eee;
  color: #666;
}

.role-badge.admin {
  background: var(--secondary-color);
  color: #fff;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 10px 16px;
  text-align: left;
  text-decoration: none;
  color: var(--text-color);
  font-size: 0.9rem;
  background: none;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}

.dropdown-item:hover {
  background: var(--hover-bg);
}

.dropdown-item.admin {
  color: var(--secondary-color);
}

.dropdown-item.logout {
  color: #e74c3c;
}

.dropdown-divider {
  height: 1px;
  background: #eee;
  margin: 8px 0;
}

.main {
  min-height: calc(100vh - 140px);
  padding: 24px 0;
}

.footer {
  text-align: center;
  padding: 20px;
  color: var(--text-tertiary);
  font-size: 0.9rem;
}
</style>
