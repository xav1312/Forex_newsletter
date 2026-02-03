const axios = require('axios');
const { JSDOM } = require('jsdom');

class INGAdapter {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.type = 'fx_daily';
    this.url = 'https://think.ing.com/market/fx/';
    this.baseUrl = 'https://think.ing.com';
  }

  async fetchLatest() {
    try {
      console.log(`🔍 [Adapter: ${this.name}] Fetching latest article...`);
      
      const response = await axios.get(this.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 15000,
      });

      const dom = new JSDOM(response.data);
      const document = dom.window.document;

      const allLinks = document.querySelectorAll('a[href*="/articles/"], a[href*="/snaps/"]');
      let latestArticle = null;
      
      for (const link of allLinks) {
        const href = link.getAttribute('href');
        const text = link.textContent?.trim();
        
        if (!href || !text || text.length < 10) continue;
        
        const title = this.extractTitle(link);
        const lowHref = href.toLowerCase();
        const lowTitle = title.toLowerCase();

        if (lowHref.includes('fx-daily') || lowTitle.includes('fx daily')) {
          latestArticle = {
            url: href.startsWith('http') ? href : this.baseUrl + href,
            title: title,
            description: this.extractDescription(link),
            publishedTime: new Date().toISOString() // Approximate
          };
          break;
        }
      }

      if (!latestArticle) {
        throw new Error('No "FX Daily" articles found on ING Think FX page');
      }

      console.log(`✅ [Adapter: ${this.name}] Found: "${latestArticle.title}"`);
      return latestArticle;

    } catch (error) {
      console.error(`❌ [Adapter: ${this.name}] Error:`, error.message);
      throw error;
    }
  }

  extractTitle(linkElement) {
    const heading = linkElement.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) return heading.textContent.trim();
    
    let text = linkElement.textContent.trim();
    text = text.replace(/\s+/g, ' ').trim();
    const parts = text.split(/\n|\r/);
    return parts[0]?.trim() || text.substring(0, 100);
  }

  extractDescription(linkElement) {
    const text = linkElement.textContent.trim().replace(/\s+/g, ' ');
    const parts = text.split(/(?<=[.!?])\s+/);
    if (parts.length > 1) {
      return parts.slice(1).join(' ').substring(0, 200);
    }
    return '';
  }
}

module.exports = INGAdapter;
