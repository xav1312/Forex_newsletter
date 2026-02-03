const RSSAdapter = require('./adapters/rss');
const INGAdapter = require('./adapters/ing');

class SourceManager {
  constructor() {
    this.sources = new Map();
    this.registerDefaults();
  }

  registerDefaults() {
    // 1. ING Think FX (Scraper restored)
    const ing = new INGAdapter('ing', 'ING Think FX');
    this.registerSource(ing);

    // 2. InvestingLive.com (via RSS)
    const investingLive = new RSSAdapter(
      'investing_live',
      'InvestingLive.com',
      'https://investinglive.com/feed/forex/', 
      'general_news'
    );
    this.registerSource(investingLive);
    
    // 3. Investing.com RSS (Fallback/Main)
    const investingRss = new RSSAdapter(
      'investing_rss', 
      'Investing FX RSS', 
      'https://fr.investing.com/rss/news_1.rss',
      'general_news'
    );
    this.registerSource(investingRss);
  }

  registerSource(source) {
    if (!source.id) throw new Error('Source must have an id');
    this.sources.set(source.id, source);
    console.log(`🔌 Registered source: ${source.id}`);
  }

  getSource(sourceId) {
    const source = this.sources.get(sourceId);
    if (!source) {
      throw new Error(`Source adapter '${sourceId}' not found. Available: ${Array.from(this.sources.keys()).join(', ')}`);
    }
    return source;
  }

  listSources() {
    return Array.from(this.sources.values()).map(s => ({
      id: s.id,
      name: s.name,
      type: s.type || 'unknown'
    }));
  }
}

module.exports = new SourceManager();
