<script setup>
import { computed, reactive } from 'vue'
import { buildWateringSchedule } from '../services/gardenRules'
import { buildMonthGrid, formatDate, todayISO } from '../utils/date'

const props = defineProps({
  plants: {
    type: Array,
    required: true,
  },
  careRecords: {
    type: Array,
    required: true,
  },
  growthRecords: {
    type: Array,
    required: true,
  },
  pestRecords: {
    type: Array,
    required: true,
  },
})

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const MAX_CHIPS = 3

const today = todayISO()
const cursor = reactive({
  year: Number(today.slice(0, 4)),
  month: Number(today.slice(5, 7)) - 1,
})
const selectedDate = reactive({ value: today })

const monthTitle = computed(() => `${cursor.year} 年 ${cursor.month + 1} 月`)
const isCurrentMonth = computed(() => `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}` === today.slice(0, 7))

const grid = computed(() => buildMonthGrid(cursor.year, cursor.month))

const plantMap = computed(() => new Map(props.plants.map((plant) => [plant.id, plant])))

// 按日期聚合历史操作（浇水、施肥等养护 + 生长指标 + 病虫害）
const recordsByDate = computed(() => {
  const map = new Map()
  const push = (entry) => {
    const list = map.get(entry.date)
    if (list) list.push(entry)
    else map.set(entry.date, [entry])
  }

  props.careRecords.forEach((record) => {
    push({
      key: record.id,
      date: record.date,
      label: record.type,
      kind: 'care',
      chipClass: chipClassOf(record.type),
      plantName: plantMap.value.get(record.plantId)?.name || '已移除植物',
      detail: record.note || record.amount || '已记录养护操作',
    })
  })
  props.growthRecords.forEach((record) => {
    push({
      key: record.id,
      date: record.date,
      label: '生长',
      kind: 'growth',
      chipClass: 'chip-growth',
      plantName: plantMap.value.get(record.plantId)?.name || '已移除植物',
      detail: `高度 ${record.height || 0} cm，叶片 ${record.leafCount || 0} 片，${record.bloomState || '未开花'}`,
    })
  })
  props.pestRecords.forEach((record) => {
    push({
      key: record.id,
      date: record.date,
      label: '病虫害',
      kind: 'pest',
      chipClass: 'chip-pest',
      plantName: plantMap.value.get(record.plantId)?.name || '已移除植物',
      detail: `${record.symptom}；${record.recovery || '恢复情况待观察'}`,
    })
  })

  map.forEach((list) => list.sort((a, b) => a.label.localeCompare(b.label, 'zh') || a.plantName.localeCompare(b.plantName, 'zh')))
  return map
})

// 按日期聚合未来预计浇水（网格覆盖到的日期都参与排程，与待浇水口径一致）
const scheduleByDate = computed(() => {
  const fromISO = grid.value[0].date
  const toISO = grid.value[grid.value.length - 1].date
  const map = new Map()
  buildWateringSchedule(props.plants, fromISO, toISO, today).forEach((item) => {
    // 仅标出今天及未来的预计浇水日，过去格子只保留真实操作记录
    if (item.date < today) return
    const list = map.get(item.date)
    if (list) list.push(item)
    else map.set(item.date, [item])
  })
  map.forEach((list) => list.sort((a, b) => a.plantName.localeCompare(b.plantName, 'zh')))
  return map
})

// 本月是否存在任何操作记录（无记录月份提示用）
const monthHasRecords = computed(() =>
  grid.value.some((cell) => cell.inMonth && recordsByDate.value.has(cell.date)),
)
const monthScheduledCount = computed(() =>
  grid.value.reduce(
    (sum, cell) => (cell.inMonth ? sum + (scheduleByDate.value.get(cell.date)?.length || 0) : sum),
    0,
  ),
)

const monthEmptyText = computed(() => {
  const monthKey = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`
  const currentMonthKey = today.slice(0, 7)
  if (monthKey < currentMonthKey) return '这个月没有任何浇水、施肥等养护记录。'
  if (monthKey > currentMonthKey) return '这个月还没有养护记录，蓝色水滴是按浇水频率排好的预计待浇水日。'
  return '本月还没有浇水、施肥等养护记录；蓝色水滴是系统按浇水频率排好的未来待浇水日。'
})

function chipClassOf(type) {
  const map = {
    浇水: 'chip-water',
    施肥: 'chip-fertilize',
    修剪: 'chip-prune',
    换盆: 'chip-repot',
    喷药: 'chip-spray',
  }
  return map[type] || 'chip-care'
}

function entriesFor(date) {
  const records = recordsByDate.value.get(date) || []
  const schedules = (scheduleByDate.value.get(date) || []).map((item) => ({
    key: `schedule-${item.plantId}`,
    date: item.date,
    label: '预计浇水',
    kind: 'schedule',
    chipClass: item.status === '已过期' ? 'chip-due-danger' : 'chip-due',
    plantName: item.plantName,
    detail: `每 ${item.frequency} 天浇水 · ${item.status}`,
  }))
  return [...schedules, ...records]
}

function chipsFor(date) {
  const entries = entriesFor(date)
  if (entries.length <= MAX_CHIPS) return entries
  return [
    ...entries.slice(0, MAX_CHIPS),
    {
      key: 'more',
      label: `+${entries.length - MAX_CHIPS}`,
      chipClass: 'chip-more',
      plantName: '',
      detail: '',
    },
  ]
}

const selectedEntries = computed(() => entriesFor(selectedDate.value))
const selectedSchedules = computed(() => selectedEntries.value.filter((entry) => entry.kind === 'schedule'))
const selectedRecords = computed(() => selectedEntries.value.filter((entry) => entry.kind !== 'schedule'))

const selectedDayLabel = computed(() => {
  const diff = Number((new Date(`${selectedDate.value}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000)
  if (diff === 0) return '今天'
  if (diff === -1) return '昨天'
  if (diff === 1) return '明天'
  return diff < 0 ? `${-diff} 天前` : `${diff} 天后`
})

function shiftMonth(delta) {
  const next = new Date(cursor.year, cursor.month + delta, 1)
  cursor.year = next.getFullYear()
  cursor.month = next.getMonth()
}

function backToToday() {
  cursor.year = Number(today.slice(0, 4))
  cursor.month = Number(today.slice(5, 7)) - 1
  selectedDate.value = today
}

function selectCell(cell) {
  if (!cell.inMonth) {
    const next = new Date(`${cell.date}T00:00:00`)
    cursor.year = next.getFullYear()
    cursor.month = next.getMonth()
  }
  selectedDate.value = cell.date
}
</script>

<template>
  <section class="panel calendar-panel">
    <div class="panel-heading calendar-heading">
      <div>
        <h2>养护日历</h2>
        <p class="calendar-subtitle">按日期回看浇水、施肥等操作，蓝色水滴为按浇水频率推算的预计待浇水日。</p>
      </div>
      <div class="calendar-nav">
        <button class="nav-button" type="button" @click="shiftMonth(-1)">‹ 上月</button>
        <strong class="calendar-title">{{ monthTitle }}</strong>
        <button class="nav-button" type="button" @click="shiftMonth(1)">下月 ›</button>
        <button class="nav-button nav-today" :disabled="isCurrentMonth && selectedDate === today" type="button" @click="backToToday">
          回到今天
        </button>
      </div>
    </div>

    <div class="calendar-weekdays">
      <span v-for="label in WEEK_LABELS" :key="label">{{ label }}</span>
    </div>

    <div class="calendar-grid">
      <button
        v-for="cell in grid"
        :key="cell.date"
        type="button"
        :class="[
          'calendar-cell',
          {
            'is-outside': !cell.inMonth,
            'is-today': cell.date === today,
            'is-selected': cell.date === selectedDate,
            'is-weekend': cell.weekday === 0 || cell.weekday === 6,
          },
        ]"
        @click="selectCell(cell)"
      >
        <time class="cell-date">{{ Number(cell.date.slice(8, 10)) }}</time>
        <span v-if="cell.date === today" class="today-ring">今</span>
        <div class="cell-chips">
          <span
            v-for="chip in chipsFor(cell.date)"
            :key="chip.key"
            :class="['cell-chip', chip.chipClass]"
            :title="chip.plantName ? `${chip.label} · ${chip.plantName}` : chip.label"
          >
            <em>{{ chip.label }}</em>
            <i v-if="chip.plantName">{{ chip.plantName }}</i>
          </span>
        </div>
      </button>
    </div>

    <div v-if="!monthHasRecords" class="empty-state calendar-empty">
      {{ monthEmptyText }}
    </div>

    <div class="calendar-bottom">
      <div class="calendar-legend-block">
        <h3>图例</h3>
        <ul class="calendar-legend">
          <li><span class="legend-dot chip-water"></span>浇水</li>
          <li><span class="legend-dot chip-fertilize"></span>施肥</li>
          <li><span class="legend-dot chip-prune"></span>修剪 / 换盆 / 喷药</li>
          <li><span class="legend-dot chip-growth"></span>生长指标</li>
          <li><span class="legend-dot chip-pest"></span>病虫害</li>
          <li><span class="legend-dot chip-due"></span>预计待浇水</li>
          <li><span class="legend-dot chip-due-danger"></span>今日已逾期</li>
        </ul>
        <p class="calendar-summary">本月预计待浇水 {{ monthScheduledCount }} 株次。</p>
      </div>

      <article class="calendar-detail">
        <div class="calendar-detail-heading">
          <h3>{{ formatDate(selectedDate) }} · {{ selectedDayLabel }}</h3>
          <span>{{ selectedEntries.length }} 项安排</span>
        </div>

        <div v-if="!selectedEntries.length" class="empty-state">这一天没有历史操作，也没有预计浇水安排。</div>

        <div v-else class="cal-detail-list">
          <div v-for="item in selectedSchedules" :key="item.key" class="cal-detail-item">
            <span :class="['status-pill', item.chipClass === 'chip-due-danger' ? 'danger' : 'warning']">{{ item.status }}</span>
            <div>
              <strong>{{ item.label }} · {{ item.plantName }}</strong>
              <p>{{ item.detail }}</p>
            </div>
          </div>
          <div v-for="item in selectedRecords" :key="item.key" class="cal-detail-item">
            <span :class="['record-tag', item.chipClass]">{{ item.label }}</span>
            <div>
              <strong>{{ item.plantName }}</strong>
              <p>{{ item.detail }}</p>
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
