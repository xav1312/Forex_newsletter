const axios = require('axios');
const { JSDOM } = require('jsdom');

/**
 * ING Think FX page scraper
 * Fetches the latest article from the ING Think FX section
 */

const ING_THINK_FX_URL = 'https://think.ing.com/market/fx/';
const ING_BASE_URL = 'https://think.ing.com';

/**
 * Get the latest article URL from ING Think FX page
 * @returns {Promise<{url: string, title: string, description: string}>}
 */
async function getLatestArticle() {
  try {
    console.log(`🔍 Fetching latest article from ING Think FX...`);
    
    const response = await axios.get(ING_THINK_FX_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
    });

    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    // Strategy 1: Look for article links with FX Daily pattern (most recent daily analysis)
    const allLinks = document.querySelectorAll('a[href*="/articles/"], a[href*="/snaps/"]');
    
    let latestArticle = null;
    
    for (const link of allLinks) {
      const href = link.getAttribute('href');
      const text = link.textContent?.trim();
      
      // Skip empty links or navigation links
      if (!href || !text || text.length < 10) continue;
      
      // Prioritize FX Daily articles (they are the main daily analysis)
      if (href.includes('fx-daily')) {
        latestArticle = {
          url: href.startsWith('http') ? href : ING_BASE_URL + href,
          title: extractTitle(link),
          description: extractDescription(link),
        };
        break; // FX Daily is the priority
      }
      
      // Otherwise take the first valid article
      if (!latestArticle) {
        latestArticle = {
          url: href.startsWith('http') ? href : ING_BASE_URL + href,
          title: extractTitle(link),
          description: extractDescription(link),
        };
      }
    }

    if (!latestArticle) {
      throw new Error('No articles found on ING Think FX page');
    }

    console.log(`✅ Found latest article: "${latestArticle.title}"`);
    console.log(`   URL: ${latestArticle.url}`);
    
    return latestArticle;

  } catch (error) {
    console.error(`❌ Error fetching ING Think FX:`, error.message);
    throw error;
  }
}

/**
 * Extract clean title from link element
 */
function extractTitle(linkElement) {
  // Look for heading inside the link
  const heading = linkElement.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) {
    return heading.textContent.trim();
  }
  
  // Clean up the link text
  let text = linkElement.textContent.trim();
  // Remove excess whitespace and newlines
  text = text.replace(/\s+/g, ' ').trim();
  // Take first meaningful sentence
  const parts = text.split(/\n|\r/);
  return parts[0]?.trim() || text.substring(0, 100);
}

/**
 * Extract description from link or parent element
 */
function extractDescription(linkElement) {
  // Look for description text after title
  const text = linkElement.textContent.trim().replace(/\s+/g, ' ');
  const parts = text.split(/(?<=[.!?])\s+/);
  if (parts.length > 1) {
    return parts.slice(1).join(' ').substring(0, 200);
  }
  return '';
}

/**
 * Get multiple recent articles from ING Think FX
 * @param {number} count - Number of articles to fetch (default: 5)
 * @returns {Promise<Array<{url: string, title: string, description: string}>>}
 */
async function getRecentArticles(count = 5) {
  try {
    console.log(`🔍 Fetching ${count} recent articles from ING Think FX...`);
    
    const response = await axios.get(ING_THINK_FX_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
    });

    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    const allLinks = document.querySelectorAll('a[href*="/articles/"], a[href*="/snaps/"]');
    const articles = [];
    const seenUrls = new Set();

    for (const link of allLinks) {
      if (articles.length >= count) break;
      
      const href = link.getAttribute('href');
      const fullUrl = href?.startsWith('http') ? href : ING_BASE_URL + href;
      
      // Skip duplicates
      if (!href || seenUrls.has(fullUrl)) continue;
      seenUrls.add(fullUrl);
      
      const title = extractTitle(link);
      if (!title || title.length < 10) continue;
      
      articles.push({
        url: fullUrl,
        title: title,
        description: extractDescription(link),
      });
    }

    console.log(`✅ Found ${articles.length} articles`);
    return articles;

  } catch (error) {
    console.error(`❌ Error fetching articles:`, error.message);
    throw error;
  }
}

module.exports = {
  getLatestArticle,
  getRecentArticles,
  ING_THINK_FX_URL,
};
