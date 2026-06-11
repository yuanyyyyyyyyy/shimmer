<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { photos } from '../api'
import DarkroomSpotlight from '../components/darkroom/DarkroomSpotlight.vue'
import DarkroomDevelop from '../components/darkroom/DarkroomDevelop.vue'
import DarkroomLightPaint from '../components/darkroom/DarkroomLightPaint.vue'
import DarkroomContactSheet from '../components/darkroom/DarkroomContactSheet.vue'

const router = useRouter()

const photo = ref(null)
const photoList = ref([])
const loading = ref(true)
const currentMode = ref('spotlight')

const modes = [
  { id: 'spotlight', label: '聚光灯' },
  { id: 'develop', label: '显影盘' },
  { id: 'lightpaint', label: '光绘' },
  { id: 'contactsheet', label: '接触印相' },
]

const loadPhoto = async () => {
  loading.value = true
  try {
    const res = await photos.getRandomDiary()
    photo.value = res.photo
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const loadPhotoList = async () => {
  try {
    const res = await photos.list({ page: 1, pageSize: 50, sort: 'created' })
    photoList.value = Array.isArray(res.data) ? res.data : []
  } catch (e) {
    console.error(e)
    try {
      const randomRes = await photos.getRandomDiary()
      if (randomRes.photo) photoList.value = [randomRes.photo]
    } catch (e2) {}
  }
}

const handleNext = async () => {
  await loadPhoto()
}

const handleViewDetail = () => {
  if (photo.value) router.push(`/photo/${photo.value.id}`)
}

const handleSelectPhoto = (p) => {
  photo.value = p
}

onMounted(async () => {
  await Promise.all([loadPhoto(), loadPhotoList()])
})
</script>

<template>
  <div class="darkroom">
    <div class="container">
      <div class="dial">
        <button
          v-for="m in modes"
          :key="m.id"
          class="mode-btn"
          :class="{ active: currentMode === m.id }"
          @click="currentMode = m.id"
        >
          <span class="mode-label">{{ m.label }}</span>
        </button>
      </div>

      <div class="mode-content">
        <div v-if="loading" class="loading">冲洗中...</div>
        <div v-else-if="!photo" class="empty">暂无日记</div>

        <DarkroomSpotlight
          v-show="currentMode === 'spotlight' && photo"
          :photo="photo"
          :photo-list="photoList"
          @next="handleNext"
          @view-detail="handleViewDetail"
          @select-photo="handleSelectPhoto"
        />

        <DarkroomDevelop
          v-show="currentMode === 'develop' && photo"
          :photo="photo"
          :photo-list="photoList"
          @next="handleNext"
          @select-photo="handleSelectPhoto"
        />
        <DarkroomLightPaint
          v-show="currentMode === 'lightpaint' && photo"
          :photo="photo"
          :photo-list="photoList"
          @next="handleNext"
          @select-photo="handleSelectPhoto"
        />
        <DarkroomContactSheet
          v-show="currentMode === 'contactsheet'"
          :photo="photo"
          :photo-list="photoList"
          @select-photo="handleSelectPhoto"
          @view-detail="handleViewDetail"
          @next="handleNext"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.darkroom {
  min-height: calc(100vh - 140px);
}

.dial {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
  gap: 4px;
}

.mode-btn {
  padding: 6px 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  border-radius: 16px;
  transition: all 0.2s;
  font-family: inherit;
  white-space: nowrap;
  font-weight: 500;
}

.mode-btn:hover {
  color: var(--text-color);
  background: var(--hover-bg);
}

.mode-btn.active {
  background: var(--hover-bg);
  color: var(--text-color);
}

.mode-content {
  min-height: 400px;
}

.loading, .empty {
  text-align: center;
  padding: 80px;
  color: #999;
}
</style>
