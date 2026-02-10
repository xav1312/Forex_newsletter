const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, '..', 'history.json');

class HistoryManager {
  constructor() {
    this.ensureFileExists();
  }

  ensureFileExists() {
    if (!fs.existsSync(HISTORY_FILE)) {
      fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2));
    }
  }

  load() {
    try {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.error('❌ Failed to load history:', e.message);
      return [];
    }
  }

  save(history) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  }

  addArticle(article, analysis, sourceId = null) {
    const history = this.load();
    
    // Avoid duplicates (by URL)
    if (history.find(h => h.url === article.url)) {
      return;
    }

    const entry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      url: article.url,
      title: analysis.title || article.title,
      tags: analysis.tags || [],
      keyTakeaway: analysis.keyTakeaway || '',
      source: sourceId || article.siteName,
      sourceName: article.siteName
    };

    // Keep only last 1000 articles
    history.unshift(entry);
    if (history.length > 1000) {
      history.pop();
    }

    this.save(history);
    console.log(`💾 Saved to history: "${entry.title}" [${entry.tags.join(', ')}]`);
  }

  search(query) {
    const history = this.load();
    const q = query.toLowerCase();

    return history.filter(item => {
      const inTitle = item.title.toLowerCase().includes(q);
      const inTags = item.tags.some(t => t.toLowerCase().includes(q));
      return inTitle || inTags;
    });
  }
}

module.exports = new HistoryManager();
