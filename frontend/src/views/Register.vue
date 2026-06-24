<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores'
import AuthForm from '../components/AuthForm.vue'
import FormField from '../components/FormField.vue'
import PasswordToggle from '../components/PasswordToggle.vue'
import PasswordStrength from '../components/PasswordStrength.vue'

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

const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/

watch(username, (val) => {
  if (!touched.value.username) return
  if (!val.trim()) fieldErrors.value.username = '请输入用户名'
  else if (!usernameRegex.test(val)) fieldErrors.value.username = '3-20位字母、数字或下划线'
  else fieldErrors.value.username = ''
})

watch(nickname, () => {
  if (!touched.value.nickname) return
  fieldErrors.value.nickname = ''
})

watch(password, (val) => {
  if (!touched.value.password) return
  if (!val) fieldErrors.value.password = '请输入密码'
  else if (val.length < 6) fieldErrors.value.password = '密码长度至少为6位'
  else fieldErrors.value.password = ''

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
  <AuthForm title="创建账号" subtitle="开始记录你的光影故事">
    <form @submit.prevent="handleRegister" class="auth-form" novalidate>
      <FormField
        v-model="username"
        label="用户名"
        icon="user"
        placeholder="3-20位字母、数字或下划线"
        autocomplete="username"
        :error="fieldErrors.username"
        :disabled="loading"
        maxlength="20"
        @blur="touched.username = true"
      />

      <FormField
        v-model="nickname"
        label="昵称"
        icon="edit"
        placeholder="显示名称"
        :disabled="loading"
        maxlength="50"
        @blur="touched.nickname = true"
      >
        <template #label>
          昵称 <span class="optional">选填</span>
        </template>
      </FormField>

      <FormField
        v-model="password"
        label="密码"
        icon="lock"
        type="password"
        placeholder="至少6位"
        autocomplete="new-password"
        :error="fieldErrors.password"
        :disabled="loading"
        @blur="touched.password = true"
      >
        <template #suffix>
          <PasswordToggle v-model:visible="showPassword" />
        </template>
        <template #extra>
          <PasswordStrength :password="password" />
        </template>
      </FormField>

      <FormField
        v-model="confirmPassword"
        label="确认密码"
        icon="shield"
        type="password"
        placeholder="再次输入密码"
        autocomplete="new-password"
        :error="fieldErrors.confirmPassword"
        :disabled="loading"
        @blur="touched.confirmPassword = true"
      >
        <template #suffix>
          <PasswordToggle v-model:visible="showConfirmPassword" />
        </template>
      </FormField>

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

    <template #hint>
      已有账号？<router-link to="/login">立即登录</router-link>
    </template>
  </AuthForm>
</template>

<style scoped>
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
}

.optional {
  font-weight: 400;
  color: var(--text-tertiary, #aaa);
  font-size: 0.75rem;
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

:global(.dark) .form-success {
  background: rgba(39, 174, 96, 0.1);
  border-color: rgba(39, 174, 96, 0.2);
}
</style>
