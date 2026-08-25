<template>
  <div class="time-editor">
    <n-radio-group
      v-model:value="mode"
      size="small"
    >
      <n-radio-button value="none">
        未定时（草稿）
      </n-radio-button>
      <n-radio-button value="calendar">
        纪年法
      </n-radio-button>
      <n-radio-button value="custom">
        自定义
      </n-radio-button>
    </n-radio-group>
    <div
      v-if="mode === 'calendar'"
      class="tm-fields"
    >
      <n-input
        v-model:value="era"
        placeholder="历名，如：第三纪元"
      />
      <n-input
        v-model:value="year"
        placeholder="年"
      />
      <n-input
        v-model:value="month"
        placeholder="月"
      />
      <n-input
        v-model:value="day"
        placeholder="日"
      />
    </div>
    <n-input
      v-else-if="mode === 'custom'"
      v-model:value="text"
      placeholder="自由填写，如：黑暗时代的中叶"
    />
    <span
      v-if="mode === 'calendar'"
      class="tm-hint"
    >四段均为自由字符串，至少填写一段</span>
    <span
      v-else-if="mode === 'custom'"
      class="tm-hint"
    >完全自由的文本</span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { NRadioGroup, NRadioButton, NInput } from 'naive-ui'
import type { EventTime } from '@/types'

const props = defineProps<{ modelValue: EventTime | null }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: EventTime | null): void }>()

const mode = ref<'none' | 'calendar' | 'custom'>('none')
const era = ref('')
const year = ref('')
const month = ref('')
const day = ref('')
const text = ref('')

function syncFromProp(v: EventTime | null): void {
  if (v === null || v === undefined) { mode.value = 'none'; return }
  if (v.mode === 'calendar') {
    mode.value = 'calendar'
    era.value = v.era
    year.value = v.year
    month.value = v.month
    day.value = v.day
  } else {
    mode.value = 'custom'
    text.value = v.text
  }
}

watch(() => props.modelValue, syncFromProp, { immediate: true })

function push(): void {
  const next: EventTime | null =
    mode.value === 'none' ? null
      : mode.value === 'calendar'
        ? { mode: 'calendar', era: era.value, year: year.value, month: month.value, day: day.value }
        : { mode: 'custom', text: text.value }
  // 与父级当前值一致时不再 emit（避免回环）
  if (JSON.stringify(next) !== JSON.stringify(props.modelValue)) emit('update:modelValue', next)
}

watch([mode, era, year, month, day, text], push)
</script>

<style scoped>
.time-editor { display: flex; flex-direction: column; gap: 8px; }
.tm-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(88px, 1fr)); gap: 6px; }
.tm-hint { font-size: 12px; color: var(--text-3); }
</style>
