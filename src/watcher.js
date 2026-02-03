const fs = require('fs');
const path = require('path');
const sourceManager = require('./source-manager');
const userManager = require('./users');
const history = require('./history');
const { scrapeArticle } = require('./scraper');
const { summarizeWithGroq, simpleSummary } = require('./summarizer');
const { sendNewsletter, previewNewsletter } = require('./emailer');
const { getEventsForCurrencies } = require('./economics');

// State file to track last processed article per source
const STATE_FILE = path.join(__dirname, '..', '.watcher-state.json');

/**
 * Load the last processed article state
 * @returns {{lastArticleUrl: string, lastCheck: string} | null}
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Warning: Could not load state file:', error.message);
  }
  return null;
}

/**
 * Save the state for a specific source
 * @param {string} sourceId
 * @param {string} articleUrl
 */
function saveState(sourceId, articleUrl) {
  const state = loadState() || {};
  state[sourceId] = {
    lastArticleUrl: articleUrl,
    lastCheck: new Date().toISOString(),
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Process and send newsletter for an article
 * @param {object} source - Source object
 * @param {object} articleData - Article object (url, title, content?, description?)
 * @param {string} recipientEmail - Admin Email to send to
 */
async function processAndSend(source, articleData, recipientEmail) {
  console.log(`\n📥 Processing article from ${source.name}...`);
  
  let article;

  // 1. Decide: Scrape or Use Existing Data?
  // If we have full content (unlikely from RSS) or if it's an RSS Item with description
  // AND we know scraping is blocked (e.g. Investing), we use the description as content.
  if (source.id.includes('rss') || source.type === 'general_news') {
      console.log('   ℹ️  Using RSS description as content (skipping scrape to avoid 403)...');
      article = {
          ...articleData,
          content: articleData.description || articleData.content || 'No content available.',
          siteName: source.name
      };
      console.log(`   Title: ${article.title}`);
  } else {
      // For ING (Scraper) or others, we want the full scraped data
      console.log(`   🌍 Scraping full page: ${articleData.url}`);
      article = await scrapeArticle(articleData.url);
      console.log(`   Title: ${article.title}`);
  }

  console.log(`\n🤖 Generating Summary...`);
  let summary;

  // Use AI
  if (process.env.GROQ_API_KEY) {
      try {
          summary = await summarizeWithGroq(article, { sourceType: source.type });
      } catch (e) {
          console.error('AI Failed', e);
          summary = simpleSummary(article);
      }
  } else {
      summary = simpleSummary(article);
  }

  // Add Calendar (Simplified logic here, or reuse index.js logic)
  try {
      if (summary.currencies) {
          const currencies = Object.keys(summary.currencies);
          if (currencies.length > 0) {
             const events = await getEventsForCurrencies(currencies, article.publishedTime);
             for(const [c, ev] of Object.entries(events)) {
                 if(summary.currencies[c]) summary.currencies[c].events = ev;
             }
          }
      }
  } catch (e) { console.error('Calendar error', e.message); }

  // Save Preview
  const outputDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, `newsletter_${source.id}_${Date.now()}.html`), previewNewsletter(article, summary));

  // --- SMART DISPATCH ---
  console.log(`\n🚀 Dispatching Newsletter...`);
  const tags = summary.tags || [];
  
  // 1. Get Recipients from UserManager
  const recipients = userManager.getRecipients(source.id, tags);
  console.log(`   🎯 Matching Users: ${recipients.length} (Source: ${source.id}, Tags: ${tags.join(', ')})`);

  if (recipients.length > 0) {
      for (const userId of recipients) {
          try {
              await sendNewsletter(summary, article.url, userId);
              console.log(`      ✅ Sent to ${userId}`);
          } catch (err) {
              console.error(`      ❌ Failed to send to ${userId}: ${err.message}`);
          }
      }
  } else {
      console.log(`   ⚠️ No subscribers found for this content.`);
  }

  // 2. Save to Global History
  history.addArticle(article, summary);

  return true;
}

/**
 * Check for new FX Daily articles and send newsletter if found
 * @param {object} options - Watcher options
 * @returns {Promise<boolean>} True if a new article was found and processed
 */
async function checkForNewArticle(options = {}) {
  const {
    recipientEmail = process.env.RECIPIENT_EMAIL,
    forceProcess = false,
  } = options;

  console.log('\n' + '='.repeat(60));
  console.log('🔍 FX DAILY WATCHER - Checking for new articles...');
  console.log('='.repeat(60));
  console.log(`   Time: ${new Date().toLocaleString('fr-FR')}`);

  try {
    // Iterate over ALL sources
    const sources = sourceManager.listSources();
    let hasNewContent = false;

    // Load state matching generic structure
    const state = loadState() || {};

    for (const srcMeta of sources) {
        try {
            const source = sourceManager.getSource(srcMeta.id);
            console.log(`\n🔍 Checking source: ${source.name}...`);
            
            const latestArticle = await source.fetchLatest();
            
            // Check state for THIS source
            const lastUrl = state[source.id]?.lastArticleUrl;

            if (!forceProcess && lastUrl === latestArticle.url) {
                console.log(`   ✅ Up to date.`);
                continue;
            }

            console.log(`   🆕 NEW CONTENT: "${latestArticle.title}"`);
            
            // Process
            await processAndSend(source, latestArticle, recipientEmail); // Pass whole article object
            
            // Update State
            saveState(source.id, latestArticle.url);
            hasNewContent = true;

        } catch (err) {
            console.error(`   ❌ Failed to check ${srcMeta.name}: ${err.message}`);
        }
    }

    if (hasNewContent) {
        console.log('\n' + '='.repeat(60));
        console.log('✨ Check cycle completed with new content.');
        console.log('='.repeat(60) + '\n');
    }
    
    return hasNewContent;

  } catch (error) {
    console.error(`\n❌ Error checking for new article:`, error.message);
    throw error;
  }
}

/**
 * Start continuous watching (polling)
 * @param {object} options - Watcher options
 */
async function startWatcher(options = {}) {
  const {
    intervalMinutes = 30,
    recipientEmail = process.env.RECIPIENT_EMAIL,
  } = options;

  console.log('\n' + '═'.repeat(60));
  console.log('🚀 FX DAILY AUTO-WATCHER STARTED');
  console.log('═'.repeat(60));
  console.log(`   📧 Recipient: ${recipientEmail || '⚠️ NOT SET'}`);
  console.log(`   ⏱️  Check interval: Every ${intervalMinutes} minutes`);
  console.log(`   🤖 AI Summary: ${ (process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY) ? '✅ Enabled' : '❌ Disabled'}`);
  console.log('═'.repeat(60));
  
  if (!recipientEmail) {
    console.error('\n❌ RECIPIENT_EMAIL not set in .env file!');
    process.exit(1);
  }

  // Initial check
  await checkForNewArticle({ recipientEmail });

  // Set up interval
  const intervalMs = intervalMinutes * 60 * 1000;
  
  console.log(`\n⏳ Next check in ${intervalMinutes} minutes...`);
  console.log('   Press Ctrl+C to stop the watcher.\n');

  setInterval(async () => {
    try {
      await checkForNewArticle({ recipientEmail });
      console.log(`\n⏳ Next check in ${intervalMinutes} minutes...`);
    } catch (error) {
      console.error('Error during check:', error.message);
      console.log(`   Will retry in ${intervalMinutes} minutes...`);
    }
  }, intervalMs);
}

module.exports = {
  checkForNewArticle,
  startWatcher,
  processAndSend,
  loadState,
  saveState,
};
