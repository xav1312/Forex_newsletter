const axios = require('axios');
const { JSDOM } = require('jsdom');

class InvestingLiveComAdapter {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.type = 'general_news';
    this.baseUrl = 'https://investinglive.com';
  }

  async fetchLatest() {
    try {
        console.log(`🔍 [Adapter: ${this.name}] Fetching URL...`);
        const url = `${this.baseUrl}/live-feed/`;
        
        const response = await axios.get(url, {
            headers: { 
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
            }
        });

        const dom = new JSDOM(response.data);
        const doc = dom.window.document;
        
        // Strategy: Look for links that look like full article slugs (usually contain date or long title)
        // Example: /forex/usdjpy-looks-poised...-20260203/
        const allLinks = Array.from(doc.querySelectorAll('a'));
        const articleLink = allLinks.find(a => {
            const href = a.href;
            const text = a.textContent.trim();
            
            // Must be in a relevant category
            const isCategory = href.includes('/forex/') || href.includes('/commodities/') || href.includes('/news/');
            
            // Must NOT be just the category link itself (e.g. /forex/)
            // We check if the slug part is long enough
            const slug = href.split('/').filter(Boolean).pop();
            const isSpecificArticle = slug && slug.length > 15; // "forex" is 5 chars. Slugs are long.

            return isCategory && isSpecificArticle && text.length > 20;
        });

        if (!articleLink) {
            throw new Error('Could not find latest article link on InvestingLive.com');
        }

        const title = articleLink.textContent.trim();
        let link = articleLink.href;
        if (link.startsWith('/')) {
            link = this.baseUrl + link;
        }

        console.log(`✅ [Adapter: ${this.name}] Found: "${title}"`);
        return {
            title,
            url: link
        };

    } catch (error) {
        console.error(`❌ [Adapter] Error: ${error.message}`);
        throw error;
    }
  }
}

module.exports = InvestingLiveComAdapter;
