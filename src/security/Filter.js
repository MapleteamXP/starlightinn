// ============================================================
// Starlight Engine — Content Filter
// ============================================================

const CHAT_FILTER = ['bad','stupid','idiot','damn','hell','crap','jerk','loser','hate','kill','die','suicide','racist','nazi','terrorist','sex','porn','drug','weed','cocaine'];

export class ContentFilter {
  filter(text, safeMode = false) {
    let filtered = text;
    CHAT_FILTER.forEach(w => {
      filtered = filtered.replace(new RegExp('\\b' + w + '\\b', 'gi'), '***');
    });
    if (safeMode) {
      // Additional strict filtering in safe mode
      filtered = filtered.replace(/[<>]/g, '');
    }
    return filtered;
  }

  isRateLimited(lastChatTime, limitMs = 1000) {
    return Date.now() - lastChatTime < limitMs;
  }
}
