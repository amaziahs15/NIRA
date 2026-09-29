/**
 * Safe instant redirect to weather.com for emergency departure.
 * Clears sessionStorage and locally stored drafts or chat text before redirecting
 * via window.location.replace so the browser Back button cannot return to NIRA.
 */
export function executeQuickExit() {
  try {
    sessionStorage.clear();
  } catch {
    // Ignore storage clearing exceptions
  }

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith("nira_safety_plan_") ||
          key.includes("chat") ||
          key.includes("draft") ||
          key.includes("message") ||
          key.includes("checkin"))
      ) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage clearing exceptions
  }

  window.location.replace("https://weather.com");
}
