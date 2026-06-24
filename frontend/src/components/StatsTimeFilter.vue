<template>
  <div class="stats-time-filter">
    <select :value="modelValue.preset" @change="onPresetChange">
      <option value="all">全部时间</option>
      <option value="thisYear">今年</option>
      <option value="lastYear">去年</option>
      <option value="3months">近 3 个月</option>
      <option value="6months">近 6 个月</option>
      <option value="1year">近 1 年</option>
      <option value="custom">自定义</option>
    </select>
    <template v-if="modelValue.preset === 'custom'">
      <input type="date" :value="modelValue.start || ''" @change="onStartChange" class="date-input" />
      <span class="date-sep">至</span>
      <input type="date" :value="modelValue.end || ''" @change="onEndChange" class="date-input" />
    </template>
    <button v-if="showReset && modelValue.preset !== 'all'" class="reset-btn" @click="$emit('update:modelValue', { preset: 'all' })">
      重置
    </button>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Object, default: () => ({ preset: 'all' }) },
  showReset: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const presets = {
  all: () => null,
  thisYear: () => {
    const y = new Date().getFullYear()
    return { start: `${y}-01-01`, end: `${y}-12-31` }
  },
  lastYear: () => {
    const y = new Date().getFullYear() - 1
    return { start: `${y}-01-01`, end: `${y}-12-31` }
  },
  '3months': () => {
    const now = new Date()
    const start = new Date(now)
    start.setMonth(start.getMonth() - 3)
    return { start: fmt(start), end: fmt(now) }
  },
  '6months': () => {
    const now = new Date()
    const start = new Date(now)
    start.setMonth(start.getMonth() - 6)
    return { start: fmt(start), end: fmt(now) }
  },
  '1year': () => {
    const now = new Date()
    const start = new Date(now)
    start.setFullYear(start.getFullYear() - 1)
    return { start: fmt(start), end: fmt(now) }
  },
  custom: () => ({ start: null, end: null })
}

function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function onPresetChange(e) {
  const preset = e.target.value
  const range = presets[preset]()
  emit('update:modelValue', range ? { preset, ...range } : { preset })
}

function onStartChange(e) {
  emit('update:modelValue', { ...props.modelValue, start: e.target.value || null })
}

function onEndChange(e) {
  emit('update:modelValue', { ...props.modelValue, end: e.target.value || null })
}
</script>

<style scoped>
.stats-time-filter {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.stats-time-filter select {
  padding: 4px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
  outline: none;
}

.stats-time-filter select:focus {
  border-color: #409eff;
}

.date-input {
  padding: 4px 6px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 13px;
  color: #606266;
  outline: none;
  width: 130px;
}

.date-input:focus {
  border-color: #409eff;
}

.date-sep {
  color: #999;
}

.reset-btn {
  padding: 3px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  color: #909399;
  cursor: pointer;
}

.reset-btn:hover {
  color: #409eff;
  border-color: #409eff;
}
</style>
