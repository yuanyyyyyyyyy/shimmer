<script setup>
const props = defineProps({ visible: Boolean })
const emit = defineEmits(['update:visible'])
const toggle = () => emit('update:visible', !props.visible)
</script>

<template>
  <button type="button" class="toggle-pw" @click="toggle" tabindex="-1">
    <svg v-if="!visible" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
    <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  </button>
</template>

<style scoped>
.toggle-pw {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-tertiary, #aaa);
  transition: color 0.15s, background 0.15s;
  z-index: 1;
}

.toggle-pw:hover {
  color: var(--text-secondary, #666);
  background: rgba(0,0,0,0.04);
}

:global(.dark) .toggle-pw:hover {
  background: rgba(255,255,255,0.06);
}
</style>
