<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { photos } from '../api'
import { getFingerprint } from '../stores'
import { favorites } from '../api'
import { error } from '../composables/useToast'
import Lightbox from '../components/Lightbox.vue'

const route = useRoute()
const router = useRouter()
const photo = ref(null)
const loading = ref(true)
const isFavorited = ref(false)
const fp = getFingerprint()

const lightboxVisible = ref(false)

const loadPhoto = async () => {
  loading.value = true
  try {
    const res = await photos.get(route.params.id)
    photo.value = res.photo
    const favRes = await favorites.check(photo.value.id, fp)
    isFavorited.value = favRes.isFavorited
  } catch (e) {
    error('照片不存在')
    router.push('/')
  } finally {
    loading.value = false
  }
}

const toggleFavorite = async () => {
  try {
    if (isFavorited.value) {
      await favorites.remove(photo.value.id, fp)
      isFavorited.value = false
    } else {
      await favorites.add(photo.value.id, fp)
      isFavorited.value = true
    }
  } catch (e) {
    error(e.response?.data?.error || '操作失败')
  }
}

const goBack = () => router.back()
const formatDate = (d) => d ? d.slice(0, 10) : ''

onMounted(loadPhoto)
</script>

<template>
  <div class="page">
    <div class="container">
      <button class="back-btn" @click="goBack">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 18l-6-6 6-6"/></svg>
        返回
      </button>

      <div v-if="loading" class="loading">加载中...</div>

      <template v-else-if="photo">
        <div class="hero" @click="lightboxVisible = true">
          <img :src="photo.url" :alt="photo.title" />
        </div>

        <div class="info">
          <div class="info-main">
            <h1 class="photo-title">{{ photo.title || '无题' }}</h1>
            <div class="meta-row">
              <span v-if="photo.shot_date" class="meta-item">{{ formatDate(photo.shot_date) }}</span>
              <span v-if="photo.location" class="meta-item">{{ photo.location }}</span>
              <span v-if="photo.mood" class="meta-item mood">{{ photo.mood }}</span>
            </div>
          </div>
          <div class="info-side">
            <button class="fav-btn" :class="{ active: isFavorited }" @click="toggleFavorite">
              <svg v-if="isFavorited" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              {{ isFavorited ? '已收藏' : '收藏' }}
            </button>
          </div>
        </div>

        <Lightbox
          v-if="photo"
          :photos="[photo]"
          :start-index="0"
          :visible="lightboxVisible"
          @close="lightboxVisible = false"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.page { min-height: calc(100vh - 140px); }

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  font-size: 0.88rem;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 10px 0;
  transition: color 0.2s;
}
.back-btn:hover { color: #000; }

.hero {
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  background: var(--n-200);
  margin-bottom: 28px;
}
.hero img {
  width: 100%;
  display: block;
}

.info {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  padding-bottom: 48px;
}
.info-main { flex: 1; min-width: 0; }
.photo-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 10px;
  line-height: 1.3;
}
.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  color: var(--text-secondary);
  font-size: 0.88rem;
}
.meta-item {
  display: inline-block;
}
.meta-item.mood {
  font-style: italic;
  color: var(--text-tertiary);
}

.info-side { flex-shrink: 0; }

.fav-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #000;
  color: #fff;
  border: none;
  padding: 10px 22px;
  border-radius: 24px;
  cursor: pointer;
  font-size: 0.88rem;
  transition: opacity 0.2s;
}
.fav-btn:hover { opacity: 0.85; }
.fav-btn.active {
  background: #fff;
  color: #e74c3c;
  border: 1px solid #eee;
}

.loading { text-align: center; padding: 60px 20px; color: var(--text-tertiary); }

@media (max-width: 600px) {
  .info { flex-direction: column; }
}
</style>
