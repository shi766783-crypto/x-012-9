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

export function addDaysISO(dateISO, days) {
  const date = new Date(`${dateISO}T00:00:00`)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

// 以周一为每周第一天，返回包含目标月份的 6 × 7 共 42 个日期格子
export function buildMonthGrid(year, monthZeroBased) {
  const firstDate = toISODate(new Date(year, monthZeroBased, 1))
  const first = new Date(`${firstDate}T00:00:00`)
  const offsetToMonday = (first.getDay() + 6) % 7
  const gridStart = addDaysISO(firstDate, -offsetToMonday)

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDaysISO(gridStart, index)
    const cell = new Date(`${date}T00:00:00`)
    return {
      date,
      weekday: cell.getDay(),
      inMonth: Number(date.slice(5, 7)) === monthZeroBased + 1,
    }
  })
}

export function formatDate(dateISO) {
  if (!dateISO) return '未记录'
  return dateISO.replaceAll('-', '/')
}
