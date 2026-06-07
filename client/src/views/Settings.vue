<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores'
import { ai } from '../api'
import { success, error } from '../composables/useToast'

const router = useRouter()
const authStore = useAuthStore()

const aiConfig = ref({ enabled: false, provider: null, model: null, base_url: null, timeout: 0 })
const aiForm = ref({ enabled: false, provider: '', model: '', base_url: '', api_key: '' })
const aiSaveLoading = ref(false)
const aiEnabled = computed(() => aiConfig.value.enabled)

// AI 提供商配置
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

// 获取当前选中提供商的配置
const currentProvider = computed(() => {
  return providers.find(p => p.value === aiForm.value.provider)
})

// 模型输入占位符
const modelPlaceholder = computed(() => {
  return currentProvider.value ? `例如：${currentProvider.value.models}` : '请先选择提供商'
})

// Base URL 占位符
const baseUrlPlaceholder = computed(() => {
  return currentProvider.value ? (currentProvider.value.url || '请输入 Base URL') : '请选择提供商后自动填充'
})

// API Key 占位符
const apiKeyPlaceholder = computed(() => {
  if (!currentProvider.value) return '仅远程模型需要'
  if (!currentProvider.value.needKey) return '此提供商不需要 API Key'
  return `输入 ${currentProvider.value.label.split('(')[0].trim()} 的 API Key`
})

// 检查登录和管理员权限
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
  await loadAiConfig()
})

// 加载 AI 配置
const loadAiConfig = async () => {
  try {
    const res = await ai.getConfig()
    aiConfig.value = res.config || aiConfig.value
    const config = aiConfig.value
    aiForm.value = {
      enabled: Boolean(config.enabled),
      provider: config.provider || '',
      model: config.model || '',
      base_url: config.base_url || config.baseUrl || '',
      api_key: config.apiKey || ''
    }
  } catch (e) {
    console.error('加载 AI 配置失败:', e)
  }
}

// 监听提供商变化，自动填充 Base URL
watch(() => aiForm.value.provider, (newProvider) => {
  const provider = providers.find(p => p.value === newProvider)
  if (provider && provider.url) {
    // 仅在 base_url 为空或未手动修改过时自动填充
    if (!aiForm.value.base_url || providers.find(p => p.value === aiForm.value.provider)?.url === aiForm.value.base_url) {
      aiForm.value.base_url = provider.url
    }
    // 如果切换到不需要 API Key 的提供商，清空 API Key
    if (!provider.needKey) {
      aiForm.value.api_key = ''
    }
  }
})

const saveAiConfig = async () => {
  aiSaveLoading.value = true
  try {
    await ai.saveConfig({
      enabled: aiForm.value.enabled,
      provider: aiForm.value.provider || null,
      model: aiForm.value.model || null,
      base_url: aiForm.value.base_url || null,
      api_key: aiForm.value.api_key || null
    })
    await loadAiConfig()
    success('AI 配置已保存')
  } catch (e) {
    error(e.response?.data?.error || '保存 AI 配置失败')
  } finally {
    aiSaveLoading.value = false
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
        <h3>AI 配置</h3>
        <p class="settings-description">配置 AI 服务后，系统将使用该配置为照片自动生成标题、心情和标签建议。</p>
        
        <div class="ai-settings-grid">
          <label>
            <span>是否启用 AI</span>
            <input type="checkbox" v-model="aiForm.enabled" />
          </label>
          <label>
            <span>AI 提供商</span>
            <select v-model="aiForm.provider">
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
          <button type="button" @click="saveAiConfig" :disabled="aiSaveLoading">
            {{ aiSaveLoading ? '保存中...' : '保存 AI 配置' }}
          </button>
        </div>
        <div class="ai-status" v-if="aiEnabled">
          <span class="status-dot active"></span>
          当前状态：已启用 ({{ aiConfig.provider || '未知' }} / {{ aiConfig.model || '默认模型' }})
        </div>
        <div class="ai-status" v-else>
          <span class="status-dot inactive"></span>
          当前状态：未启用
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  min-height: calc(100vh - 140px);
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
  margin-bottom: 20px;
}

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
</style>
