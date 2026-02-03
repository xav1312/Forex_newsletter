const Parser = require('rss-parser');

class RSSAdapter {
  constructor(id, name, feedUrl, type = 'general_news') {
    this.id = id;
    this.name = name;
    this.feedUrl = feedUrl;
    this.type = type;
    this.parser = new Parser();
  }

  async fetchLatest() {
    try {
      console.log(`🔍 [Adapter: ${this.name}] Fetching RSS feed...`);
      const feed = await this.parser.parseURL(this.feedUrl);
      
      if (!feed.items || feed.items.length === 0) {
        throw new Error('RSS Feed is empty');
      }

      const latest = feed.items[0];
      console.log(`✅ [Adapter: ${this.name}] Found: "${latest.title}"`);
      console.log(`   Detailed keys: ${Object.keys(latest).join(', ')}`);

      return {
        title: latest.title,
        url: latest.link,
        publishedTime: latest.pubDate ? new Date(latest.pubDate).toISOString() : null,
        description: latest.contentSnippet || latest.content || latest.summary || 'No description available'
      };
    } catch (error) {
      console.error(`❌ [Adapter: ${this.name}] Error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = RSSAdapter;
