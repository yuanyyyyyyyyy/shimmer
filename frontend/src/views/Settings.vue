<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores'
import { ai, users, auth } from '../api'
import { success, error } from '../composables/useToast'

const router = useRouter()
const authStore = useAuthStore()

// ========== Tab ==========
const activeTab = ref('profile')

const tabs = [
  { key: 'profile', label: '个人资料', icon: 'user' },
  { key: 'security', label: '账户安全', icon: 'shield' },
  { key: 'ai', label: 'AI 设置', icon: 'cpu' },
  { key: 'hidden', label: '隐藏相册', icon: 'lock' }
]

// ========== 个人资料 ==========
const profileForm = ref({ nickname: '', bio: '' })
const profileLoading = ref(false)

// ========== 账户安全 ==========
const accountPasswordForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })
const accountPasswordLoading = ref(false)
const accountPasswordError = ref('')
const accountPasswordSuccess = ref('')

// ========== AI 预设管理 ==========
const presets = ref([])
const currentPresetId = ref(null)
const aiForm = ref({ enabled: false, provider: '', model: '', base_url: '', api_key: '' })
const showProviderDropdown = ref(false)
const providerSelectRef = ref(null)
const cleanForm = ref(null)
const aiSaveLoading = ref(false)
const aiTestLoading = ref(false)
const aiTestResult = ref(null)

const showNewPresetDialog = ref(false)
const newPresetName = ref('')

const confirmDialog = ref(null)

// ========== 隐藏相册密码管理 ==========
const hasHiddenPassword = ref(false)
const hiddenPasswordForm = ref({
  newPassword: '',
  confirmPassword: '',
  currentPassword: ''
})
const hiddenPasswordLoading = ref(false)
const showSetPassword = ref(false)
const showChangePassword = ref(false)
const showRemovePassword = ref(false)

// ========== AI Computed ==========
const isDirty = computed(() => {
  if (!cleanForm.value) return false
  const c = cleanForm.value
  const f = aiForm.value
  return f.enabled !== c.enabled || f.provider !== c.provider || f.model !== c.model || f.base_url !== c.base_url || f.api_key !== c.api_key
})

const formActivePresetId = computed(() => {
  const p = presets.value.find(p => p.is_active)
  return p?.id || null
})

const providers = [
  { value: 'ollama', label: 'Ollama (本地)', url: 'http://127.0.0.1:11434', models: 'llama3.2, qwen2.5, gemma2', desc: '本地部署，无需 API Key', needKey: false },
  { value: 'openai', label: 'OpenAI', url: 'https://api.openai.com/v1', models: 'gpt-4o, gpt-4o-mini, gpt-4-turbo', desc: 'GPT-4o / GPT-4 Turbo', needKey: true },
  { value: 'anthropic', label: 'Anthropic (Claude)', url: 'https://api.anthropic.com', models: 'claude-sonnet-4-20250514, claude-opus-4-20250514', desc: 'Claude 3.5 Sonnet / Opus', needKey: true },
  { value: 'google', label: 'Google (Gemini)', url: 'https://generativelanguage.googleapis.com/v1beta', models: 'gemini-2.0-flash, gemini-2.5-pro', desc: 'Gemini Pro / Ultra', needKey: true },
  { value: 'azure', label: 'Azure OpenAI', url: 'https://{your-resource}.openai.azure.com/openai/deployments/{deployment}', models: 'gpt-4o, gpt-35-turbo', desc: '微软 Azure 托管版本', needKey: true },
  { value: 'mistral', label: 'Mistral AI', url: 'https://api.mistral.ai/v1', models: 'mistral-large-latest, mistral-small-latest, codestral-latest', desc: 'Mistral Large / Mixtral', needKey: true },
  { value: 'deepseek', label: 'DeepSeek', url: 'https://api.deepseek.com/v1', models: 'deepseek-chat, deepseek-reasoner', desc: 'DeepSeek-V3 / R1 推理模型', needKey: true },
  { value: 'zhipu', label: '智谱 AI (GLM)', url: 'https://open.bigmodel.cn/api/paas/v4', models: 'glm-4-plus, glm-4-flash, glm-4-long', desc: 'GLM-4 系列', needKey: true },
  { value: 'moonshot', label: '月之暗面 (Kimi)', url: 'https://api.moonshot.cn/v1', models: 'moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k', desc: 'Kimi / Moonshot', needKey: true },
  { value: 'qwen', label: '通义千问 (Qwen)', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: 'qwen-plus, qwen-turbo, qwen-max, qwen-vl-max', desc: '阿里云 Qwen 系列', needKey: true },
  { value: 'ernie', label: '百度文心一言 (ERNIE)', url: 'https://qianfan.baidubce.com/v2', models: 'ernie-4.0-8k, ernie-4.0-turbo-8k, ernie-speed-128k', desc: '百度 ERNIE 系列', needKey: true },
  { value: 'groq', label: 'Groq', url: 'https://api.groq.com/openai/v1', models: 'llama-3.3-70b-versatile, mixtral-8x7b-32768', desc: '超高速推理 LLM', needKey: true },
  { value: 'openrouter', label: 'OpenRouter', url: 'https://openrouter.ai/api/v1', models: 'openai/gpt-4o, anthropic/claude-3.5-sonnet, google/gemini-pro-1.5', desc: '统一多模型网关', needKey: true },
  { value: 'custom', label: '自定义 / OpenAI 兼容', url: '', models: '自定义模型名称', desc: '任意兼容 OpenAI API 格式的服务', needKey: true }
]

const currentProvider = computed(() => {
  return providers.find(p => p.value === aiForm.value.provider)
})

const modelPlaceholder = computed(() => {
  return currentProvider.value ? `例如：${currentProvider.value.models}` : '请先选择提供商'
})

const baseUrlPlaceholder = computed(() => {
  return currentProvider.value ? (currentProvider.value.url || '请输入 Base URL') : '请选择提供商后自动填充'
})

const apiKeyPlaceholder = computed(() => {
  if (!currentProvider.value) return '仅远程模型需要'
  if (!currentProvider.value.needKey) return '此提供商不需要 API Key'
  return `输入 ${currentProvider.value.label.split('(')[0].trim()} 的 API Key`
})

const currentPreset = computed(() => {
  return presets.value.find(p => p.id === currentPresetId.value) || null
})

const currentPresetName = computed(() => {
  const preset = currentPreset.value
  return preset ? preset.name : '未选择预设'
})

// ========== Init ==========
onMounted(async () => {
  if (!authStore.isLoggedIn) {
    router.push('/login')
    return
  }
  await authStore.fetchUser()
  loadProfile()
  await Promise.all([loadPresets(), checkHiddenPasswordStatus()])
})

// ========== 个人资料方法 ==========
function loadProfile() {
  if (authStore.user) {
    profileForm.value = {
      nickname: authStore.user.nickname || '',
      bio: authStore.user.bio || ''
    }
  }
}

async function saveProfile() {
  profileLoading.value = true
  try {
    const res = await users.updateProfile(profileForm.value)
    authStore.user = { ...authStore.user, ...res.user }
    success('个人资料已更新')
  } catch (e) {
    error(e.response?.data?.error || '保存失败')
  } finally {
    profileLoading.value = false
  }
}

// ========== 账户安全方法 ==========
async function changeAccountPassword() {
  accountPasswordError.value = ''
  accountPasswordSuccess.value = ''

  if (!accountPasswordForm.value.oldPassword || !accountPasswordForm.value.newPassword) {
    accountPasswordError.value = '请填写旧密码和新密码'
    return
  }
  if (accountPasswordForm.value.newPassword.length < 6) {
    accountPasswordError.value = '新密码长度至少为6位'
    return
  }
  if (accountPasswordForm.value.newPassword !== accountPasswordForm.value.confirmPassword) {
    accountPasswordError.value = '两次输入的新密码不一致'
    return
  }

  accountPasswordLoading.value = true
  try {
    await auth.changePassword(accountPasswordForm.value.oldPassword, accountPasswordForm.value.newPassword)
    accountPasswordSuccess.value = '密码修改成功'
    accountPasswordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
  } catch (e) {
    accountPasswordError.value = e.response?.data?.error || '密码修改失败'
  } finally {
    accountPasswordLoading.value = false
  }
}

// ========== AI 方法 ==========
async function loadPresets() {
  try {
    const res = await ai.getPresets()
    presets.value = res.presets || []
    const active = presets.value.find(p => p.is_active)
    if (!currentPresetId.value) {
      if (active) {
        applyPresetToForm(active)
      } else if (presets.value.length > 0) {
        applyPresetToForm(presets.value[0])
      }
    }
  } catch (e) {
    console.error('加载预设列表失败:', e)
  }
}

function applyPresetToForm(preset) {
  currentPresetId.value = preset.id
  aiForm.value = {
    enabled: Boolean(preset.enabled),
    provider: preset.provider || '',
    model: preset.model || '',
    base_url: preset.base_url || '',
    api_key: preset.api_key || ''
  }
  cleanForm.value = { ...aiForm.value }
}

async function selectPreset(preset) {
  if (preset.id === currentPresetId.value) {
    if (!preset.is_active) {
      await activatePreset(preset)
    }
    return
  }
  if (isDirty.value) {
    confirmDialog.value = {
      message: `当前预设「${currentPresetName.value}」有未保存的更改。`,
      onConfirm: async () => {
        confirmDialog.value = null
        applyPresetToForm(preset)
      },
      onDiscard: async () => {
        confirmDialog.value = null
        applyPresetToForm(preset)
      },
      onCancel: () => {
        confirmDialog.value = null
      }
    }
    return
  }
  applyPresetToForm(preset)
}

async function activatePreset(preset) {
  try {
    await ai.activatePreset(preset.id)
    success(`已切换到预设「${preset.name}」`)
    await loadPresets()
  } catch (e) {
    error(e.response?.data?.error || '切换预设失败')
  }
}

async function saveCurrentPreset() {
  if (!currentPresetId.value) {
    showNewPresetDialog.value = true
    return
  }
  aiSaveLoading.value = true
  try {
    await ai.updatePreset(currentPresetId.value, {
      enabled: aiForm.value.enabled,
      provider: aiForm.value.provider || null,
      model: aiForm.value.model || null,
      base_url: aiForm.value.base_url || null,
      api_key: aiForm.value.api_key || null
    })
    cleanForm.value = { ...aiForm.value }
    success(`预设「${currentPresetName.value}」已更新`)
    await loadPresets()
  } catch (e) {
    error(e.response?.data?.error || '保存预设失败')
  } finally {
    aiSaveLoading.value = false
  }
}

async function testAiConnection() {
  aiTestLoading.value = true
  aiTestResult.value = null
  try {
    const res = await ai.testConnection()
    aiTestResult.value = res
    if (res.ok) {
      success(`连接成功 (${res.provider}/${res.model})`)
    } else {
      error(res.error || '连接失败')
    }
  } catch (e) {
    aiTestResult.value = { ok: false, error: e.response?.data?.error || '请求失败' }
    error(e.response?.data?.error || '测试连接失败')
  } finally {
    aiTestLoading.value = false
  }
}

// ========== 隐藏相册密码方法 ==========
async function checkHiddenPasswordStatus() {
  try {
    const res = await users.getHiddenPasswordStatus()
    hasHiddenPassword.value = res.hasPassword
  } catch (e) {
    console.error(e)
  }
}

async function setHiddenPassword() {
  const { newPassword, confirmPassword } = hiddenPasswordForm.value
  if (!newPassword) {
    error('请输入密码')
    return
  }
  if (newPassword.length < 6) {
    error('密码长度至少为6位')
    return
  }
  if (newPassword !== confirmPassword) {
    error('两次输入的密码不一致')
    return
  }
  hiddenPasswordLoading.value = true
  try {
    await users.setHiddenPassword(newPassword)
    success('密码设置成功')
    hasHiddenPassword.value = true
    showSetPassword.value = false
    hiddenPasswordForm.value = { newPassword: '', confirmPassword: '', currentPassword: '' }
  } catch (e) {
    error(e.response?.data?.error || '设置失败')
  } finally {
    hiddenPasswordLoading.value = false
  }
}

async function changeHiddenPassword() {
  const { newPassword, confirmPassword, currentPassword } = hiddenPasswordForm.value
  if (!currentPassword) {
    error('请输入当前密码')
    return
  }
  if (!newPassword) {
    error('请输入新密码')
    return
  }
  if (newPassword.length < 6) {
    error('密码长度至少为6位')
    return
  }
  if (newPassword !== confirmPassword) {
    error('两次输入的密码不一致')
    return
  }
  hiddenPasswordLoading.value = true
  try {
    await users.setHiddenPassword(newPassword, currentPassword)
    success('密码修改成功')
    showChangePassword.value = false
    hiddenPasswordForm.value = { newPassword: '', confirmPassword: '', currentPassword: '' }
  } catch (e) {
    error(e.response?.data?.error || '修改失败')
  } finally {
    hiddenPasswordLoading.value = false
  }
}

async function removeHiddenPassword() {
  const { currentPassword } = hiddenPasswordForm.value
  if (!currentPassword) {
    error('请输入隐藏相册密码以确认删除')
    return
  }
  hiddenPasswordLoading.value = true
  try {
    await users.removeHiddenPassword(currentPassword)
    success('密码已移除')
    hasHiddenPassword.value = false
    showRemovePassword.value = false
    hiddenPasswordForm.value = { newPassword: '', confirmPassword: '', currentPassword: '' }
  } catch (e) {
    error(e.response?.data?.error || '删除失败')
  } finally {
    hiddenPasswordLoading.value = false
  }
}

function openNewPresetDialog() {
  newPresetName.value = currentPresetName.value === '未选择预设' ? '' : currentPresetName.value
  showNewPresetDialog.value = true
}

async function confirmNewPreset() {
  const name = newPresetName.value.trim()
  if (!name) {
    error('请输入预设名称')
    return
  }
  aiSaveLoading.value = true
  try {
    const res = await ai.createPreset({
      name,
      enabled: aiForm.value.enabled,
      provider: aiForm.value.provider || null,
      model: aiForm.value.model || null,
      base_url: aiForm.value.base_url || null,
      api_key: aiForm.value.api_key || null
    })
    currentPresetId.value = res.id
    cleanForm.value = { ...aiForm.value }
    showNewPresetDialog.value = false
    newPresetName.value = ''
    success(`预设「${name}」已创建`)
    await loadPresets()
  } catch (e) {
    error(e.response?.data?.error || '创建预设失败')
  } finally {
    aiSaveLoading.value = false
  }
}

async function deletePreset(preset) {
  confirmDialog.value = {
    message: `确定要删除预设「${preset.name}」吗？此操作不可恢复。`,
    confirmLabel: '删除',
    danger: true,
    onConfirm: async () => {
      confirmDialog.value = null
      try {
        await ai.deletePreset(preset.id)
        if (currentPresetId.value === preset.id) {
          currentPresetId.value = null
          cleanForm.value = null
        }
        success(`预设「${preset.name}」已删除`)
        await loadPresets()
      } catch (e) {
        error(e.response?.data?.error || '删除预设失败')
      }
    },
    onCancel: () => {
      confirmDialog.value = null
    }
  }
}

function selectProvider(value) {
  aiForm.value.provider = value
  showProviderDropdown.value = false
  handleProviderChange(value)
}

function handleClickOutside(e) {
  if (providerSelectRef.value && !providerSelectRef.value.contains(e.target)) {
    showProviderDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

function handleProviderChange(newProvider) {
  const provider = providers.find(p => p.value === newProvider)
  if (provider && provider.url) {
    if (!aiForm.value.base_url || providers.find(p => p.value === aiForm.value.provider)?.url === aiForm.value.base_url) {
      aiForm.value.base_url = provider.url
    }
    if (!provider.needKey) {
      aiForm.value.api_key = ''
    }
  }
}
</script>

<template>
  <div class="settings-page">
    <div class="container">
      <div class="settings-header">
        <h2>设置</h2>
        <button class="back-btn" @click="router.push('/admin')">返回管理后台</button>
      </div>

      <!-- Tab 栏 -->
      <nav class="settings-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-item"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <!-- 个人资料 -->
          <svg v-if="tab.icon === 'user'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <!-- 账户安全 -->
          <svg v-if="tab.icon === 'shield'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <!-- AI 设置 -->
          <svg v-if="tab.icon === 'cpu'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
            <rect x="9" y="9" width="6" height="6"/>
            <line x1="9" y1="1" x2="9" y2="4"/>
            <line x1="15" y1="1" x2="15" y2="4"/>
            <line x1="9" y1="20" x2="9" y2="23"/>
            <line x1="15" y1="20" x2="15" y2="23"/>
            <line x1="20" y1="9" x2="23" y2="9"/>
            <line x1="20" y1="14" x2="23" y2="14"/>
            <line x1="1" y1="9" x2="4" y2="9"/>
            <line x1="1" y1="14" x2="4" y2="14"/>
          </svg>
          <!-- 隐藏相册 -->
          <svg v-if="tab.icon === 'lock'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          {{ tab.label }}
        </button>
      </nav>

      <!-- ========== 个人资料 Tab ========== -->
      <div v-if="activeTab === 'profile'" class="tab-content">
        <div class="settings-card">
          <h3>个人资料</h3>
          <p class="settings-description">管理你的个人信息。</p>

          <div class="profile-avatar-section">
            <div class="profile-avatar">
              <img v-if="authStore.user?.avatar" :src="authStore.user.avatar" :alt="authStore.user.nickname">
              <span v-else class="avatar-placeholder">
                {{ (authStore.user?.nickname || authStore.user?.username || '?').charAt(0).toUpperCase() }}
              </span>
            </div>
            <div class="profile-meta">
              <span class="profile-username">@{{ authStore.user?.username }}</span>
            </div>
          </div>

          <div class="profile-form">
            <label class="field">
              <span>昵称</span>
              <input v-model="profileForm.nickname" type="text" placeholder="显示名称" maxlength="50">
            </label>
            <label class="field">
              <span>个人简介</span>
              <textarea v-model="profileForm.bio" placeholder="介绍一下自己吧..." maxlength="200" rows="3"></textarea>
            </label>
            <div class="form-actions">
              <button type="button" @click="saveProfile" :disabled="profileLoading">
                {{ profileLoading ? '保存中...' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== 账户安全 Tab ========== -->
      <div v-if="activeTab === 'security'" class="tab-content">
        <div class="settings-card">
          <h3>修改密码</h3>
          <p class="settings-description">定期修改密码以保护账户安全。</p>

          <div class="security-form">
            <label class="field">
              <span>当前密码</span>
              <input v-model="accountPasswordForm.oldPassword" type="password" placeholder="请输入当前密码">
            </label>
            <label class="field">
              <span>新密码</span>
              <input v-model="accountPasswordForm.newPassword" type="password" placeholder="至少6位">
            </label>
            <label class="field">
              <span>确认新密码</span>
              <input v-model="accountPasswordForm.confirmPassword" type="password" placeholder="再次输入新密码">
            </label>

            <div v-if="accountPasswordError" class="form-message error">{{ accountPasswordError }}</div>
            <div v-if="accountPasswordSuccess" class="form-message success">{{ accountPasswordSuccess }}</div>

            <div class="form-actions">
              <button type="button" @click="changeAccountPassword" :disabled="accountPasswordLoading">
                {{ accountPasswordLoading ? '保存中...' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== AI 设置 Tab ========== -->
      <div v-if="activeTab === 'ai'" class="tab-content">
        <div class="settings-card">
          <h3>预设管理</h3>
          <p class="settings-description">管理多组 AI 配置，可随时切换不同的提供商、模型和密钥。</p>

          <div class="preset-list">
            <div
              v-for="preset in presets"
              :key="preset.id"
              class="preset-item"
              :class="{
                active: preset.is_active,
                selected: preset.id === currentPresetId && !preset.is_active
              }"
              @click="selectPreset(preset)"
            >
              <span class="preset-indicator">{{ preset.is_active ? '◉' : '○' }}</span>
              <div class="preset-info">
                <span class="preset-name">{{ preset.name }}</span>
                <span class="preset-summary">{{ preset.provider || '未配置' }} · {{ preset.model || '默认模型' }}</span>
                <span v-if="preset.is_active" class="preset-badge">当前</span>
              </div>
              <div class="preset-actions">
                <button
                  v-if="!preset.is_active"
                  class="action-btn switch-btn"
                  title="设为当前配置"
                  @click.stop="activatePreset(preset)"
                >切换</button>
                <button
                  class="action-btn delete-btn"
                  title="删除预设"
                  @click.stop="deletePreset(preset)"
                >删除</button>
              </div>
            </div>
            <div class="preset-item add-new" @click="openNewPresetDialog">
              <span class="add-icon">+</span>
              <span>另存当前配置为新预设</span>
            </div>
          </div>

          <h3>配置参数</h3>
          <p class="settings-description">
            当前编辑：<strong>{{ currentPresetName }}</strong>
            <span v-if="isDirty" class="dirty-tag">有未保存的更改</span>
          </p>

          <div class="ai-settings-grid">
            <label>
              <span>是否启用 AI</span>
              <input type="checkbox" v-model="aiForm.enabled" />
            </label>
            <label>
              <span>AI 提供商</span>
              <div class="provider-select" ref="providerSelectRef">
                <button type="button" class="provider-trigger" @click="showProviderDropdown = !showProviderDropdown">
                  <span v-if="currentProvider" class="provider-trigger-content">
                    <span class="provider-trigger-label">{{ currentProvider.label }}</span>
                    <span class="provider-trigger-tag" :class="currentProvider.needKey ? 'need-key' : 'no-key'">
                      {{ currentProvider.needKey ? '需要 Key' : '无需 Key' }}
                    </span>
                  </span>
                  <span v-else class="provider-trigger-placeholder">请选择提供商</span>
                  <svg class="provider-trigger-arrow" :class="{ open: showProviderDropdown }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                <transition name="dropdown">
                  <div v-if="showProviderDropdown" class="provider-dropdown">
                    <div class="provider-group">
                      <div class="provider-group-label">本地部署</div>
                      <button type="button" class="provider-option" :class="{ active: aiForm.provider === 'ollama' }" @click="selectProvider('ollama')">
                        <span class="provider-option-label">Ollama</span>
                        <span class="provider-option-desc">本地部署，无需 API Key</span>
                      </button>
                    </div>
                    <div class="provider-group">
                      <div class="provider-group-label">国外厂商</div>
                      <button type="button" class="provider-option" :class="{ active: aiForm.provider === 'openai' }" @click="selectProvider('openai')">
                        <span class="provider-option-label">OpenAI</span>
                        <span class="provider-option-desc">GPT-4o / 4-Turbo</span>
                      </button>
                      <button type="button" class="provider-option" :class="{ active: aiForm.provider === 'anthropic' }" @click="selectProvider('anthropic')">
                        <span class="provider-option-label">Anthropic</span>
                        <span class="provider-option-desc">Claude 3.5 Sonnet / Opus</span>
                      </button>
                      <button type="button" class="provider-option" :class="{ active: aiForm.provider === 'google' }" @click="selectProvider('google')">
                        <span class="provider-option-label">Google</span>
                        <span class="provider-option-desc">Gemini 2.0 / 2.5 Pro</span>
                      </button>
                      <button type="button" class="provider-option" :class="{ active: aiForm.provider === 'azure' }" @click="selectProvider('azure')">
                        <span class="provider-option-label">Azure OpenAI</span>
                        <span class="provider-option-desc">微软 Azure 托管</span>
                      </button>
                      <button type="button" class="provider-option" :class="{ active: aiForm.provider === 'mistral' }" @click="selectProvider('mistral')">
                        <span class="provider-option-label">Mistral AI</span>
                        <span class="provider-option-desc">Mistral Large</span>
                      </button>
                      <button type="button" class="provider-option" :class="{ active: aiForm.provider === 'groq' }" @click="selectProvider('groq')">
                        <span class="provider-option-label">Groq</span>
                        <span class="provider-option-desc">超高速推理</span>
                      </button>
                      <button type="button" class="provider-option" :class="{ active: aiForm.provider === 'openrouter' }" @click="selectProvider('openrouter')">
                        <span class="provider-option-label">OpenRouter</span>
                        <span class="provider-option-desc">多模型网关</span>
                      </button>
                    </div>
                    <div class="provider-group">
                      <div class="provider-group-label">国内厂商</div>
                      <button type="button" class="provider-option" :class="{ active: aiForm.provider === 'deepseek' }" @click="selectProvider('deepseek')">
                        <span class="provider-option-label">DeepSeek</span>
                        <span class="provider-option-desc">V3 / R1 推理</span>
                      </button>
                      <button type="button" class="provider-option" :class="{ active: aiForm.provider === 'zhipu' }" @click="selectProvider('zhipu')">
                        <span class="provider-option-label">智谱 AI</span>
                        <span class="provider-option-desc">GLM-4 系列</span>
                      </button>
                      <button type="button" class="provider-option" :class="{ active: aiForm.provider === 'moonshot' }" @click="selectProvider('moonshot')">
                        <span class="provider-option-label">月之暗面</span>
                        <span class="provider-option-desc">Kimi / Moonshot</span>
                      </button>
                      <button type="button" class="provider-option" :class="{ active: aiForm.provider === 'qwen' }" @click="selectProvider('qwen')">
                        <span class="provider-option-label">通义千问</span>
                        <span class="provider-option-desc">Qwen 系列</span>
                      </button>
                      <button type="button" class="provider-option" :class="{ active: aiForm.provider === 'ernie' }" @click="selectProvider('ernie')">
                        <span class="provider-option-label">百度文心</span>
                        <span class="provider-option-desc">ERNIE 4.0</span>
                      </button>
                    </div>
                    <div class="provider-group">
                      <div class="provider-group-label">自定义</div>
                      <button type="button" class="provider-option" :class="{ active: aiForm.provider === 'custom' }" @click="selectProvider('custom')">
                        <span class="provider-option-label">自定义 / OpenAI 兼容</span>
                        <span class="provider-option-desc">任意兼容 OpenAI API 格式的服务</span>
                      </button>
                    </div>
                  </div>
                </transition>
              </div>
            </label>
            <div class="provider-hint" v-if="currentProvider && currentProvider.desc">
              <span class="hint-icon">💡</span>
              {{ currentProvider.desc }}{{ currentProvider.needKey ? ' · 需要 API Key' : ' · 无需 API Key' }}
            </div>
            <label>
              <span>模型名称</span>
              <input type="text" v-model="aiForm.model" :placeholder="modelPlaceholder" />
            </label>
            <div class="provider-models" v-if="currentProvider && currentProvider.models">
              推荐模型：{{ currentProvider.models }}
            </div>
            <label>
              <span>Base URL</span>
              <input type="text" v-model="aiForm.base_url" :placeholder="baseUrlPlaceholder" />
            </label>
            <label>
              <span>API Key</span>
              <input type="password" v-model="aiForm.api_key" :placeholder="apiKeyPlaceholder" />
            </label>
          </div>

          <div class="ai-settings-actions">
            <button type="button" @click="saveCurrentPreset" :disabled="aiSaveLoading || !currentPresetId">
              {{ aiSaveLoading ? '保存中...' : '保存更改' }}
            </button>
            <button type="button" class="btn-outline" @click="openNewPresetDialog" :disabled="aiSaveLoading">
              另存为新预设
            </button>
            <button type="button" class="btn-outline btn-test" @click="testAiConnection" :disabled="aiTestLoading">
              {{ aiTestLoading ? '测试中...' : '测试连接' }}
            </button>
          </div>

          <div class="ai-status" v-if="formActivePresetId">
            <span class="status-dot active"></span>
            <span v-if="presets.find(p => p.is_active)">
              当前使用：<strong>{{ presets.find(p => p.is_active).name }}</strong>
              ({{ presets.find(p => p.is_active).provider || '未知' }} / {{ presets.find(p => p.is_active).model || '默认模型' }})
            </span>
          </div>
          <div class="ai-status" v-else>
            <span class="status-dot inactive"></span>
            当前状态：未启用
          </div>
        </div>
      </div>

      <!-- ========== 隐藏相册 Tab ========== -->
      <div v-if="activeTab === 'hidden'" class="tab-content">
        <div class="settings-card">
          <h3>隐藏相册密码</h3>
          <p class="settings-description">管理隐藏相册的访问密码。设置密码后，进入隐藏相册需要输入密码验证。</p>

          <div v-if="!hasHiddenPassword && !showSetPassword">
            <div class="password-empty-state">
              <div class="password-empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <p class="password-empty-title">未设置密码</p>
              <p class="password-empty-desc">设置密码后，进入隐藏相册需要输入密码验证</p>
              <button type="button" class="btn-set-password" @click="showSetPassword = true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                设置密码
              </button>
            </div>
          </div>

          <div v-if="hasHiddenPassword && !showChangePassword && !showRemovePassword">
            <p class="password-status">当前状态：已设置密码</p>
            <div class="password-action-list">
              <button type="button" class="password-action-row" @click="showChangePassword = true">
                <span class="password-action-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <span class="password-action-text">
                  <span class="password-action-label">修改密码</span>
                  <span class="password-action-desc">更改隐藏相册的访问密码</span>
                </span>
                <svg class="password-action-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
              <button type="button" class="password-action-row danger" @click="showRemovePassword = true">
                <span class="password-action-icon danger-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                </span>
                <span class="password-action-text">
                  <span class="password-action-label">移除密码</span>
                  <span class="password-action-desc">取消隐藏相册的密码保护</span>
                </span>
                <svg class="password-action-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- 设置密码表单 -->
          <div v-if="showSetPassword" class="password-form">
            <label>
              <span>新密码</span>
              <input type="password" v-model="hiddenPasswordForm.newPassword" placeholder="至少6位" />
            </label>
            <label>
              <span>确认密码</span>
              <input type="password" v-model="hiddenPasswordForm.confirmPassword" placeholder="再次输入密码" />
            </label>
            <div class="form-actions">
              <button type="button" @click="setHiddenPassword" :disabled="hiddenPasswordLoading">
                {{ hiddenPasswordLoading ? '保存中...' : '保存' }}
              </button>
              <button type="button" class="btn-outline" @click="showSetPassword = false; hiddenPasswordForm = { newPassword: '', confirmPassword: '', currentPassword: '' }">取消</button>
            </div>
          </div>

          <!-- 修改密码表单 -->
          <div v-if="showChangePassword" class="password-form">
            <label>
              <span>当前密码</span>
              <input type="password" v-model="hiddenPasswordForm.currentPassword" placeholder="输入当前密码" />
            </label>
            <label>
              <span>新密码</span>
              <input type="password" v-model="hiddenPasswordForm.newPassword" placeholder="至少6位" />
            </label>
            <label>
              <span>确认密码</span>
              <input type="password" v-model="hiddenPasswordForm.confirmPassword" placeholder="再次输入密码" />
            </label>
            <div class="form-actions">
              <button type="button" @click="changeHiddenPassword" :disabled="hiddenPasswordLoading">
                {{ hiddenPasswordLoading ? '保存中...' : '保存' }}
              </button>
              <button type="button" class="btn-outline" @click="showChangePassword = false; hiddenPasswordForm = { newPassword: '', confirmPassword: '', currentPassword: '' }">取消</button>
            </div>
          </div>

          <!-- 移除密码表单 -->
          <div v-if="showRemovePassword" class="password-form">
            <label>
              <span>输入隐藏相册密码以确认删除</span>
              <input type="password" v-model="hiddenPasswordForm.currentPassword" placeholder="输入密码" />
            </label>
            <div class="form-actions">
              <button type="button" class="danger" @click="removeHiddenPassword" :disabled="hiddenPasswordLoading">
                {{ hiddenPasswordLoading ? '删除中...' : '确认移除' }}
              </button>
              <button type="button" class="btn-outline" @click="showRemovePassword = false; hiddenPasswordForm = { newPassword: '', confirmPassword: '', currentPassword: '' }">取消</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div class="modal-overlay" v-if="showNewPresetDialog" @click.self="showNewPresetDialog = false">
        <div class="modal">
          <h3>另存为新预设</h3>
          <p class="modal-desc">将当前配置参数保存为一个新的预设。</p>
          <input
            class="modal-input"
            v-model="newPresetName"
            placeholder="输入预设名称，例如：人像调色"
            @keyup.enter="confirmNewPreset"
          />
          <div class="modal-actions">
            <button class="modal-btn primary" @click="confirmNewPreset" :disabled="aiSaveLoading">
              {{ aiSaveLoading ? '保存中...' : '确认创建' }}
            </button>
            <button class="modal-btn" @click="showNewPresetDialog = false">取消</button>
          </div>
        </div>
      </div>

      <div class="modal-overlay" v-if="confirmDialog" @click.self="confirmDialog.onCancel()">
        <div class="modal">
          <h3>{{ confirmDialog.danger ? '确认删除' : '未保存的更改' }}</h3>
          <p class="modal-desc">{{ confirmDialog.message }}</p>
          <div class="modal-actions">
            <button v-if="confirmDialog.onConfirm" class="modal-btn primary" :class="{ danger: confirmDialog.danger }" @click="confirmDialog.onConfirm">
              {{ confirmDialog.confirmLabel || '保存更改' }}
            </button>
            <button v-if="confirmDialog.onDiscard" class="modal-btn" @click="confirmDialog.onDiscard">
              不保存
            </button>
            <button class="modal-btn" @click="confirmDialog.onCancel">取消</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.settings-page {
  min-height: calc(100vh - 140px);
}

.settings-page .container {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 24px;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.settings-header h2 {
  margin: 0;
}

.back-btn {
  padding: 8px 16px;
  border: 1px solid var(--input-border);
  background: var(--card-bg);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--hover-bg);
}

/* ========== Tab 栏 ========== */
.settings-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--input-border);
  margin-bottom: 24px;
}

.tab-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: -1px;
}

.tab-item:hover {
  color: var(--text-color);
}

.tab-item.active {
  color: var(--secondary-color);
  border-bottom-color: var(--secondary-color);
}

.tab-item svg {
  flex-shrink: 0;
}

/* ========== Tab 内容 ========== */
.tab-content {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.settings-card {
  background: var(--card-bg);
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.settings-card h3 {
  margin-top: 0;
  margin-bottom: 8px;
}

.settings-description {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-bottom: 16px;
}

/* ========== 个人资料 ========== */
.profile-avatar-section {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--input-border);
}

.profile-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--secondary-color);
  flex-shrink: 0;
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 600;
  color: #fff;
}

.profile-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.profile-username {
  font-size: 14px;
  color: var(--text-secondary);
}

.profile-form .field,
.security-form .field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.profile-form .field:last-of-type,
.security-form .field:last-of-type {
  margin-bottom: 0;
}

.profile-form .field span,
.security-form .field span {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.profile-form input,
.profile-form textarea,
.security-form input {
  padding: 10px 12px;
  border: 1px solid var(--input-border);
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: border-color 0.2s;
}

.profile-form input:focus,
.profile-form textarea:focus,
.security-form input:focus {
  outline: none;
  border-color: var(--secondary-color);
}

.profile-form textarea {
  resize: vertical;
  min-height: 80px;
}

/* ========== 账户安全 ========== */
.form-message {
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13px;
  margin-top: 12px;
}

.form-message.error {
  background: rgba(220, 53, 69, 0.08);
  color: #dc3545;
  border: 1px solid rgba(220, 53, 69, 0.2);
}

.form-message.success {
  background: rgba(40, 167, 69, 0.08);
  color: #28a745;
  border: 1px solid rgba(40, 167, 69, 0.2);
}

/* ========== 表单操作 ========== */
.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.form-actions button {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: var(--secondary-color);
  color: #fff;
  transition: opacity 0.2s;
}

.form-actions button:hover:not(:disabled) {
  opacity: 0.85;
}

.form-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-actions button.danger {
  background: #dc3545;
}

.form-actions button.danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-outline {
  background: transparent !important;
  color: var(--text-color) !important;
  border: 1px solid var(--input-border) !important;
}

.btn-outline:hover:not(:disabled) {
  background: var(--hover-bg) !important;
}

/* ========== 隐藏相册密码管理 ========== */
.password-status {
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.password-empty-state {
  text-align: center;
  padding: 2rem 1rem;
}

.password-empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: var(--bg-color);
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

.password-empty-title {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-color);
  margin: 0 0 0.375rem;
}

.password-empty-desc {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin: 0 0 1.25rem;
}

.btn-set-password {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: var(--secondary-color);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.33, 1, 0.68, 1);
}

.btn-set-password:hover {
  opacity: 0.88;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(139, 149, 160, 0.3);
}

.btn-set-password:active {
  transform: translateY(0);
}

.password-action-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}

.password-action-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--input-border);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}

.password-action-row:hover {
  background: var(--hover-bg);
  border-color: var(--secondary-color);
}

.password-action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--bg-color);
  color: var(--text-secondary);
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.password-action-row:hover .password-action-icon {
  background: var(--secondary-color);
  color: #fff;
}

.password-action-icon.danger-icon {
  background: rgba(220, 53, 69, 0.08);
  color: #dc3545;
}

.password-action-row:hover .password-action-icon.danger-icon {
  background: #dc3545;
  color: #fff;
}

.password-action-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.password-action-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
}

.password-action-desc {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.password-action-chevron {
  color: var(--text-secondary);
  opacity: 0.5;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.password-action-row:hover .password-action-chevron {
  opacity: 1;
  transform: translateX(2px);
}

.password-action-row.danger .password-action-label {
  color: #dc3545;
}

.password-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.password-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.password-form label span {
  font-size: 14px;
  color: var(--text-secondary);
}

.password-form input {
  padding: 10px 12px;
  border: 1px solid var(--input-border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.password-form input:focus {
  outline: none;
  border-color: var(--secondary-color);
}

/* ========== AI 预设管理 ========== */
.preset-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 24px;
}

.preset-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.preset-item:hover {
  background: var(--hover-bg);
}

.preset-item.active {
  border-color: var(--secondary-color);
  background: var(--hover-bg);
}

.preset-item.selected {
  border-color: var(--secondary-color);
  border-style: dashed;
}

.preset-indicator {
  font-size: 16px;
  color: var(--text-secondary);
}

.preset-item.active .preset-indicator {
  color: var(--secondary-color);
}

.preset-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: relative;
}

.preset-name {
  font-weight: 500;
  font-size: 14px;
}

.preset-summary {
  font-size: 12px;
  color: var(--text-secondary);
}

.preset-badge {
  position: absolute;
  top: 0;
  right: 0;
  font-size: 11px;
  background: var(--secondary-color);
  color: #fff;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.preset-actions {
  display: flex;
  gap: 6px;
}

.action-btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--input-border);
  background: var(--card-bg);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}

.action-btn:hover {
  background: var(--hover-bg);
}

.delete-btn:hover {
  color: #dc3545;
  border-color: #dc3545;
}

.preset-item.add-new {
  border-style: dashed;
  justify-content: center;
  color: var(--text-secondary);
  gap: 8px;
}

.add-icon {
  font-size: 18px;
  font-weight: 300;
}

.ai-settings-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ai-settings-grid > label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-settings-grid label > span {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.ai-settings-grid input[type="text"],
.ai-settings-grid input[type="password"],
.ai-settings-grid select {
  padding: 10px 12px;
  border: 1px solid var(--input-border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.ai-settings-grid input:focus,
.ai-settings-grid select:focus {
  outline: none;
  border-color: var(--secondary-color);
}

.ai-settings-grid input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--secondary-color);
}

/* Provider Select Dropdown */
.provider-select {
  position: relative;
}

.provider-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid var(--input-border);
  border-radius: 6px;
  background: #fff;
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.provider-trigger:hover {
  border-color: var(--secondary-color);
}

.provider-trigger:focus {
  outline: none;
  border-color: var(--secondary-color);
}

.provider-trigger-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-trigger-placeholder {
  color: var(--text-tertiary);
}

.provider-trigger-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.provider-trigger-tag.need-key {
  background: rgba(251, 191, 36, 0.15);
  color: #d97706;
}

.provider-trigger-tag.no-key {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
}

.provider-trigger-arrow {
  transition: transform 0.2s;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.provider-trigger-arrow.open {
  transform: rotate(180deg);
}

.provider-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-height: 320px;
  overflow-y: auto;
  padding: 4px;
}

.provider-group {
  padding: 4px 0;
}

.provider-group:not(:last-child) {
  border-bottom: 1px solid var(--input-border);
}

.provider-group-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 6px 10px 4px;
}

.provider-option {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
  text-align: left;
  color: inherit;
}

.provider-option:hover {
  background: #f5f5f5;
}

.provider-option.active {
  background: #2f3640;
  color: #fff;
}

.provider-option-label {
  font-size: 13px;
  font-weight: 500;
}

.provider-option-desc {
  font-size: 11px;
  color: var(--text-tertiary);
}

.provider-option.active .provider-option-desc {
  color: rgba(255, 255, 255, 0.8);
}

/* Dropdown animation */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Scrollbar */
.provider-dropdown::-webkit-scrollbar {
  width: 4px;
}

.provider-dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.provider-dropdown::-webkit-scrollbar-thumb {
  background: var(--text-tertiary);
  border-radius: 2px;
}

/* Dark mode */
:root.dark .provider-trigger {
  background: #2a2a2a;
  border-color: #444;
  color: #e0e0e0;
}

:root.dark .provider-dropdown {
  background: #2a2a2a;
  border-color: #444;
}

:root.dark .provider-group-label {
  color: #888;
}

:root.dark .provider-group:not(:last-child) {
  border-bottom-color: #444;
}

:root.dark .provider-option:hover {
  background: #3a3a3a;
}

:root.dark .provider-option.active {
  background: #8b95a0;
}

:root.dark .provider-trigger-tag.need-key {
  background: rgba(251, 191, 36, 0.2);
}

:root.dark .provider-trigger-tag.no-key {
  background: rgba(34, 197, 94, 0.2);
}

.provider-hint {
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-color);
  padding: 10px 14px;
  border-radius: 6px;
}

.hint-icon {
  margin-right: 4px;
}

.provider-models {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: -8px;
}

.ai-settings-actions {
  display: flex;
  gap: 8px;
  margin-top: 20px;
}

.ai-settings-actions button {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: var(--secondary-color);
  color: #fff;
  transition: opacity 0.2s;
}

.ai-settings-actions button:hover:not(:disabled) {
  opacity: 0.85;
}

.ai-settings-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-settings-actions .btn-test {
  margin-left: auto;
}

.ai-status {
  margin-top: 16px;
  padding: 12px 16px;
  background: var(--bg-color);
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.active {
  background: #28a745;
}

.status-dot.inactive {
  background: #adb5bd;
}

.dirty-tag {
  font-size: 12px;
  color: #e67e22;
  margin-left: 8px;
  font-weight: 400;
}

/* ========== Modal ========== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 420px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}

.modal h3 {
  margin-top: 0;
  margin-bottom: 8px;
}

.modal-desc {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 16px;
}

.modal-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--input-border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-primary);
  color: var(--text-primary);
  box-sizing: border-box;
}

.modal-input:focus {
  outline: none;
  border-color: var(--secondary-color);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.modal-btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid var(--input-border);
  background: var(--card-bg);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;
}

.modal-btn:hover {
  background: var(--hover-bg);
}

.modal-btn.primary {
  background: var(--secondary-color);
  color: #fff;
  border-color: var(--secondary-color);
}

.modal-btn.primary:hover {
  opacity: 0.85;
}

.modal-btn.primary.danger {
  background: #dc3545;
  border-color: #dc3545;
}

.modal-btn.primary.danger:hover {
  background: #c82333;
}
</style>
