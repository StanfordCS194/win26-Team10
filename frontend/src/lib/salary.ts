/**
 * Converts salary_display from create form format (e.g. "$50,000 yearly")
 * to job board display format (e.g. "$50,000 per year").
 */
export function formatSalaryForDisplay(salary: string): string {
  if (!salary?.trim()) return salary
  const m = salary.trim().match(/^(\$[\d,]+(?:\.[\d]+)?)\s+(hourly|weekly|monthly|yearly)$/i)
  if (!m) return salary
  const [, amount, period] = m
  const perMap: Record<string, string> = {
    hourly: 'per hour',
    weekly: 'per week',
    monthly: 'per month',
    yearly: 'per year',
  }
  return `${amount} ${perMap[period.toLowerCase()] ?? period}`
}
