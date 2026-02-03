const axios = require('axios');
const { JSDOM } = require('jsdom');

class InvestingAdapter {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.type = 'general_news';
    this.url = 'https://fr.investing.com/news/forex-news'; // Original URL
  }

  async fetchLatest() {
    try {
        console.log(`🔍 [Adapter: ${this.name}] Fetching URL...`);
        const response = await axios.get(this.url, {
            headers: { 
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8"
            }
        });
        const dom = new JSDOM(response.data);
        const doc = dom.window.document;
        
        const articles = doc.querySelectorAll('article.js-article-item');
        if (!articles || articles.length === 0) {
            throw new Error('No articles found (Selectors might have changed or Bot Blocked)');
        }

        const latest = articles[0];
        const titleLink = latest.querySelector('a.title');
        
        if (!titleLink) {
             throw new Error('Title link not found in article');
        }

        console.log(`✅ [Adapter: ${this.name}] Found: "${titleLink.textContent.trim()}"`);

        return {
            title: titleLink.textContent.trim(),
            url: 'https://fr.investing.com' + titleLink.href,
            publishedTime: new Date().toISOString()
        };

    } catch (error) {
        console.error(`❌ [Adapter] Error: ${error.message}`);
        throw error;
    }
  }
}

module.exports = InvestingAdapter;
