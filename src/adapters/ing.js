const axios = require('axios');
const { JSDOM } = require('jsdom');

/**
 * ADAPTER: ING Think FX
 * Source ID: 'ing'
 */

const CONFIG = {
  url: 'https://think.ing.com/market/fx/',
  baseUrl: 'https://think.ing.com'
};

/**
 * Fetch the latest "FX Daily" article
 * @returns {Promise<{url: string, title: string, description: string}>}
 */
async function fetchLatest() {
  try {
    console.log(`🔍 [Adapter: ING] Fetching latest article...`);
    
    // 1. Fetch the main FX page
    const response = await axios.get(CONFIG.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
    });

    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    // 2. Scan for links
    // Strategy: Look for article links with "FX Daily" in URL or Title
    const allLinks = document.querySelectorAll('a[href*="/articles/"], a[href*="/snaps/"]');
    
    let latestArticle = null;
    
    for (const link of allLinks) {
      const href = link.getAttribute('href');
      const text = link.textContent?.trim();
      
      if (!href || !text || text.length < 10) continue;
      
      const title = extractTitle(link);
      const lowHref = href.toLowerCase();
      const lowTitle = title.toLowerCase();

      // STRICT FILTER: Only FX Daily articles
      if (lowHref.includes('fx-daily') || lowTitle.includes('fx daily')) {
        latestArticle = {
          url: href.startsWith('http') ? href : CONFIG.baseUrl + href,
          title: title,
          description: extractDescription(link),
          sourceId: 'ing', // Identifying metadata
          sourceName: 'ING Think FX'
        };
        break; // Take the first one (most recent)
      }
    }

    if (!latestArticle) {
      throw new Error('No "FX Daily" articles found on ING Think FX page');
    }

    console.log(`✅ [Adapter: ING] Found: "${latestArticle.title}"`);
    return latestArticle;

  } catch (error) {
    console.error(`❌ [Adapter: ING] Error:`, error.message);
    throw error;
  }
}

// --- Helper Functions ---

function extractTitle(linkElement) {
  const heading = linkElement.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) return heading.textContent.trim();
  
  let text = linkElement.textContent.trim();
  text = text.replace(/\s+/g, ' ').trim();
  const parts = text.split(/\n|\r/);
  return parts[0]?.trim() || text.substring(0, 100);
}

function extractDescription(linkElement) {
  const text = linkElement.textContent.trim().replace(/\s+/g, ' ');
  const parts = text.split(/(?<=[.!?])\s+/);
  if (parts.length > 1) {
    return parts.slice(1).join(' ').substring(0, 200);
  }
  return '';
}

module.exports = {
  id: 'ing',
  name: 'ING Think FX',
  type: 'fx_daily', // Signals that this is a detailed currency breakdown
  fetchLatest
};
