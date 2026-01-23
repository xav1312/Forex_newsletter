const fs = require('fs');
const path = require('path');
const { getLatestArticle } = require('./sources/ing-think');
const { scrapeArticle } = require('./scraper');
const { summarizeWithGemini, simpleSummary } = require('./summarizer');
const { sendNewsletter, previewNewsletter } = require('./emailer');

// State file to track last processed article
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
 * Save the current state
 * @param {string} articleUrl - URL of the last processed article
 */
function saveState(articleUrl) {
  const state = {
    lastArticleUrl: articleUrl,
    lastCheck: new Date().toISOString(),
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Process and send newsletter for an article
 * @param {string} url - Article URL
 * @param {string} recipientEmail - Email to send to
 */
async function processAndSend(url, recipientEmail) {
  console.log(`\n📥 Scraping article...`);
  const article = await scrapeArticle(url);
  console.log(`   Title: ${article.title}`);
  console.log(`   Content: ${article.content.length} characters`);

  console.log(`\n🤖 Generating French summary...`);
  let summary;
  
  if (process.env.GEMINI_API_KEY) {
    summary = await summarizeWithGemini(article);
  } else {
    console.log('   ⚠️  No GEMINI_API_KEY - using simple summary');
    summary = simpleSummary(article);
  }
  
  console.log(`   Currencies analyzed: ${Object.keys(summary.currencies).join(', ') || 'none'}`);

  // Save preview
  const outputDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const filename = `fx_daily_${Date.now()}.html`;
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, previewNewsletter(article, summary));
  console.log(`\n💾 Preview saved: ${filepath}`);

  // Send email
  if (recipientEmail) {
    console.log(`\n📧 Sending email to ${recipientEmail}...`);
    await sendNewsletter(article, summary, { to: recipientEmail });
    console.log(`   ✅ Email sent successfully!`);
  }

  return { article, summary };
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
    // Get the latest FX Daily article
    const latestArticle = await getLatestArticle();
    
    // Check if it's an FX Daily article
    if (!latestArticle.url.includes('fx-daily')) {
      console.log(`\n⏭️  Latest article is not FX Daily: "${latestArticle.title}"`);
      console.log('   Waiting for next FX Daily publication...');
      return false;
    }

    console.log(`\n📰 Latest FX Daily: "${latestArticle.title}"`);
    console.log(`   URL: ${latestArticle.url}`);

    // Load previous state
    const state = loadState();
    
    // Check if this is a new article
    if (!forceProcess && state && state.lastArticleUrl === latestArticle.url) {
      console.log(`\n✅ Already processed this article.`);
      console.log(`   Last check: ${new Date(state.lastCheck).toLocaleString('fr-FR')}`);
      return false;
    }

    console.log(`\n🆕 NEW ARTICLE DETECTED!`);
    
    // Process and send
    await processAndSend(latestArticle.url, recipientEmail);
    
    // Save state
    saveState(latestArticle.url);
    
    console.log('\n' + '='.repeat(60));
    console.log('✨ New FX Daily newsletter sent successfully!');
    console.log('='.repeat(60) + '\n');
    
    return true;

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
  console.log(`   🤖 AI Summary: ${process.env.GEMINI_API_KEY ? '✅ Enabled' : '❌ Disabled'}`);
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
