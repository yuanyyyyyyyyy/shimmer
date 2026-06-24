<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  type: { type: String, default: 'text' },
  icon: { type: String, default: 'user' },
  error: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  autocomplete: { type: String, default: '' },
  maxlength: { type: Number, default: undefined },
  required: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'blur'])

const iconPaths = {
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'
}

const iconSvg = computed(() => iconPaths[props.icon] || iconPaths.user)

const inputType = computed(() => {
  if (props.type === 'password') return 'password'
  return 'text'
})

const onInput = (e) => emit('update:modelValue', e.target.value)
</script>

<template>
  <div class="form-field" :class="{ error: error }">
    <label v-if="label" class="form-field-label">
      <slot name="label">{{ label }}</slot>
    </label>
    <div class="form-field-wrap">
      <svg class="form-field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        v-html="iconSvg"></svg>
      <input
        class="form-field-input"
        :type="inputType"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :autocomplete="autocomplete"
        :maxlength="maxlength"
        @input="onInput"
        @blur="$emit('blur', $event)"
      >
      <slot name="suffix" />
    </div>
    <slot name="extra" />
    <transition name="msg-slide">
      <span v-if="error" class="form-field-error">{{ error }}</span>
    </transition>
  </div>
</template>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-field-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #666);
}

.form-field-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.form-field-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary, #aaa);
  pointer-events: none;
}

.form-field-input {
  width: 100%;
  min-width: 0;
  padding: 0.75rem 0.875rem 0.75rem 2.5rem;
  border: 1px solid var(--input-border, #e0e0e0);
  border-radius: 10px;
  font-size: 0.9375rem;
  font-family: inherit;
  color: var(--text-color, #1a1a1a);
  background: var(--card-bg, #fff);
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  outline: none;
}

.form-field-input:focus {
  border-color: var(--secondary-color, #8b95a0);
  box-shadow: 0 0 0 3px rgba(139, 149, 160, 0.12);
  background: var(--card-bg, #fff);
}

.form-field-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-field-input::placeholder {
  color: var(--text-tertiary, #bbb);
}

.form-field.error .form-field-input {
  border-color: #e74c3c;
  box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.1);
}

.form-field-error {
  font-size: 0.75rem;
  color: #e74c3c;
  padding-left: 2px;
}

/* Transitions */
.msg-slide-enter-active {
  transition: all 0.2s ease-out;
}
.msg-slide-leave-active {
  transition: all 0.15s ease-in;
}
.msg-slide-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
.msg-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Dark mode */
:global(.dark) .form-field-input {
  background: oklch(20% 0.008 250);
  border-color: oklch(30% 0.01 250);
  color: #e4e4e7;
}

:global(.dark) .form-field-input:focus {
  background: oklch(22% 0.008 250);
}

:global(.dark) .form-field-input::placeholder {
  color: #52525b;
}
</style>

<style>
/* Unscoped: Chrome autofill override - must not have scoped attribute selectors */
.form-field-input:-webkit-autofill,
.form-field-input:-webkit-autofill:hover,
.form-field-input:-webkit-autofill:focus,
.form-field-input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 1000px var(--card-bg, #fff) inset !important;
  -webkit-text-fill-color: var(--text-color, #1a1a1a) !important;
  border-color: var(--input-border, #e0e0e0) !important;
  transition: background-color 5000s ease-in-out 0s;
}
</style>
