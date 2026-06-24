<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const showPassword = ref(false)
const rememberMe = ref(false)

const fieldErrors = ref({ username: '', password: '' })
const touched = ref({ username: false, password: false })

// 实时验证
watch(username, (val) => {
  if (!touched.value.username) return
  if (!val.trim()) fieldErrors.value.username = '请输入用户名'
  else fieldErrors.value.username = ''
})

watch(password, (val) => {
  if (!touched.value.password) return
  if (!val) fieldErrors.value.password = '请输入密码'
  else fieldErrors.value.password = ''
})

const hasError = computed(() => fieldErrors.value.username || fieldErrors.value.password)

const handleLogin = async () => {
  touched.value.username = true
  touched.value.password = true

  fieldErrors.value.username = !username.value.trim() ? '请输入用户名' : ''
  fieldErrors.value.password = !password.value ? '请输入密码' : ''
  if (hasError.value) return

  loading.value = true
  error.value = ''

  try {
    await authStore.login(username.value, password.value, rememberMe.value)
    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } catch (e) {
    error.value = e.response?.data?.error || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-header">
        <h1 class="auth-title">欢迎回来</h1>
        <p class="auth-subtitle">登录你的光影手记账号</p>
      </div>

      <form @submit.prevent="handleLogin" class="auth-form" novalidate>
        <div class="field" :class="{ error: fieldErrors.username }">
          <label for="login-username">用户名</label>
          <div class="input-wrap">
            <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <input
              id="login-username"
              v-model="username"
              type="text"
              placeholder="输入用户名"
              :disabled="loading"
              autocomplete="username"
              @blur="touched.username = true"
            >
          </div>
          <transition name="msg-slide">
            <span v-if="fieldErrors.username" class="field-error">{{ fieldErrors.username }}</span>
          </transition>
        </div>

        <div class="field" :class="{ error: fieldErrors.password }">
          <label for="login-password">密码</label>
          <div class="input-wrap">
            <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              id="login-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="输入密码"
              :disabled="loading"
              autocomplete="current-password"
              @blur="touched.password = true"
            >
            <button type="button" class="toggle-pw" @click="showPassword = !showPassword" tabindex="-1">
              <svg v-if="!showPassword" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
          </div>
          <transition name="msg-slide">
            <span v-if="fieldErrors.password" class="field-error">{{ fieldErrors.password }}</span>
          </transition>
        </div>

        <label class="checkbox-label">
          <input v-model="rememberMe" type="checkbox" :disabled="loading">
          <span class="checkbox-custom"></span>
          <span>记住我</span>
        </label>

        <transition name="msg-slide">
          <div v-if="error" class="form-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            {{ error }}
          </div>
        </transition>

        <button type="submit" class="btn-submit" :disabled="loading">
          <span v-if="loading" class="btn-spinner"></span>
          <span v-else>登录</span>
        </button>
      </form>

      <p class="auth-hint">
        还没有账号？<router-link to="/register">立即注册</router-link>
      </p>
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

/* ========== Form ========== */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field > label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #666);
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.field-icon {
  position: absolute;
  left: 12px;
  color: var(--text-tertiary, #aaa);
  pointer-events: none;
  flex-shrink: 0;
}

.input-wrap input {
  width: 100%;
  padding: 0.75rem 0.875rem 0.75rem 2.5rem;
  border: 1px solid var(--input-border, #e0e0e0);
  border-radius: 10px;
  font-size: 0.9375rem;
  font-family: inherit;
  color: var(--text-color, #1a1a1a);
  background: var(--bg-primary, #fafafa);
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  outline: none;
}

.input-wrap input:focus {
  border-color: var(--secondary-color, #8b95a0);
  box-shadow: 0 0 0 3px rgba(139, 149, 160, 0.12);
  background: var(--card-bg, #fff);
}

.input-wrap input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.input-wrap input::placeholder {
  color: var(--text-tertiary, #bbb);
}

.input-wrap input:-webkit-autofill,
.input-wrap input:-webkit-autofill:hover,
.input-wrap input:-webkit-autofill:focus,
.input-wrap input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 1000px var(--bg-primary, #fafafa) inset !important;
  -webkit-text-fill-color: var(--text-color, #1a1a1a) !important;
  border: 1px solid var(--input-border, #e0e0e0) !important;
  transition: background-color 5000s ease-in-out 0s;
}

.field.error .input-wrap input {
  border-color: #e74c3c;
  box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.1);
}

/* Password toggle */
.toggle-pw {
  position: absolute;
  right: 8px;
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
}

.toggle-pw:hover {
  color: var(--text-secondary, #666);
  background: rgba(0,0,0,0.04);
}

/* Field error */
.field-error {
  font-size: 0.75rem;
  color: #e74c3c;
  padding-left: 2px;
}

/* Checkbox */
.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--text-secondary, #666);
  user-select: none;
}

.checkbox-label input {
  width: 0;
  height: 0;
  position: absolute;
  opacity: 0;
}

.checkbox-custom {
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--input-border, #d0d0d0);
  border-radius: 4px;
  flex-shrink: 0;
  position: relative;
  transition: all 0.15s;
}

.checkbox-label input:checked + .checkbox-custom {
  background: var(--secondary-color, #8b95a0);
  border-color: var(--secondary-color, #8b95a0);
}

.checkbox-label input:checked + .checkbox-custom::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 5px;
  width: 5px;
  height: 9px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox-label input:focus-visible + .checkbox-custom {
  box-shadow: 0 0 0 3px rgba(139, 149, 160, 0.2);
}

/* Form error */
.form-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(231, 76, 60, 0.06);
  border: 1px solid rgba(231, 76, 60, 0.15);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: #c0392b;
}

.form-error svg {
  flex-shrink: 0;
}

/* Submit button */
.btn-submit {
  position: relative;
  width: 100%;
  padding: 0.8125rem;
  background: var(--secondary-color, #8b95a0);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 0.9375rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.33, 1, 0.68, 1);
  margin-top: 0.25rem;
}

.btn-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(139, 149, 160, 0.35);
}

.btn-submit:active:not(:disabled) {
  transform: translateY(0);
}

.btn-submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2.5px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Hint */
.auth-hint {
  text-align: center;
  margin-top: 1.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary, #999);
}

.auth-hint a {
  color: var(--secondary-color, #8b95a0);
  text-decoration: none;
  font-weight: 500;
}

.auth-hint a:hover {
  text-decoration: underline;
}

/* Transition */
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
:global(.dark) .auth-card {
  background: var(--card-bg);
  box-shadow:
    0 1px 3px rgba(0,0,0,0.1),
    0 4px 12px rgba(0,0,0,0.15);
}

:global(.dark) .input-wrap input {
  background: oklch(20% 0.008 250);
  border-color: oklch(30% 0.01 250);
  color: #e4e4e7;
}

:global(.dark) .input-wrap input:focus {
  background: oklch(22% 0.008 250);
}

:global(.dark) .input-wrap input::placeholder {
  color: #52525b;
}

:global(.dark) .toggle-pw:hover {
  background: rgba(255,255,255,0.06);
}

:global(.dark) .checkbox-custom {
  border-color: oklch(40% 0.01 250);
}

:global(.dark) .form-error {
  background: rgba(231, 76, 60, 0.1);
  border-color: rgba(231, 76, 60, 0.2);
}

@media (max-width: 480px) {
  .auth-card {
    padding: 2rem 1.5rem;
  }
}
</style>
