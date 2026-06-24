<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const nickname = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)

const fieldErrors = ref({ username: '', nickname: '', password: '', confirmPassword: '' })
const touched = ref({ username: false, nickname: false, password: false, confirmPassword: false })

// 密码强度
const passwordStrength = computed(() => {
  const pw = password.value
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

// 用户名格式验证
const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/

// 实时验证
watch(username, (val) => {
  if (!touched.value.username) return
  if (!val.trim()) fieldErrors.value.username = '请输入用户名'
  else if (!usernameRegex.test(val)) fieldErrors.value.username = '3-20位字母、数字或下划线'
  else fieldErrors.value.username = ''
})

watch(nickname, (val) => {
  if (!touched.value.nickname) return
  fieldErrors.value.nickname = ''
})

watch(password, (val) => {
  if (!touched.value.password) return
  if (!val) fieldErrors.value.password = '请输入密码'
  else if (val.length < 6) fieldErrors.value.password = '密码长度至少为6位'
  else fieldErrors.value.password = ''

  // 重新验证确认密码
  if (touched.value.confirmPassword && confirmPassword.value) {
    fieldErrors.value.confirmPassword = val !== confirmPassword.value ? '两次输入的密码不一致' : ''
  }
})

watch(confirmPassword, (val) => {
  if (!touched.value.confirmPassword) return
  if (!val) fieldErrors.value.confirmPassword = '请再次输入密码'
  else if (val !== password.value) fieldErrors.value.confirmPassword = '两次输入的密码不一致'
  else fieldErrors.value.confirmPassword = ''
})

const hasError = computed(() =>
  fieldErrors.value.username || fieldErrors.value.password || fieldErrors.value.confirmPassword
)

const handleRegister = async () => {
  touched.value.username = true
  touched.value.password = true
  touched.value.confirmPassword = true

  fieldErrors.value.username = !username.value.trim() ? '请输入用户名' : !usernameRegex.test(username.value) ? '3-20位字母、数字或下划线' : ''
  fieldErrors.value.password = !password.value ? '请输入密码' : password.value.length < 6 ? '密码长度至少为6位' : ''
  fieldErrors.value.confirmPassword = !confirmPassword.value ? '请再次输入密码' : confirmPassword.value !== password.value ? '两次输入的密码不一致' : ''

  if (hasError.value) return

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    await authStore.register(username.value, password.value, nickname.value || username.value)
    success.value = '注册成功，正在登录...'
    setTimeout(() => router.push('/'), 800)
  } catch (e) {
    error.value = e.response?.data?.error || '注册失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-header">
        <h1 class="auth-title">创建账号</h1>
        <p class="auth-subtitle">开始记录你的光影故事</p>
      </div>

      <form @submit.prevent="handleRegister" class="auth-form" novalidate>
        <!-- 用户名 -->
        <div class="field" :class="{ error: fieldErrors.username }">
          <label for="reg-username">用户名</label>
          <div class="input-wrap">
            <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <input
              id="reg-username"
              v-model="username"
              type="text"
              placeholder="3-20位字母、数字或下划线"
              :disabled="loading"
              maxlength="20"
              autocomplete="username"
              @blur="touched.username = true"
            >
          </div>
          <transition name="msg-slide">
            <span v-if="fieldErrors.username" class="field-error">{{ fieldErrors.username }}</span>
          </transition>
        </div>

        <!-- 昵称 -->
        <div class="field" :class="{ error: fieldErrors.nickname }">
          <label for="reg-nickname">昵称 <span class="optional">选填</span></label>
          <div class="input-wrap">
            <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            <input
              id="reg-nickname"
              v-model="nickname"
              type="text"
              placeholder="显示名称"
              :disabled="loading"
              maxlength="50"
              @blur="touched.nickname = true"
            >
          </div>
        </div>

        <!-- 密码 -->
        <div class="field" :class="{ error: fieldErrors.password }">
          <label for="reg-password">密码</label>
          <div class="input-wrap">
            <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              id="reg-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="至少6位"
              :disabled="loading"
              autocomplete="new-password"
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
          <!-- 密码强度条 -->
          <div v-if="password" class="strength-bar">
            <div class="strength-track">
              <div
                class="strength-fill"
                :style="{ width: (passwordStrength.level / 4 * 100) + '%', background: passwordStrength.color }"
              ></div>
            </div>
            <span class="strength-label" :style="{ color: passwordStrength.color }">{{ passwordStrength.label }}</span>
          </div>
          <transition name="msg-slide">
            <span v-if="fieldErrors.password" class="field-error">{{ fieldErrors.password }}</span>
          </transition>
        </div>

        <!-- 确认密码 -->
        <div class="field" :class="{ error: fieldErrors.confirmPassword }">
          <label for="reg-confirm">确认密码</label>
          <div class="input-wrap">
            <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <input
              id="reg-confirm"
              v-model="confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              placeholder="再次输入密码"
              :disabled="loading"
              autocomplete="new-password"
              @blur="touched.confirmPassword = true"
            >
            <button type="button" class="toggle-pw" @click="showConfirmPassword = !showConfirmPassword" tabindex="-1">
              <svg v-if="!showConfirmPassword" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
            <span v-if="fieldErrors.confirmPassword" class="field-error">{{ fieldErrors.confirmPassword }}</span>
          </transition>
        </div>

        <!-- 错误/成功消息 -->
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

        <transition name="msg-slide">
          <div v-if="success" class="form-success">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            {{ success }}
          </div>
        </transition>

        <button type="submit" class="btn-submit" :disabled="loading">
          <span v-if="loading" class="btn-spinner"></span>
          <span v-else>注册</span>
        </button>
      </form>

      <p class="auth-hint">
        已有账号？<router-link to="/login">立即登录</router-link>
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
  gap: 1.125rem;
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

.optional {
  font-weight: 400;
  color: var(--text-tertiary, #aaa);
  font-size: 0.75rem;
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

/* Strength bar */
.strength-bar {
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

/* Field error */
.field-error {
  font-size: 0.75rem;
  color: #e74c3c;
  padding-left: 2px;
}

/* Messages */
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

.form-success {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(39, 174, 96, 0.06);
  border: 1px solid rgba(39, 174, 96, 0.15);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: #1e8449;
}

.form-success svg {
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

:global(.dark) .strength-track {
  background: oklch(30% 0.01 250);
}

:global(.dark) .form-error {
  background: rgba(231, 76, 60, 0.1);
  border-color: rgba(231, 76, 60, 0.2);
}

:global(.dark) .form-success {
  background: rgba(39, 174, 96, 0.1);
  border-color: rgba(39, 174, 96, 0.2);
}

@media (max-width: 480px) {
  .auth-card {
    padding: 2rem 1.5rem;
  }
}
</style>
