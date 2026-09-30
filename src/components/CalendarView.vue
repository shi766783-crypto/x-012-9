<script setup>
import { computed, ref } from 'vue'
import { getWateringSchedule } from '../services/gardenRules'
import { buildMonthCells, monthOf, todayISO } from '../utils/date'

const props = defineProps({
  plants: {
    type: Array,
    required: true,
  },
  careRecords: {
    type: Array,
    required: true,
  },
  // 今日待浇水（含已过期），与首页“今日待浇水”同一份口径数据
  duePlants: {
    type: Array,
    required: true,
  },
})

const today = todayISO()
const cursor = ref(monthOf(today))
const selectedDate = ref(today)

const weekDays = ['一', '二', '三', '四', '五', '六', '日']

const monthLabel = computed(() => {
  const [year, month] = cursor.value.split('-')
  return `${year} 年 ${Number(month)} 月`
})

const cells = computed(() => buildMonthCells(cursor.value))

const plantNameMap = computed(() => new Map(props.plants.map((plant) => [plant.id, plant.name])))

const careByDate = computed(() => {
  const map = new Map()
  props.careRecords.forEach((record) => {
    if (!map.has(record.date)) map.set(record.date, [])
    map.get(record.date).push(record)
  })
  return map
})

// 覆盖整月格子（最多到下个月）的未来浇水排期
const scheduleByDate = computed(() => {
  const rangeEnd = cells.value[cells.value.length - 1].dateISO
  return getWateringSchedule(props.plants, rangeEnd, today)
})

const dueByDate = computed(() => {
  // 只有今天的格子需要展示待浇水/已过期，历史月份不做推测标记
  const names = props.duePlants.map((plant) => ({ id: plant.id, name: plant.name, status: plant.wateringStatus }))
  return names.length ? new Map([[today, names]]) : new Map()
})

const monthHasContent = computed(() =>
  cells.value.some(
    (cell) =>
      (careByDate.value.get(cell.dateISO)?.length || 0) > 0 ||
      (scheduleByDate.value.get(cell.dateISO)?.length || 0) > 0 ||
      (dueByDate.value.get(cell.dateISO)?.length || 0) > 0,
  ),
)

const selectedCare = computed(() => careByDate.value.get(selectedDate.value) || [])
const selectedSchedule = computed(() => scheduleByDate.value.get(selectedDate.value) || [])
const selectedDue = computed(() => dueByDate.value.get(selectedDate.value) || [])
const selectedIsFuture = computed(() => selectedDate.value > today)
const selectedIsPast = computed(() => selectedDate.value < today)

const selectedLabel = computed(() => {
  const [year, month, day] = selectedDate.value.split('-').map(Number)
  const weekdayIndex = (new Date(year, month - 1, day).getDay() + 6) % 7
  return `${month} 月 ${day} 日 · 周${weekDays[weekdayIndex]} · ${year}`
})

function shiftMonth(amount) {
  const [year, month] = cursor.value.split('-').map(Number)
  const date = new Date(year, month - 1 + amount, 1)
  cursor.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function backToToday() {
  cursor.value = monthOf(today)
  selectedDate.value = today
}

function selectCell(cell) {
  if (!cell.inMonth) {
    cursor.value = monthOf(cell.dateISO)
  }
  selectedDate.value = cell.dateISO
}

function plantName(id) {
  return plantNameMap.value.get(id) || '已移除的植物'
}
</script>

<template>
  <section class="panel calendar-panel">
    <div class="panel-heading calendar-heading">
      <h2>养护日历</h2>
      <div class="calendar-nav">
        <button type="button" @click="shiftMonth(-1)" aria-label="上个月">‹</button>
        <strong>{{ monthLabel }}</strong>
        <button type="button" @click="shiftMonth(1)" aria-label="下个月">›</button>
        <button class="calendar-today" type="button" :disabled="cursor === monthOf(today)" @click="backToToday">
          回到今天
        </button>
      </div>
    </div>

    <div class="calendar-legend">
      <span><i class="legend-dot care-water"></i>浇水</span>
      <span><i class="legend-dot care-fertilize"></i>施肥</span>
      <span><i class="legend-dot care-other"></i>其他养护</span>
      <span><i class="legend-dot schedule-dot"></i>预计待浇水</span>
      <span><i class="legend-dot due-dot"></i>今日待浇/逾期</span>
    </div>

    <div class="calendar-grid calendar-weekrow">
      <span v-for="day in weekDays" :key="day">{{ day }}</span>
    </div>

    <div class="calendar-grid calendar-cells">
      <button
        v-for="cell in cells"
        :key="cell.dateISO"
        type="button"
        :class="[
          'calendar-cell',
          {
            'is-muted': !cell.inMonth,
            'is-today': cell.dateISO === today,
            'is-selected': cell.dateISO === selectedDate,
          },
        ]"
        @click="selectCell(cell)"
      >
        <time class="calendar-date">{{ cell.day }}</time>
        <span class="calendar-chips">
          <template v-for="record in (careByDate.get(cell.dateISO) || []).slice(0, 2)" :key="record.id">
            <i :class="['cell-chip', `care-${record.type === '浇水' ? 'water' : record.type === '施肥' ? 'fertilize' : 'other'}`]">
              {{ plantName(record.plantId) }} · {{ record.type }}
            </i>
          </template>
          <i
            v-if="(careByDate.get(cell.dateISO)?.length || 0) > 2"
            class="cell-chip chip-more"
          >
            还有 {{ careByDate.get(cell.dateISO).length - 2 }} 条
          </i>
          <i
            v-for="item in dueByDate.get(cell.dateISO) || []"
            :key="`due-${item.id}`"
            class="cell-chip chip-due"
          >
            {{ item.name }} · {{ item.status }}
          </i>
          <i
            v-if="scheduleByDate.get(cell.dateISO)?.length"
            class="cell-chip chip-schedule"
          >
            💧 {{ scheduleByDate.get(cell.dateISO).map((item) => item.name).join('、') }}
          </i>
        </span>
      </button>
    </div>

    <p v-if="!monthHasContent" class="empty-state calendar-empty">本月暂无养护记录，也没有排期浇水安排。</p>

    <article class="calendar-detail">
      <div class="calendar-detail-heading">
        <h3>{{ selectedLabel }}</h3>
        <span v-if="selectedIsFuture">未来排期</span>
        <span v-else-if="selectedDate === today">今天</span>
        <span v-else-if="selectedIsPast">历史记录</span>
      </div>

      <p v-if="!selectedCare.length && !selectedSchedule.length && !selectedDue.length" class="simple-list">
        这一天没有养护记录与浇水安排。
      </p>

      <ul v-else class="calendar-detail-list">
        <li v-for="record in selectedCare" :key="record.id" class="detail-care">
          <i :class="['legend-dot', `care-${record.type === '浇水' ? 'water' : record.type === '施肥' ? 'fertilize' : 'other'}`]"></i>
          <div>
            <strong>{{ plantName(record.plantId) }} · {{ record.type }}</strong>
            <p>{{ record.amount || '未填写用量' }}<template v-if="record.note"> · {{ record.note }}</template></p>
          </div>
        </li>
        <li v-for="item in selectedDue" :key="`due-${item.id}`" class="detail-due">
          <i class="legend-dot due-dot"></i>
          <div>
            <strong>{{ item.name }} · {{ item.status }}</strong>
            <p>按浇水频率，今天需要浇水。</p>
          </div>
        </li>
        <li v-for="item in selectedSchedule" :key="`schedule-${item.id}`" class="detail-schedule">
          <i class="legend-dot schedule-dot"></i>
          <div>
            <strong>{{ item.name }} · 预计待浇水</strong>
            <p>依据每 {{ plants.find((plant) => plant.id === item.id)?.wateringFrequency || '?' }} 天的浇水频率推算。</p>
          </div>
        </li>
      </ul>
    </article>
  </section>
</template>
