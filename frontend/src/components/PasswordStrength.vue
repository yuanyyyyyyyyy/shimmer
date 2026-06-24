<script setup>
import { computed } from 'vue'

const props = defineProps({ password: String })

const strength = computed(() => {
  const pw = props.password
  if (!pw) return { level: 0, label: '', color: '' }

  let score = 0
  if (pw.length >= 6) score++
  if (pw.length >= 8) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++

  if (score <= 1) return { level: 1, label: '弱', color: '#e74c3c' }
  if (score <= 2) return { level: 2, label: '弱', color: '#e67e22' }
  if (score <= 3) return { level: 3, label: '中', color: '#f39c12' }
  return { level: 4, label: '强', color: '#27ae60' }
})
</script>

<template>
  <div v-if="password" class="password-strength">
    <div class="strength-track">
      <div
        class="strength-fill"
        :style="{ width: (strength.level / 4 * 100) + '%', background: strength.color }"
      ></div>
    </div>
    <span class="strength-label" :style="{ color: strength.color }">{{ strength.label }}</span>
  </div>
</template>

<style scoped>
.password-strength {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-top: 2px;
}

.strength-track {
  flex: 1;
  height: 4px;
  background: var(--input-border, #e0e0e0);
  border-radius: 2px;
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease, background 0.3s ease;
}

.strength-label {
  font-size: 0.6875rem;
  font-weight: 500;
  min-width: 1.5em;
  text-align: right;
}

:global(.dark) .strength-track {
  background: oklch(30% 0.01 250);
}
</style>
