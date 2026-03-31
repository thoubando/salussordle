export function getDailyDateET(): string {
  // Get current date/time
  const now = new Date();
  
  // Convert to Eastern Time string (e.g. "4/15/2024, 12:00:00 AM")
  const etString = now.toLocaleString("en-US", { timeZone: "America/New_York", hour12: false });
  const etDate = new Date(etString);

  // The rollover happens at 00:01 ET. So at exactly 00:00 (midnight to 00:00:59), it's still considered the previous day's context for our cutoff rules.
  // We'll calculate the minutes elapsed in the current ET day.
  const hours = etDate.getHours();
  const minutes = etDate.getMinutes();
  
  // Before 00:01 ET (meaning hours === 0 and minutes === 0), use yesterday's date
  if (hours === 0 && minutes === 0) {
    etDate.setDate(etDate.getDate() - 1);
  }

  // Format as YYYY-MM-DD
  const y = etDate.getFullYear();
  const m = String(etDate.getMonth() + 1).padStart(2, '0');
  const d = String(etDate.getDate()).padStart(2, '0');
  
  return `${y}-${m}-${d}`;
}
