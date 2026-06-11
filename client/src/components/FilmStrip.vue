<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  photos: { type: Array, default: () => [] }
})

const emit = defineEmits(['select'])
const paused = ref(false)

const stripPhotos = computed(() => {
  if (props.photos.length === 0) return []
  const duped = [...props.photos]
  while (duped.length < 20) duped.push(...props.photos)
  return duped
})
</script>

<template>
  <div
    class="film-strip-wrap"
    @mouseenter="paused = true"
    @mouseleave="paused = false"
  >
    <div class="film-strip-track">
      <div
        class="film-strip-inner"
        :style="{ animationPlayState: paused ? 'paused' : 'running' }"
      >
        <div
          v-for="(photo, i) in stripPhotos"
          :key="photo.id + '-' + i"
          class="film-frame"
          @click="emit('select', photo)"
        >
          <img :src="photo.thumbnail_url || photo.url" :alt="photo.title" loading="lazy" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.film-strip-wrap {
  position: relative;
  overflow: hidden;
  padding: 24px 0;
  cursor: pointer;
}
.film-strip-track {
  overflow: hidden;
  mask-image: linear-gradient(to right, transparent, #000 6%, #000 94%, transparent);
  -webkit-mask-image: linear-gradient(to right, transparent, #000 6%, #000 94%, transparent);
}
.film-strip-inner {
  display: flex;
  gap: 12px;
  animation: filmScroll 50s linear infinite;
  width: max-content;
}
@keyframes filmScroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.film-frame {
  flex-shrink: 0;
  width: 240px;
  height: 170px;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.3s, box-shadow 0.3s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.film-frame:hover {
  transform: scale(1.06) translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.18);
}
.film-frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

</style>
