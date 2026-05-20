export function getParisNow() {
  const now = new Date()
  const date = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
  // en-GB + hour12:false gives HH:MM in 24h format
  const time = now.toLocaleTimeString('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return { date, time }
}
