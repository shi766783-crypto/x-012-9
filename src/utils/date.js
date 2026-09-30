const DAY_MS = 24 * 60 * 60 * 1000

export function todayISO() {
  return toISODate(new Date())
}

export function toISODate(date) {
  const local = new Date(date)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(0, 10)
}

export function daysBetween(startISO, endISO = todayISO()) {
  if (!startISO) return 0
  const start = new Date(`${startISO}T00:00:00`)
  const end = new Date(`${endISO}T00:00:00`)
  return Math.floor((end - start) / DAY_MS)
}

export function monthOf(dateISO) {
  return dateISO?.slice(0, 7) || ''
}

export function addDays(dateISO, amount) {
  const date = new Date(`${dateISO}T00:00:00`)
  date.setDate(date.getDate() + amount)
  return toISODate(date)
}

// 生成包含目标月份、以周一为起点的 6 行（42 天）日历格子
export function buildMonthCells(monthISO) {
  const [year, month] = monthISO.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const offsetToMonday = (firstDay.getDay() + 6) % 7
  const gridStart = addDays(toISODate(firstDay), -offsetToMonday)

  return Array.from({ length: 42 }, (_, index) => {
    const dateISO = addDays(gridStart, index)
    return { dateISO, day: Number(dateISO.slice(8, 10)), inMonth: monthOf(dateISO) === monthISO }
  })
}

export function formatDate(dateISO) {
  if (!dateISO) return '未记录'
  return dateISO.replaceAll('-', '/')
}
