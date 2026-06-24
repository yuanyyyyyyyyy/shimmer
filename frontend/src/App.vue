<script setup>
import { ref, onMounted, watch, computed, onBeforeUnmount, nextTick } from 'vue'
import { RouterLink, RouterView, useRouter, useRoute } from 'vue-router'
import { tags, ai } from './api'
import { useAuthStore } from './stores'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
import CatMascot from './components/CatMascot.vue'

const searchQuery = ref('')
const searchSuggestions = ref([])
const suggestionsLoading = ref(false)
const popularTags = ref([])
const showTags = ref(false)
const isDarkMode = ref(false)
const showUserMenu = ref(false)
const showSearchBar = ref(false)
const scrolled = ref(false)
const searchInputRef = ref(null)
const searchBarRef = ref(null)
const showPopularTags = computed(() => showTags.value && !searchQuery.value.trim())

const navLinks = [
  { to: '/', label: '首页' },
  { to: '/timeline', label: '时间轴' },
  { to: '/story', label: '故事' },
  { to: '/darkroom', label: '暗房' },
  { to: '/review', label: '回顾' },
  { to: '/albums', label: '相册' }
]

const loadPopularTags = async () => {
  try {
    const res = await tags.getPopular(8)
    popularTags.value = res.tags
  } catch (e) {}
}

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
    sessionStorage.removeItem('aiSearchResult')
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

    // 缓存 AI 结果供 Home.vue 使用
    sessionStorage.setItem('aiSearchResult', JSON.stringify({
      keywords: Array.isArray(res.keywords) ? res.keywords : [],
      tags: Array.isArray(res.tags) ? res.tags : []
    }))
  } catch (e) {
    searchSuggestions.value = []
    sessionStorage.removeItem('aiSearchResult')
  } finally {
    suggestionsLoading.value = false
  }
}

const filterByTag = (tagId) => {
  router.push({ path: '/', query: { tag: tagId } })
  showTags.value = false
}

const clearFilters = () => {
  searchQuery.value = ''
  searchSuggestions.value = []
  router.push({ path: '/' })
  closeSearch()
}

const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value
  localStorage.setItem('darkMode', isDarkMode.value)
  document.documentElement.classList.toggle('dark', isDarkMode.value)
  document.documentElement.style.colorScheme = isDarkMode.value ? 'dark' : 'light'
}

const handleLogout = () => {
  authStore.logout()
  showUserMenu.value = false
  router.push('/')
}

const closeUserMenu = () => {
  showUserMenu.value = false
}

const openSearch = async () => {
  showSearchBar.value = true
  await nextTick()
  searchInputRef.value?.focus()
}

const closeSearch = () => {
  showSearchBar.value = false
  searchSuggestions.value = []
  showTags.value = false
}

const handleSearchKeydown = (e) => {
  if (e.key === 'Escape') {
    if (searchQuery.value.trim()) {
      searchQuery.value = ''
      searchSuggestions.value = []
    } else {
      closeSearch()
    }
  }
}

const handleClickOutside = (e) => {
  if (showUserMenu.value && !e.target.closest('.user-menu-wrapper')) {
    showUserMenu.value = false
  }
  if (showSearchBar.value && searchBarRef.value && !searchBarRef.value.contains(e.target) && !e.target.closest('.search-trigger')) {
    closeSearch()
  }
}

onMounted(async () => {
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

  if (authStore.token && !authStore.user) {
    await authStore.fetchUser()
  }

  document.addEventListener('click', handleClickOutside)

  const onScroll = () => { scrolled.value = window.scrollY > 50 }
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  cleanupScroll = () => window.removeEventListener('scroll', onScroll)
})

let cleanupScroll = null

let lastSearchedQuery = ''

watch(() => route.query.search, (newSearch) => {
  searchQuery.value = newSearch || ''
  // 只在搜索词真正变化时才调用 AI，避免重复请求
  if (newSearch && newSearch !== lastSearchedQuery) {
    lastSearchedQuery = newSearch
    fetchSearchSuggestions(newSearch)
  } else if (!newSearch) {
    lastSearchedQuery = ''
    searchSuggestions.value = []
  }
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
  if (cleanupScroll) cleanupScroll()
})

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
    <header class="header" :class="{ scrolled, 'search-open': showSearchBar }">
      <div class="header-inner">
        <div class="brand-row">
          <RouterLink to="/" class="brand-link">
            <span class="brand-cn">光影手记</span>
            <span class="brand-en" :class="{ hide: scrolled }">LIGHT &amp; SHADOW JOURNAL</span>
          </RouterLink>

          <div class="brand-actions">
            <button class="icon-btn search-trigger" @click="openSearch" title="搜索">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
            </button>
            <button class="icon-btn" @click="toggleDarkMode" :title="isDarkMode ? '切换亮色模式' : '切换深色模式'">
              <svg v-if="isDarkMode" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            </button>
            <template v-if="authStore.isLoggedIn">
              <div class="user-menu-wrapper">
                <button class="icon-btn user-avatar-btn" @click.stop="showUserMenu = !showUserMenu" :title="authStore.user?.nickname || authStore.user?.username">
                  {{ (authStore.user?.nickname || authStore.user?.username || 'U').charAt(0).toUpperCase() }}
                </button>
                <div v-if="showUserMenu" class="user-dropdown">
                  <div class="dropdown-header">
                    <span class="user-dropdown-name">{{ authStore.user?.nickname || authStore.user?.username }}</span>
                    <span class="role-badge" :class="authStore.user?.role">
                      {{ authStore.user?.role === 'admin' ? '管理员' : '用户' }}
                    </span>
                  </div>
                  <router-link to="/hidden-album" class="dropdown-item" @click="closeUserMenu">隐藏相册</router-link>
                  <router-link to="/admin" class="dropdown-item" @click="closeUserMenu">{{ authStore.isAdmin ? '管理后台' : '我的照片' }}</router-link>
                  <router-link to="/settings" class="dropdown-item" @click="closeUserMenu">设置</router-link>
                  <div class="dropdown-divider"></div>
                  <button class="dropdown-item logout" @click="handleLogout">退出登录</button>
                </div>
              </div>
            </template>
            <RouterLink v-else to="/login" class="icon-btn login-link" title="登录">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
            </RouterLink>
          </div>
        </div>

        <nav class="nav-row" :class="{ compact: scrolled }">
          <RouterLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="nav-link"
          >{{ link.label }}</RouterLink>
        </nav>
      </div>

      <!-- Search Bar (toggle) -->
      <div v-if="showSearchBar" ref="searchBarRef" class="search-bar" @keydown="handleSearchKeydown">
        <div class="search-bar-inner">
          <div class="search-field">
            <svg class="search-field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              placeholder="搜索照片..."
              @keyup.enter="handleSearch"
              @focus="showTags = !searchQuery.trim()"
            />
            <button class="search-close" @click="closeSearch" title="关闭">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div v-if="searchSuggestions.length > 0" class="search-extra">
            <span class="suggestion-label">AI 搜索建议</span>
            <div class="suggestion-pills">
              <button v-for="s in searchSuggestions" :key="s" class="pill" @click="selectSuggestion(s)">{{ s }}</button>
              <span v-if="suggestionsLoading" class="pill loading">···</span>
            </div>
          </div>

          <div v-if="showPopularTags && popularTags.length > 0" class="search-extra">
            <span class="suggestion-label">热门分类</span>
            <div class="suggestion-pills">
              <button v-for="tag in popularTags" :key="tag.id" class="pill" @click="filterByTag(tag.id)">{{ tag.name }}</button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="main" :class="{ 'search-expanded': showSearchBar }">
      <RouterView />
    </main>

    <footer class="footer">
      <p>© 光影手记 · 用光影记录生活</p>
    </footer>

    <CatMascot />
  </div>
</template>

<style>
:root {
  --primary-color: #2f3640;
  --secondary-color: #8b95a0;
  --color-primary: #2f3640;
  --color-secondary: #8b95a0;
  --n-200: oklch(94% 0.003 260);
  --n-300: oklch(86% 0.004 260);
  --text-color: #333;
  --text-secondary: #666;
  --text-tertiary: #999;
  --bg-color: #fafafa;
  --card-bg: #fff;
  accent-color: var(--secondary-color);
}

:root.dark {
  --primary-color: #c8cdd3;
  --secondary-color: #b0b8c0;
  --color-primary: #c8cdd3;
  --color-secondary: #b0b8c0;
  --n-200: oklch(30% 0.005 260);
  --n-300: oklch(40% 0.005 260);
  --text-color: #e0e0e0;
  --text-secondary: #b0b0b0;
  --text-tertiary: #888;
  --bg-color: #1a1a1a;
  --card-bg: #2d2d2d;
  --hover-bg: rgba(255,255,255,0.1);
  color-scheme: dark;
}

:root.dark img {
  opacity: 1 !important;
}

:root {
  --hover-bg: rgba(0,0,0,0.05);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background-color: var(--bg-color);
  color: var(--text-color);
  line-height: 1.6;
}

/* ===== HEADER ===== */
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: transparent;
  transition: background 0.3s, box-shadow 0.3s, backdrop-filter 0.3s;
}

.header.scrolled {
  background: rgba(255,255,255,0.88);
  backdrop-filter: blur(14px);
  box-shadow: 0 1px 0 rgba(0,0,0,0.06);
}

.header.search-open.scrolled {
  box-shadow: none;
}

:root.dark .header.scrolled {
  background: rgba(26,26,26,0.88);
}

.header-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 16px 24px 8px;
  transition: padding 0.3s;
}

.header.scrolled .header-inner {
  padding: 8px 24px;
}

/* Brand Row */
.brand-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 8px;
  transition: margin 0.3s;
}

.header.scrolled .brand-row {
  margin-bottom: 0;
}

.brand-link {
  text-decoration: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1;
}

.brand-cn {
  font-family: 'Georgia', 'Noto Serif SC', 'Songti SC', serif;
  font-size: 1.6rem;
  font-weight: 300;
  letter-spacing: 0.12em;
  color: #000;
  transition: font-size 0.3s;
}

.header.scrolled .brand-cn {
  font-size: 1.2rem;
}

:root.dark .brand-cn {
  color: #e0e0e0;
}

.brand-en {
  font-size: 0.68rem;
  font-weight: 400;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  transition: opacity 0.3s, max-height 0.3s;
  max-height: 20px;
  opacity: 1;
}

.brand-en.hide {
  max-height: 0;
  opacity: 0;
  pointer-events: none;
}

/* Brand Actions */
.brand-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 2px;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.icon-btn:hover {
  background: var(--hover-bg);
  color: #000;
}

:root.dark .icon-btn:hover {
  color: #e0e0e0;
}

.login-link {
  text-decoration: none;
}

/* User Avatar */
.user-avatar-btn {
  font-size: 0.8rem;
  font-weight: 700;
  background: #000 !important;
  color: #fff !important;
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.user-avatar-btn:hover {
  opacity: 0.85;
}

/* Nav Row */
.nav-row {
  display: flex;
  gap: 0;
  margin-left: -2px;
}

.nav-link {
  position: relative;
  text-decoration: none;
  color: var(--text-tertiary);
  font-size: 0.78rem;
  font-weight: 300;
  letter-spacing: 0.06em;
  padding: 2px 10px;
  transition: color 0.2s;
}

.nav-link:not(:last-child)::after {
  content: '·';
  position: absolute;
  right: -2px;
  color: var(--n-300);
  font-weight: 300;
}

.nav-link:hover {
  color: var(--text-color);
}

.nav-link.router-link-active {
  color: #000;
  font-weight: 500;
}

:root.dark .nav-link.router-link-active {
  color: #e0e0e0;
}

/* ===== SEARCH BAR ===== */
.search-bar {
  background: var(--card-bg);
  border-bottom: 1px solid var(--n-300);
  animation: searchSlide 0.2s ease;
}

@keyframes searchSlide {
  from { transform: translateY(-8px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.search-bar-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 12px 24px 16px;
}

.search-field {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--n-200);
  border-radius: 8px;
}

.search-field-icon {
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.search-field input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  outline: none;
  color: var(--text-color);
  min-width: 0;
}

.search-field input::placeholder {
  color: var(--text-tertiary);
}

.search-close {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: color 0.2s;
}

.search-close:hover {
  color: #000;
}

.search-extra {
  margin-top: 12px;
}

.suggestion-label {
  display: block;
  font-size: 0.7rem;
  color: var(--text-tertiary);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.suggestion-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pill {
  padding: 4px 12px;
  border-radius: 14px;
  border: 1px solid var(--n-300);
  background: transparent;
  font-size: 0.78rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.pill:hover {
  border-color: #000;
  color: #000;
}

.pill.loading {
  border-style: dashed;
  cursor: default;
}

.pill.loading:hover {
  border-color: var(--n-300);
  color: var(--text-secondary);
}

/* ===== USER DROPDOWN ===== */
.user-menu-wrapper {
  position: relative;
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--card-bg);
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.12);
  min-width: 170px;
  padding: 6px 0;
  z-index: 200;
}

.dropdown-header {
  padding: 10px 16px 8px;
  border-bottom: 1px solid var(--n-200);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-dropdown-name {
  font-size: 0.85rem;
  font-weight: 600;
}

.role-badge {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 4px;
  font-size: 0.65rem;
  background: var(--n-200);
  color: var(--text-tertiary);
}

.role-badge.admin {
  background: var(--primary-color);
  color: #fff;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 9px 16px;
  text-align: left;
  text-decoration: none;
  color: var(--text-color);
  font-size: 0.85rem;
  background: none;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}

.dropdown-item:hover {
  background: var(--hover-bg);
}

.dropdown-item.admin {
  font-weight: 600;
}

.dropdown-item.logout {
  color: #e74c3c;
}

.dropdown-divider {
  height: 1px;
  background: var(--n-200);
  margin: 4px 0;
}

/* ===== MAIN & FOOTER ===== */
.main {
  min-height: calc(100vh - 140px);
  padding: 32px 0;
  transition: padding 0.3s;
}

.main.search-expanded {
  padding-top: 0;
}

.footer {
  text-align: center;
  padding: 24px 20px;
  color: var(--text-tertiary);
  font-size: 0.82rem;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 700px) {
  .header-inner {
    padding: 12px 16px 6px;
  }

  .header.scrolled .header-inner {
    padding: 6px 16px;
  }

  .brand-cn {
    font-size: 1.3rem;
  }

  .header.scrolled .brand-cn {
    font-size: 1.1rem;
  }

  .brand-en {
    font-size: 0.6rem;
  }

  .nav-link {
    font-size: 0.72rem;
    padding: 2px 8px;
  }
}
</style>
