const Parser = require('rss-parser');

class RSSAdapter {
  constructor(id, name, feedUrl, type = 'general_news', filterFn = null) {
    this.id = id;
    this.name = name;
    this.feedUrl = feedUrl;
    this.type = type;
    this.filterFn = filterFn;
    this.parser = new Parser({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
  }

  async fetchLatest() {
    try {
      console.log(`🔍 [Adapter: ${this.name}] Fetching RSS feed...`);
      const feed = await this.parser.parseURL(this.feedUrl);
      
      if (!feed.items || feed.items.length === 0) {
        throw new Error('RSS Feed is empty');
      }

      // Find first item matching the filter (if any)
      const latest = this.filterFn 
        ? feed.items.find(this.filterFn)
        : feed.items[0];

      if (!latest) {
         throw new Error('No articles matched the filter (e.g. "FX Daily")');
      }
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
