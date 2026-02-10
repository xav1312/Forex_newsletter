const fs = require('fs');
const path = require('path');
const sourceManager = require('./source-manager');
const userManager = require('./users');
const history = require('./history');
const { scrapeArticle } = require('./scraper');
const { summarizeWithGroq, simpleSummary } = require('./summarizer');
const { previewNewsletter } = require('./emailer');
const { getEventsForCurrencies } = require('./economics');

// State file to track last processed article per source
const STATE_FILE = path.join(__dirname, '..', '.watcher-state.json');

/**
 * Load the last processed article state
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
 * Process and send results for an article
 */
async function processAndSend(source, articleData) {
  console.log(`\n📥 Processing article from ${source.name}...`);
  
  let article;

  if (source.id.includes('rss') || source.type === 'general_news') {
      console.log('   ℹ️  Using RSS description as content...');
      article = {
          ...articleData,
          content: articleData.description || articleData.content || 'No content available.',
          siteName: source.name
      };
      console.log(`   Title: ${article.title}`);
  } else {
      console.log(`   🌍 Scraping full page: ${articleData.url}`);
      article = await scrapeArticle(articleData.url);
      console.log(`   Title: ${article.title}`);
  }

  console.log(`\n🤖 Generating Summary...`);
  let summary;

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

  // Add Calendar
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

  // Save Preview (internal record)
  const outputDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, `newsletter_${source.id}_${Date.now()}.html`), previewNewsletter(article, summary));

  // --- SMART DISPATCH ---
  console.log(`\n🚀 Dispatching...`);
  const tags = summary.tags || [];
  
  // 1. Get Recipients from UserManager
  const recipients = userManager.getRecipients(source.id, tags);
  console.log(`   🎯 Matching Users: ${recipients.length} (Source: ${source.id}, Tags: ${tags.join(', ')})`);

  if (recipients.length > 0) {
      // Lazy load bot to avoid circular dependencies or premature start
      const bot = require('./bot');
      for (const userId of recipients) {
          try {
              await bot.sendArticle(userId, article, summary);
              console.log(`      ✅ Sent to Telegram User: ${userId}`);
          } catch (err) {
              console.error(`      ❌ Failed to send to ${userId}: ${err.message}`);
          }
      }
  } else {
      console.log(`   ⚠️ No subscribers found for this content.`);
  }

  // 2. Save to Global History
  history.addArticle(article, summary, source.id);

  return true;
}

/**
 * Check for new articles
 */
async function checkForNewArticle(options = {}) {
  const { forceProcess = false } = options;

  console.log('\n' + '='.repeat(60));
  console.log('🔍 FX WATCHER - Checking for new articles...');
  console.log('='.repeat(60));
  console.log(`   Time: ${new Date().toLocaleString('fr-FR')}`);

  try {
    const sources = sourceManager.listSources();
    let hasNewContent = false;
    const state = loadState() || {};

    for (const srcMeta of sources) {
        try {
            const source = sourceManager.getSource(srcMeta.id);
            console.log(`\n🔍 Checking source: ${source.name}...`);
            
            const latestArticle = await source.fetchLatest();
            const lastUrl = state[source.id]?.lastArticleUrl;

            if (!forceProcess && lastUrl === latestArticle.url) {
                console.log(`   ✅ Up to date.`);
                continue;
            }

            console.log(`   🆕 NEW CONTENT: "${latestArticle.title}"`);
            await processAndSend(source, latestArticle);
            
            saveState(source.id, latestArticle.url);
            hasNewContent = true;

        } catch (err) {
            console.error(`   ❌ Failed to check ${srcMeta.name}: ${err.message}`);
        }
    }

    if (hasNewContent) {
        console.log('\n' + '='.repeat(60));
        console.log('✨ Check cycle completed.');
        console.log('='.repeat(60) + '\n');
    }
    
    return hasNewContent;
  } catch (error) {
    console.error(`\n❌ Error checking for new article:`, error.message);
    throw error;
  }
}

/**
 * Start continuous watching
 */
async function startWatcher(options = {}) {
  const { intervalMinutes = 30 } = options;

  console.log('\n' + '═'.repeat(60));
  console.log('🚀 FX AUTO-WATCHER STARTED');
  console.log('═'.repeat(60));
  console.log(`   ⏱️  Interval: Every ${intervalMinutes} minutes`);
  console.log(`   🤖 AI Summary: ${ (process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY) ? '✅ Enabled' : '❌ Disabled'}`);
  console.log('═'.repeat(60));
  
  // Initial check
  await checkForNewArticle();

  const intervalMs = intervalMinutes * 60 * 1000;
  console.log(`\n⏳ Next check in ${intervalMinutes} minutes...`);

  setInterval(async () => {
    try {
      await checkForNewArticle();
    } catch (error) {
      console.error('Error during check:', error.message);
    }
  }, intervalMs);

  // --- MORNING BRIEFING SCHEDULER (08:00 AM) ---
  const cron = require('node-cron');
  const { generateBriefing } = require('./briefing');
  const bot = require('./bot');

  console.log('📅 Morning Briefing scheduled for 08:00 AM');
  
  cron.schedule('0 8 * * *', async () => {
      const users = userManager.users;
      for (const userId in users) {
          try {
              const user = users[userId];
              const text = await generateBriefing(user.subscriptions);
              await bot.bot.sendMessage(userId, text, { parse_mode: 'HTML' });
              console.log(`☕ Personalized Morning Briefing sent to ${user.name} (${userId}).`);
          } catch (err) {
              console.error(`❌ Failed to send Personalized Briefing to ${userId}:`, err.message);
          }
      }
  }, {
      scheduled: true,
      timezone: process.env.TIMEZONE || "Europe/Paris"
  });
}

module.exports = {
  checkForNewArticle,
  startWatcher,
  processAndSend,
  loadState,
  saveState,
};
