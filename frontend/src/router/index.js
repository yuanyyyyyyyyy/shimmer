import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Timeline from '../views/Timeline.vue'
import Darkroom from '../views/Darkroom.vue'
import Favorites from '../views/Favorites.vue'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import PhotoDetail from '../views/PhotoDetail.vue'
import Admin from '../views/Admin.vue'
import Settings from '../views/Settings.vue'
import Review from '../views/Review.vue'
import Albums from '../views/Albums.vue'
import AlbumDetail from '../views/AlbumDetail.vue'
import Storyline from '../views/Storyline.vue'
import StoryDetail from '../views/StoryDetail.vue'
import ShareCard from '../views/ShareCard.vue'
import SharePreview from '../views/SharePreview.vue'
import ShareManage from '../views/ShareManage.vue'
import HiddenAlbum from '../views/HiddenAlbum.vue'
import { useAuthStore } from '../stores'

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/timeline', name: 'Timeline', component: Timeline },
  { path: '/darkroom', name: 'Darkroom', component: Darkroom },
  { path: '/favorites', redirect: () => ({ path: '/', query: { filter: 'favorites' } }) },
  { path: '/albums', name: 'Albums', component: Albums },
  { path: '/albums/:id', name: 'AlbumDetail', component: AlbumDetail },
  { path: '/login', name: 'Login', component: Login },
  { path: '/register', name: 'Register', component: Register },
  { path: '/photo/:id', name: 'PhotoDetail', component: PhotoDetail },
  { path: '/admin', name: 'Admin', component: Admin, meta: { requiresAuth: true } },
  { path: '/settings', name: 'Settings', component: Settings, meta: { requiresAuth: true } },
  { path: '/review', name: 'Review', component: Review },
  { path: '/story', name: 'Storyline', component: Storyline },
  { path: '/story/:date/:location', name: 'StoryDetail', component: StoryDetail },
  { path: '/share/create', name: 'ShareCard', component: ShareCard, meta: { requiresAuth: true } },
  { path: '/shares', name: 'ShareManage', component: ShareManage, meta: { requiresAuth: true } },
  { path: '/share/:shareId', name: 'SharePreview', component: SharePreview },
  { path: '/hidden-album', name: 'HiddenAlbum', component: HiddenAlbum, meta: { requiresAuth: true } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // 如果有 token 但没有用户信息，先获取用户信息
  if (authStore.token && !authStore.user) {
    try {
      await authStore.fetchUser()
    } catch (e) {
      // token 失效，清除登录状态
      authStore.logout()
    }
  }

  // 需要管理员权限的页面
  if (to.meta.requiresAdmin) {
    if (!authStore.isLoggedIn) {
      return next({ name: 'Login', query: { redirect: to.fullPath } })
    }
    if (!authStore.isAdmin) {
      return next({ name: 'Home' })
    }
  }

  // 需要登录的页面
  if (to.meta.requiresAuth) {
    if (!authStore.isLoggedIn) {
      return next({ name: 'Login', query: { redirect: to.fullPath } })
    }
  }

  next()
})

export default router
