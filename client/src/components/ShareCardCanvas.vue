<script setup>
import { computed } from 'vue'

const props = defineProps({
  template: { type: String, default: 'cinematic' },
  photos: { type: Array, default: () => [] },
  caption: { type: String, default: '' },
  date: { type: String, default: '' },
  location: { type: String, default: '' },
  tags: { type: Array, default: () => [] },
  userName: { type: String, default: '光影手记' }
})

const cardRef = ref(null)
defineExpose({ cardRef })

// 模板样式映射
const templateClass = computed(() => `template-${props.template}`)

// 格式化日期
const displayDate = computed(() => {
  if (!props.date) return ''
  const d = new Date(props.date)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
})
</script>

<template>
  <div ref="cardRef" class="share-card-canvas" :class="templateClass">
    <!-- 电影海报模板 -->
    <div v-if="template === 'cinematic'" class="tmpl cinematic">
      <div class="cinema-visual">
        <img v-if="photos[0]" :src="photos[0].url || photos[0].thumbnail_url" class="hero-img" />
        <div v-if="photos.length > 1" class="film-strip">
          <img v-for="p in photos.slice(1, 4)" :key="p.id" :src="p.url || p.thumbnail_url" />
        </div>
        <div class="cinema-overlay"></div>
      </div>
      <div class="cinema-text">
        <p v-if="caption" class="caption">{{ caption }}</p>
        <div class="meta-row">
          <span v-if="displayDate">{{ displayDate }}</span>
          <span v-if="location">· {{ location }}</span>
        </div>
      </div>
      <div class="brand-bar">
        <span>✨ {{ userName }}</span>
      </div>
    </div>

    <!-- 日历模板 -->
    <div v-else-if="template === 'calendar'" class="tmpl calendar">
      <div class="cal-header">
        <div class="cal-date-big">{{ displayDate || '2025.06.10' }}</div>
      </div>
      <div class="cal-grid">
        <div v-for="(p, i) in photos.slice(0, 6)" :key="p.id" class="cal-cell" :class="{ 'big': i === 0 }">
          <img :src="p.url || p.thumbnail_url" />
        </div>
      </div>
      <div class="cal-footer">
        <p v-if="caption" class="cal-caption">{{ caption }}</p>
        <span v-if="location" class="cal-loc">📍 {{ location }}</span>
        <span class="cal-brand">— {{ userName }}</span>
      </div>
    </div>

    <!-- 杂志模板 -->
    <div v-else-if="template === 'magazine'" class="tmpl magazine">
      <div class="mag-top">
        <h3 class="mag-title">{{ caption || '光影瞬间' }}</h3>
      </div>
      <div class="mag-layout">
        <div class="mag-main" v-if="photos[0]">
          <img :src="photos[0].url || photos[0].thumbnail_url" />
        </div>
        <div class="mag-side" v-if="photos.length > 1">
          <img v-for="p in photos.slice(1, 3)" :key="p.id" :src="p.url || p.thumbnail_url" />
        </div>
      </div>
      <div class="mag-info">
        <div class="mag-meta">
          <span v-if="displayDate">{{ displayDate }}</span>
          <span v-if="location">@ {{ location }}</span>
        </div>
        <div class="mag-tags" v-if="tags.length > 0">
          <span v-for="t in tags.slice(0, 4)" :key="t.id">#{{ t.name }}</span>
        </div>
        <div class="mag-brand-line">from {{ userName }} · Shimmer</div>
      </div>
    </div>

    <!-- 拼图模板 -->
    <div v-else class="tmpl collage">
      <div class="collage-grid" :class="{ 'single': photos.length === 1, 'two': photos.length === 2 }">
        <div v-for="(p, i) in photos.slice(0, 9)" :key="p.id" class="collage-cell" :style="{ gridArea: getGridArea(i) }">
          <img :src="p.url || p.thumbnail_url" />
        </div>
      </div>
      <div class="collage-caption" v-if="caption">
        <p>{{ caption }}</p>
      </div>
      <div class="collage-meta">
        <span v-if="date || location">{{ [date, location].filter(Boolean).join(' · ') }}</span>
        <span class="collage-brand">via {{ userName }}</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  methods: {
    getGridArea(i) {
      if (i === 0) return '1 / 1 / 3 / 3'
      return `auto / auto / span 1 / span ${this.photos.length <= 2 ? 1 : this.photos.length <= 4 ? 1 : 2}`
    }
  }
}
</script>

<style scoped>
.share-card-canvas {
  width: 480px;
  border-radius: 16px;
  overflow: hidden;
  background: white;
  box-shadow: 0 12px 40px rgba(0,0,0,0.15);
  font-family: 'Noto Sans SC', -apple-system, sans-serif;
}

/* ---- 电影海报 ---- */
.tmpl.cinematic { position: relative; height: 600px; }
.cinema-visual { position: absolute; inset: 0; }
.hero-img { width: 100%; height: 100%; object-fit: cover; }
.film-strip { position: absolute; bottom: 120px; right: 16px; display: flex; gap: 4px; }
.film-strip img { width: 64px; height: 80px; object-fit: cover; border-radius: 4px; border: 2px solid rgba(255,255,255,0.8); }
.cinema-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 55%); }
.cinema-text { position: absolute; bottom: 48px; left: 28px; right: 28px; color: white; z-index: 2; }
.caption { font-size: 1.15rem; line-height: 1.5; margin: 0 0 12px; text-shadow: 0 2px 8px rgba(0,0,0,0.5); }
.meta-row { font-size: 0.84rem; opacity: 0.7; letter-spacing: 0.04em; }
.brand-bar { position: absolute; top: 20px; left: 24px; z-index: 2; }
.brand-bar span { background: oklch(55% 0.16 75); color: white; padding: 5px 14px; border-radius: 14px; font-size: 0.78rem; font-weight: 600; }

/* ---- 日历 ---- */
.tmpl.calendar { padding: 24px; background: linear-gradient(160deg, #fffef8, #f8f5ee); }
.cal-header { margin-bottom: 18px; }
.cal-date-big { font-size: 2.4rem; font-weight: 800; color: oklch(35% 0.14 75); letter-spacing: -0.02em; }
.cal-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 16px; }
.cal-cell { border-radius: 8px; overflow: hidden; aspect-ratio: 1; }
.cal-cell.big { grid-column: span 2; grid-row: span 2; aspect-ratio: auto; }
.cal-cell img { width: 100%; height: 100%; object-fit: cover; }
.cal-footer { text-align: center; }
.cal-caption { font-size: 0.98rem; color: oklch(30% 0.014 75); line-height: 1.6; margin-bottom: 8px; }
.cal-loc { font-size: 0.84rem; color: oklch(50% 0.01 75); }
.cal-brand { display: block; margin-top: 10px; font-size: 0.78rem; color: var(--text-t); }

/* ---- 杂志 ---- */
.tmpl.magazine { padding: 28px 26px; background: #fafafa; }
.mag-title { font-size: 1.5rem; font-weight: 800; color: oklch(25% 0.02 75); margin: 0 0 18px; line-height: 1.25; }
.mag-layout { display: flex; gap: 8px; margin-bottom: 18px; }
.mag-main { flex: 2; border-radius: 12px; overflow: hidden; aspect-ratio: 4/3; }
.mag-main img { width: 100%; height: 100%; object-fit: cover; }
.mag-side { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.mag-side img { flex: 1; border-radius: 10px; object-fit: cover; min-height: 90px; }
.mag-info { border-top: 1px solid oklch(92% 0.005 75); padding-top: 14px; }
.mag-meta { font-size: 0.82rem; color: var(--text-s); margin-bottom: 8px; }
.mag-meta span { margin-right: 8px; }
.mag-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.mag-tags span { font-size: 0.76rem; color: oklch(52% 0.10 250); }
.mag-brand-line { font-size: 0.76rem; color: var(--text-t); }

/* ---- 拼图 ---- */
.tmpl.collage { padding: 12px; background: #1a1a1a; }
.collage-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; border-radius: 10px; overflow: hidden; }
.collage-grid.single { grid-template-columns: 1fr; }
.collage-grid.two { grid-template-columns: repeat(2, 1fr); }
.collage-cell { aspect-ratio: 1; overflow: hidden; }
.collage-cell img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
.collage-caption { padding: 12px 8px 4px; text-align: center; }
.collage-caption p { color: #eee; font-size: 0.95rem; margin: 0; line-height: 1.5; }
.collage-meta { display: flex; justify-content: space-between; padding: 8px 12px 12px; font-size: 0.74rem; color: #888; }
.collage-brand { color: #666; }
</style>
