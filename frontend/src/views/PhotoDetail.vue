<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { photos } from '../api'
import { error } from '../composables/useToast'
import DarkroomPrint from '../components/DarkroomPrint.vue'

const route = useRoute()
const router = useRouter()
const photo = ref(null)
const loading = ref(true)

const loadPhoto = async () => {
  loading.value = true
  try {
    const res = await photos.get(route.params.id)
    photo.value = res.photo
  } catch (e) {
    error('照片不存在')
    router.push('/')
  } finally {
    loading.value = false
  }
}

onMounted(loadPhoto)
</script>

<template>
  <div class="detail-page">
    <div v-if="loading" class="loading">加载中...</div>
    <DarkroomPrint v-else-if="photo" :photo="photo" :page-mode="true" @close="router.back()" />
  </div>
</template>

<style scoped>
.detail-page { min-height: 100vh; background: #000; position: relative; }
.loading { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.3); }
</style>
