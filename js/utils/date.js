export function getDateKey(date) {
  // Returns YYYY-MM-DD in UTC (standard Firestore serverTimestamp sorting)
  const d = new Date(date);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getLocalDateKey(date) {
  // Returns YYYY-MM-DD in user's local timezone (for stats/streak logic)
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function todayKey() {
  return getLocalDateKey(new Date());
}


export function computeStreak(obs) {
  if (!obs || obs.length === 0) return 0;
  
  // Get all unique local dates of observations, sorted descending
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
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getLocalDateKey(yesterday);

  // If the user hasn't posted today or yesterday, the streak is broken (0)
  if (dates[0] !== today && dates[0] !== yesterdayKey) {
    return 0;
  }

  let streak = 1;
  let current = new Date(dates[0] + "T12:00:00");

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(current);
    prev.setDate(prev.getDate() - 1);
    const prevKey = getLocalDateKey(prev);

    if (dates[i] === prevKey) {
      streak++;
      current = prev;
    } else {
      break; // Gap found, stop counting
    }
  }

  return streak;
}

export function formatDateHeader(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00"); // avoid local-TZ shifting
  const today = getLocalDateKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getLocalDateKey(yesterday);

  if (dateStr === today) return "Today";
  if (dateStr === yesterdayKey) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function formatTime(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}