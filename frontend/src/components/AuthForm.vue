<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' }
})
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-header">
        <h1 class="auth-title">{{ title }}</h1>
        <p v-if="subtitle" class="auth-subtitle">{{ subtitle }}</p>
      </div>
      <slot />
      <p v-if="$slots.hint" class="auth-hint"><slot name="hint" /></p>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: calc(100vh - 140px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.auth-card {
  width: 100%;
  max-width: 400px;
  background: var(--card-bg, #fff);
  border-radius: 16px;
  padding: 2.5rem;
  box-shadow:
    0 1px 3px rgba(0,0,0,0.04),
    0 4px 12px rgba(0,0,0,0.06),
    0 16px 48px rgba(0,0,0,0.06);
}

.auth-header {
  text-align: center;
  margin-bottom: 2rem;
}

.auth-title {
  font-size: 1.5rem;
  font-weight: 300;
  letter-spacing: 0.02em;
  color: var(--text-color, #1a1a1a);
  margin: 0 0 0.5rem;
}

.auth-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary, #888);
  margin: 0;
}

.auth-hint {
  text-align: center;
  margin-top: 1.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary, #999);
}

.auth-hint :deep(a) {
  color: var(--secondary-color, #8b95a0);
  text-decoration: none;
  font-weight: 500;
}

.auth-hint :deep(a:hover) {
  text-decoration: underline;
}

/* Dark mode */
:global(.dark) .auth-card {
  background: var(--card-bg);
  box-shadow:
    0 1px 3px rgba(0,0,0,0.1),
    0 4px 12px rgba(0,0,0,0.15);
}

@media (max-width: 480px) {
  .auth-card {
    padding: 2rem 1.5rem;
  }
}
</style>
