<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores'
import AuthForm from '../components/AuthForm.vue'
import FormField from '../components/FormField.vue'
import PasswordToggle from '../components/PasswordToggle.vue'

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
  <AuthForm title="欢迎回来" subtitle="登录你的光影手记账号">
    <form @submit.prevent="handleLogin" class="auth-form" novalidate>
      <FormField
        v-model="username"
        label="用户名"
        icon="user"
        placeholder="输入用户名"
        autocomplete="username"
        :error="fieldErrors.username"
        :disabled="loading"
        @blur="touched.username = true"
      />

      <FormField
        v-model="password"
        label="密码"
        icon="lock"
        type="password"
        placeholder="输入密码"
        autocomplete="current-password"
        :error="fieldErrors.password"
        :disabled="loading"
        @blur="touched.password = true"
      >
        <template #suffix>
          <PasswordToggle v-model:visible="showPassword" />
        </template>
      </FormField>

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

    <template #hint>
      还没有账号？<router-link to="/register">立即注册</router-link>
    </template>
  </AuthForm>
</template>

<style scoped>
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
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
:global(.dark) .form-error {
  background: rgba(231, 76, 60, 0.1);
  border-color: rgba(231, 76, 60, 0.2);
}

:global(.dark) .checkbox-custom {
  border-color: oklch(40% 0.01 250);
}
</style>
