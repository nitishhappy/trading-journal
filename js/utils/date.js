// India Standard Time is a fixed UTC+5:30 offset with no DST, so it's safe
// to treat as a constant timezone identifier everywhere below.
const IST_TIMEZONE = "Asia/Kolkata";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function getDateKey(date) {
  // Returns YYYY-MM-DD in UTC (standard Firestore serverTimestamp sorting)
  const d = new Date(date);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getLocalDateKey(date) {
  // Returns YYYY-MM-DD in IST (India Standard Time) — used for "today",
  // "yesterday", and streak logic, so these are always computed against
  // IST regardless of what timezone the device/browser itself is set to.
  // The "en-CA" locale formats dates as YYYY-MM-DD, so no manual parsing needed.
  const d = new Date(date);
  return d.toLocaleDateString("en-CA", { timeZone: IST_TIMEZONE });
}

export function todayKey() {
  return getLocalDateKey(new Date());
}

export function computeStreak(obs) {
  if (!obs || obs.length === 0) return 0;

  // Get all unique IST calendar dates of observations, sorted descending
  const dates = Array.from(
    new Set(
      obs.map((o) => {
        if (!o.createdAt) return null;
        const d = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        return getLocalDateKey(d);
      }).filter(Boolean)
    )
  ).sort((a, b) => b.localeCompare(a));

  if (dates.length === 0) return 0;

  const today = getLocalDateKey(new Date());
  const yesterdayKey = getLocalDateKey(new Date(Date.now() - ONE_DAY_MS));

  // If the user hasn't posted today or yesterday (in IST), the streak is broken (0)
  if (dates[0] !== today && dates[0] !== yesterdayKey) {
    return 0;
  }

  let streak = 1;
  // Anchor at UTC noon on the date string (well clear of any midnight
  // boundary in IST, which is UTC+5:30) so that stepping backwards by exact
  // 24-hour increments always lands on the correct IST calendar day,
  // regardless of the device's own timezone.
  let currentMs = new Date(dates[0] + "T12:00:00Z").getTime();

  for (let i = 1; i < dates.length; i++) {
    currentMs -= ONE_DAY_MS;
    const prevKey = getLocalDateKey(new Date(currentMs));

    if (dates[i] === prevKey) {
      streak++;
    } else {
      break; // Gap found, stop counting
    }
  }

  return streak;
}

export function formatDateHeader(dateStr) {
  if (!dateStr) return "";
  // Anchor at UTC noon so formatting reliably falls on the intended IST
  // calendar day, regardless of the device's own timezone.
  const d = new Date(dateStr + "T12:00:00Z");
  const today = getLocalDateKey(new Date());
  const yesterdayKey = getLocalDateKey(new Date(Date.now() - ONE_DAY_MS));

  if (dateStr === today) return "Today";
  if (dateStr === yesterdayKey) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: IST_TIMEZONE
  });
}

export function formatTime(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: IST_TIMEZONE
  });
}