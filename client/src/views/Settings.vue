<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores'
import { ai } from '../api'
import { success, error } from '../composables/useToast'

const router = useRouter()
const authStore = useAuthStore()

const presets = ref([])
const currentPresetId = ref(null)
const aiForm = ref({ enabled: false, provider: '', model: '', base_url: '', api_key: '' })
const cleanForm = ref(null)
const aiSaveLoading = ref(false)

const showNewPresetDialog = ref(false)
const newPresetName = ref('')

const confirmDialog = ref(null)

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

onMounted(async () => {
  if (!authStore.isLoggedIn) {
    router.push('/login')
    return
  }
  await authStore.fetchUser()
  if (!authStore.isAdmin) {
    router.push('/')
    return
  }
  await loadPresets()
})

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
        <h2>AI 全局设置</h2>
        <button class="back-btn" @click="router.push('/admin')">返回管理后台</button>
      </div>

      <div class="ai-settings-card">
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
            <select v-model="aiForm.provider" @change="handleProviderChange(aiForm.provider)">
              <option value="">请选择提供商</option>
              <optgroup label="本地部署">
                <option value="ollama">Ollama (本地)</option>
              </optgroup>
              <optgroup label="国外主流厂商">
                <option value="openai">OpenAI (GPT-4o/4-Turbo)</option>
                <option value="anthropic">Anthropic (Claude 3.5 Sonnet/Opus)</option>
                <option value="google">Google (Gemini 2.0/2.5 Pro)</option>
                <option value="azure">Azure OpenAI</option>
                <option value="mistral">Mistral AI (Mistral Large)</option>
                <option value="groq">Groq (超高速推理)</option>
                <option value="openrouter">OpenRouter (多模型网关)</option>
              </optgroup>
              <optgroup label="国内主流厂商">
                <option value="deepseek">DeepSeek (V3/R1 推理)</option>
                <option value="zhipu">智谱 AI (GLM-4)</option>
                <option value="moonshot">月之暗面 (Kimi/Moonshot)</option>
                <option value="qwen">通义千问 (Qwen)</option>
                <option value="ernie">百度文心一言 (ERNIE 4.0)</option>
              </optgroup>
              <optgroup label="自定义">
                <option value="custom">自定义 / OpenAI 兼容 API</option>
              </optgroup>
            </select>
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

.ai-settings-card {
  background: var(--card-bg);
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.ai-settings-card h3 {
  margin-top: 0;
  margin-bottom: 8px;
}

.settings-description {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-bottom: 16px;
}

.dirty-tag {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  background: #fff3cd;
  color: #856404;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

/* Preset list */
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
  padding: 10px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
  background: var(--bg-color);
}

.preset-item:hover {
  background: var(--hover-bg);
  border-color: var(--input-border);
}

.preset-item.active {
  background: var(--hover-bg);
  border-color: var(--secondary-color);
}

.preset-item.selected {
  border-color: var(--input-border);
}

.preset-indicator {
  font-size: 14px;
  color: var(--text-secondary);
  flex-shrink: 0;
  width: 16px;
  text-align: center;
}

.preset-item.active .preset-indicator {
  color: var(--secondary-color);
}

.preset-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.preset-name {
  font-weight: 500;
  font-size: 14px;
  white-space: nowrap;
}

.preset-summary {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preset-badge {
  display: inline-block;
  padding: 1px 6px;
  font-size: 11px;
  background: var(--secondary-color);
  color: #fff;
  border-radius: 4px;
  flex-shrink: 0;
}

.preset-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.action-btn {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid var(--input-border);
  background: var(--card-bg);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  background: var(--hover-bg);
}

.switch-btn {
  color: var(--secondary-color);
  border-color: var(--secondary-color);
}

.switch-btn:hover {
  background: var(--secondary-color);
  color: #fff;
}

.delete-btn:hover {
  border-color: #e74c3c;
  color: #e74c3c;
}

.add-new {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px dashed var(--input-border);
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.15s;
  background: transparent;
}

.add-new:hover {
  border-color: var(--secondary-color);
  color: var(--secondary-color);
  background: transparent;
}

.add-icon {
  font-size: 16px;
  font-weight: 600;
}

/* Form grid */
.ai-settings-grid {
  display: grid;
  gap: 16px;
  margin-bottom: 24px;
}

.ai-settings-grid > label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-settings-grid > label span {
  font-weight: 500;
  font-size: 14px;
}

.ai-settings-grid input[type="text"],
.ai-settings-grid input[type="password"],
.ai-settings-grid select {
  padding: 10px 12px;
  border: 1px solid var(--input-border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-color);
  color: var(--text-color);
}

.ai-settings-grid input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--secondary-color);
}

.ai-settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-bottom: 16px;
}

.ai-settings-actions button {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  background: var(--secondary-color);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.ai-settings-actions button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.ai-settings-actions button:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-outline {
  background: transparent !important;
  color: var(--text-color) !important;
  border: 1px solid var(--input-border) !important;
}

.btn-outline:hover:not(:disabled) {
  background: var(--hover-bg) !important;
}

.ai-status {
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
  background: #27ae60;
}

.status-dot.inactive {
  background: #95a5a6;
}

.provider-hint {
  padding: 10px 14px;
  background: linear-gradient(135deg, #f0f4ff, #e8f0fe);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
  border-left: 3px solid var(--secondary-color);
}

.hint-icon {
  flex-shrink: 0;
}

.provider-models {
  padding: 8px 12px;
  background: var(--bg-color);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  font-family: monospace;
  word-break: break-all;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 24px;
  width: 420px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.modal h3 {
  margin: 0 0 8px;
}

.modal-desc {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0 0 16px;
}

.modal-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--input-border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-color);
  color: var(--text-color);
  box-sizing: border-box;
  margin-bottom: 16px;
}

.modal-input:focus {
  outline: none;
  border-color: var(--secondary-color);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.modal-btn {
  padding: 8px 20px;
  border: 1px solid var(--input-border);
  background: var(--card-bg);
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
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
  opacity: 0.9;
}

.modal-btn.primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.modal-btn.danger {
  background: #e74c3c;
  border-color: #e74c3c;
}

.modal-btn.danger:hover {
  background: #c0392b;
}
</style>
