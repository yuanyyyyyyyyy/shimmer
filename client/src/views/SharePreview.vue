<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { share } from '../api'
import ShareCardCanvas from '../components/ShareCardCanvas.vue'

const route = useRoute()
const data = ref(null)
const loading = ref(true)

const loadShare = async () => {
  const shareId = route.params.shareId
  if (!shareId) return
  loading.value = true
  try {
    const res = await share.get(shareId)
    data.value = res
    document.title = `来自 光影手记的分享`
  } catch (e) {
    data.value = null
  } finally {
    loading.value = false
  }
}

onMounted(loadShare)
</script>

<template>
  <div class="share-preview-page">
    <!-- 加载中 -->
    <div v-if="loading" class="center-state">
      <div class="spinner-ring"></div>
      <p>正在加载分享卡片...</p>
    </div>

    <!-- 不存在 -->
    <div v-else-if="!data" class="center-state error-state">
      <p>😢 分享卡片不存在或已被删除</p>
      <router-link to="/" class="go-home-btn">去首页看看</router-link>
    </div>

    <!-- 卡片展示 -->
    <template v-else>
      <div class="card-stage">
        <ShareCardCanvas
          :template="data.template || 'cinematic'"
          :photos="data.photos || []"
          :caption="data.customText || ''"
          :date="data.storyDate || ''"
          :location="data.storyLocation || ''"
          :tags="data.tags || []"
          :userName="'光影手记 Shimmer'"
        />
      </div>

      <!-- 品牌区 -->
      <footer class="stage-footer">
        <p class="from-line">来自 <strong>光影手记 Shimmer</strong></p>
        <router-link to="/" class="cta-btn">我也想创建一个 →</router-link>
        <p class="view-count" v-if="data.viewCount">已有 {{ data.viewCount }} 人浏览</p>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.share-preview-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, oklch(96% 0.008 75), oklch(92% 0.012 75));
  padding: 32px 16px;
}

.center-state { text-align: center; color: var(--text-tertiary); }
.spinner-ring { width: 36px; height: 36px; border: 3px solid oklch(94% 0.008 75); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 0.7s linear infinite; margin: 0 auto 14px; }
@keyframes spin { to { transform: rotate(360deg); } }
.center-state p { font-size: 0.94rem; margin-bottom: 16px; }

.error-state p { font-size: 1.06rem; color: oklch(45% 0.14 25); }
.go-home-btn { display: inline-block; padding: 9px 24px; background: var(--color-primary); color: white; border-radius: 22px; text-decoration: none; font-weight: 500; font-size: 0.88rem; }

.card-stage { 
  max-width: 520px; 
  width: 100%;
  animation: floatUp 0.6s cubic-bezier(0.22, 1, 0.36, 1);
  box-shadow: 0 20px 60px rgba(0,0,0,0.12);
  border-radius: 18px;
  overflow: hidden;
}
@keyframes floatUp { from { opacity: 0; transform: translateY(30px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }

.stage-footer { text-align: center; margin-top: 32px; }
.from-line { font-size: 0.88rem; color: var(--text-secondary); }
.from-line strong { color: oklch(45% 0.12 75); }

.cta-btn {
  display: inline-block; margin-top: 12px; padding: 8px 22px;
  background: transparent; border: 1.5px solid oklch(55% 0.12 75);
  border-radius: 22px; color: var(--color-primary);
  text-decoration: none; font-size: 0.86rem; font-weight: 600;
  transition: all 0.22s;
}
.cta-btn:hover { background: oklch(55% 0.16 75); color: white; border-color: transparent; }

.view-count { font-size: 0.76rem; color: var(--text-tertiary); margin-top: 8px; }
</style>
