const axios = require("axios");
const { JSDOM } = require("jsdom");
const { Readability } = require("@mozilla/readability");

/**
 * Scrape an article from a given URL and extract the main content
 * @param {string} url - The URL of the article to scrape
 * @returns {Promise<{title: string, content: string, excerpt: string, byline: string}>}
 */
async function scrapeArticle(url) {
  try {
    console.log(`📰 Fetching article from: ${url}`);

    // Fetch the HTML content
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      timeout: 15000,
    });

    // Parse with JSDOM
    const dom = new JSDOM(response.data, { url });

    // Extract readable content with Readability
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      throw new Error("Could not parse article content");
    }

    console.log(`✅ Successfully extracted: "${article.title}"`);

    return {
      title: article.title || "Sans titre",
      content: article.textContent || "",
      excerpt: article.excerpt || "",
      byline: article.byline || "",
      siteName: article.siteName || new URL(url).hostname,
      url: url,
    };
  } catch (error) {
    console.error(`❌ Error scraping article:`, error.message);
    throw error;
  }
}

module.exports = { scrapeArticle };
