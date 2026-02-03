const INGAdapter = require('./adapters/ing');
const InvestingAdapter = require('./adapters/investing');
const RSSAdapter = require('./adapters/rss');
const InvestingLiveComAdapter = require('./adapters/investing-live-com');

class SourceManager {
  constructor() {
    this.sources = new Map();
    this.registerDefaults();
  }

  registerDefaults() {
    // ING Think FX
    const ing = new INGAdapter('ing', 'ING Think FX');
    this.registerSource(ing);

    // Investing.com Live (Blocked)
    const investing = new InvestingAdapter('investing', 'Investing Live (Blocked)');
    this.registerSource(investing);

    // InvestingLive.com (New)
    const investingLive = new InvestingLiveComAdapter('investing_live', 'InvestingLive.com');
    this.registerSource(investingLive);
    
    // Investing.com RSS
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
