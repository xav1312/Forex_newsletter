require('dotenv').config();

const { scrapeArticle } = require('./src/scraper');
const { summarizeWithGemini, summarizeWithGroq, simpleSummary } = require('./src/summarizer');
const { sendNewsletter, previewNewsletter } = require('./src/emailer');
const { getEventsForCurrencies } = require('./src/economics');
const { checkForNewArticle, startWatcher } = require('./src/watcher');
const sourceManager = require('./src/source-manager');
const fs = require('fs');
const path = require('path');
const history = require('./src/history');

// ... (existing processArticle function remains unchanged) ...

/**
 * Automatically fetch and process the latest article from a specific source
 * @param {string} sourceId - The source adapter ID (default: 'ing')
 * @param {object} options - Processing options
 */
async function processSource(sourceId = 'ing', options = {}) {
  try {
    const source = sourceManager.getSource(sourceId);
    
    console.log('\n' + '='.repeat(60));
    console.log(`🏦 SOURCE: ${source.name.toUpperCase()} - AUTO FETCH`);
    console.log('='.repeat(60) + '\n');

    // Get the latest article URL using the adapter
    const latestArticle = await source.fetchLatest();
    console.log(`\n📰 Latest article found: "${latestArticle.title}"\n`);
    
    // Process it (passing source type for context-aware summarization)
    return await processArticle(latestArticle.url, { ...options, sourceType: source.type });
  } catch (error) {
    console.error(`\n❌ Error fetching from source ${sourceId}:`, error.message);
    throw error;
  }
}

/**
 * Main function to process an article into a newsletter
 * @param {string} url - The article URL to process
 * @param {object} options - Processing options
 */
async function processArticle(url, options = {}) {
  const {
    useAI = true,
    sendEmail = false,
    recipientEmail = process.env.RECIPIENT_EMAIL,
    savePreview = true,
  } = options;

  console.log('\n' + '='.repeat(60));
  console.log('🚀 NEWSLETTER GENERATOR');
  console.log('='.repeat(60) + '\n');

  try {
    // Step 1: Scrape the article
    console.log('📥 Step 1: Scraping article...');
    const article = await scrapeArticle(url);
    console.log(`   Title: ${article.title}`);
    console.log(`   Source: ${article.siteName}`);
    console.log(`   Content length: ${article.content.length} characters\n`);

    // Step 2: Summarize
    console.log('🤖 Step 2: Generating French summary with Groq...');
    let summary;
    
    if (useAI && process.env.GROQ_API_KEY) {
      try {
        summary = await summarizeWithGroq(article, { sourceType: options.sourceType });
      } catch (error) {
        console.error('   ❌ Groq AI failed:', error.message);
        summary = simpleSummary(article);
      }
    } else {
      console.log('   (Using simple extractive summary - no AI API key found)');
      summary = simpleSummary(article);
    }
    
    const currencyCount = Object.keys(summary.currencies || {}).length;
    console.log(`   Currencies analyzed: ${currencyCount}`);
    console.log(`   Mentioned: ${summary.mentionedCurrencies?.join(', ') || 'none'}\n`);

    // Step 2.5: Add Economic Calendar
    try {
      const currencies = Object.keys(summary.currencies || {});
      if (currencies.length > 0) {
        console.log('📅 Step 2.5: Fetching economic calendar...');
        // Pass article publication date to match events to the ARTICLE'S day (not necessarily "today")
        const eventsByCurrency = await getEventsForCurrencies(currencies, article.publishedTime);
        
        let eventCount = 0;
        for (const [currency, events] of Object.entries(eventsByCurrency)) {
          if (summary.currencies[currency]) {
            summary.currencies[currency].events = events;
            eventCount += events.length;
          }
        }
        console.log(`   ✅ Added ${eventCount} high-impact events\n`);
      }
    } catch (err) {
      console.error(`   ⚠️ Failed to fetch calendar: ${err.message}\n`);
    }

    // Step 3: Generate newsletter
    console.log('📧 Step 3: Creating newsletter...');
    const html = previewNewsletter(article, summary);

    // Save preview to file
    if (savePreview) {
      const outputDir = path.join(__dirname, 'output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filename = `fx_daily_${Date.now()}.html`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, html);
      console.log(`   ✅ Preview saved to: ${filepath}\n`);
    }

    // Step 4: Send email (optional)
    if (sendEmail && recipientEmail) {
      console.log('📤 Step 4: Sending email...');
      await sendNewsletter(article, summary, { to: recipientEmail });
      console.log('   ✅ Email sent successfully!\n');
    } else if (sendEmail) {
      console.log('   ⚠️  No recipient email configured. Set RECIPIENT_EMAIL in .env\n');
    }

    // Step 5: Send Telegram (New!)
    const telegram = require('./src/telegram');
    console.log('📱 Sending to Telegram...');
    try {
        await telegram.sendNewsletter(summary, article.url);
    } catch (err) {
        console.error('   ⚠️ Failed to send Telegram: ' + err.message);
    }

    console.log('='.repeat(60));
    console.log('✨ DONE! Newsletter generated successfully.');
    console.log('='.repeat(60) + '\n');

    // Save to history
    history.addArticle(article, summary);

    return { article, summary, html };

  } catch (error) {
    console.error('\n❌ Error processing article:', error.message);
    throw error;
  }
}


// CLI usage
if (require.main === module) {
  const command = process.argv[2];
  const sendEmail = process.argv.includes('--send');
  const intervalArg = process.argv.find(a => a.startsWith('--interval='));
  const interval = intervalArg ? parseInt(intervalArg.split('=')[1]) : 30;
  
  // Show help
  if (!command || command === '--help' || command === '-h') {
    console.log(`
📰 FX Daily Newsletter Generator - Usage:

COMMANDS:
  ing                   Fetch the latest ING Think FX article
  watch                 🆕 Auto-watch for new FX Daily articles & send emails
  check                 🆕 Check once for new articles (for cron jobs)
  <article-url>         Process a specific article URL

OPTIONS:
  --send                Send the newsletter via email
  --interval=<minutes>  Watch interval in minutes (default: 30)

EXAMPLES:
  node index.js ing                     # Get latest ING Think FX article
  node index.js ing --send              # Get latest and send by email
  node index.js watch                   # Start auto-watcher (checks every 30 min)
  node index.js watch --interval=15     # Check every 15 minutes
  node index.js check                   # Check once (for cron)

CRON EXAMPLE (check every hour at :00):
  0 * * * * cd /path/to/project && node index.js check

ENVIRONMENT VARIABLES (in .env file):
  GEMINI_API_KEY      - Google Gemini API key for French AI summaries
  SMTP_HOST           - SMTP server host
  SMTP_PORT           - SMTP server port (default: 587)
  SMTP_USER           - SMTP username
  SMTP_PASSWORD       - SMTP password
  EMAIL_FROM          - From email address
  RECIPIENT_EMAIL     - Default recipient email (REQUIRED for watch/check)
    `);
    process.exit(0);
  }

  // Handle commands
  let processPromise;
  
  if (command === 'watch') {
    // Start Bot Interface
    try { require('./src/bot'); } catch (e) { console.error('Bot Error:', e); }

    // Start the auto-watcher
    startWatcher({ intervalMinutes: interval });
    // Don't exit - keep running
    return;
  } else if (command === 'check') {
    // Single check for cron jobs
    const force = process.argv.includes('--force');
    processPromise = checkForNewArticle({ forceProcess: force });
  } else if (command === 'ing') {
    // Auto-fetch latest ING Think FX article (Legacy Alias)
    processPromise = processSource('ing', { sendEmail });
  } else if (command === 'search') {
    // Search in history
    const query = process.argv[3];
    if (!query) {
        console.error('❌ Please provide a search term: node index.js search <term>');
        process.exit(1);
    }
    const results = history.search(query);
    console.log(`\n🔍 Search results for "${query}":\n`);
    if (results.length === 0) {
        console.log('   No articles found.');
    } else {
        results.forEach(r => {
            console.log(`   - [${new Date(r.date).toLocaleDateString()}] ${r.title}`);
            console.log(`     Tags: ${r.tags.join(', ')}`);
            console.log(`     Link: ${r.url}\n`);
        });
    }
    process.exit(0);
  } else if (!command.startsWith('http') && !command.startsWith('-')) {
    // Try to use command as a source ID (e.g., 'reuters')
    try {
        processPromise = processSource(command, { sendEmail });
    } catch (e) {
        console.error(`❌ Unknown command or source: ${command}`);
        process.exit(1);
    }
  } else if (command.startsWith('http')) {
    // Process specific URL
    processPromise = processArticle(command, { sendEmail });
  } else {
    console.error(`❌ Unknown command: ${command}`);
    console.log('Run "node index.js --help" for usage information.');
    process.exit(1);
  }

  processPromise
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { 
  processArticle, 
  processSource,
  checkForNewArticle,
  startWatcher,
};

