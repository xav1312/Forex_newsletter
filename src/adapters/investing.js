const axios = require('axios');
const { JSDOM } = require('jsdom');

/**
 * ADAPTER: InvestingLive
 * Source ID: 'investing'
 */

const CONFIG = {
  url: 'https://investinglive.com/live-feed/',
  baseUrl: 'https://investinglive.com'
};

/**
 * Fetch the latest article from InvestingLive Feed
 * @returns {Promise<{url: string, title: string, description: string}>}
 */
async function fetchLatest() {
  try {
    console.log(`🔍 [Adapter: InvestingLive] Fetching latest article...`);
    
    // 1. Fetch the live feed page
    const response = await axios.get(CONFIG.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      timeout: 15000,
    });

    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    // 2. Find the latest article link
    // Selector based on analysis: a.article-slot-header__link
    // It contains .article-slot-header__title
    const latestLink = document.querySelector('a.article-slot-header__link');
    
    if (!latestLink) {
      throw new Error('No article links found matching strict selector (a.article-slot-header__link)');
    }

    const titleElement = latestLink.querySelector('.article-slot-header__title');
    const title = titleElement ? titleElement.textContent.trim() : 'No Title Found';
    const href = latestLink.getAttribute('href');
    
    if (!href) {
        throw new Error('Latest article link has no href');
    }

    const fullUrl = href.startsWith('http') ? href : CONFIG.baseUrl + href;

    // 3. Extract description (often in a sibling div or not present in feed, we'll try to find nearby text)
    // In this specific DOM, the description is not always immediate sibling in the anchor. 
    // We'll leave it empty or try to fetch it from article page later (scraper handles that).
    const description = ''; 

    const latestArticle = {
      url: fullUrl,
      title: title,
      description: description,
      sourceId: 'investing',
      sourceName: 'InvestingLive'
    };

    console.log(`✅ [Adapter: InvestingLive] Found: "${latestArticle.title}"`);
    console.log(`   URL: ${latestArticle.url}`);
    
    return latestArticle;

  } catch (error) {
    console.error(`❌ [Adapter: InvestingLive] Error:`, error.message);
    throw error;
  }
}

module.exports = {
  id: 'investing',
  name: 'InvestingLive Feed',
  type: 'general_news', // Signals that this is general economic news
  fetchLatest
};
