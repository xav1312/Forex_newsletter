require('dotenv').config();

const { checkForNewArticle, startWatcher } = require('./src/watcher');
const sourceManager = require('./src/source-manager');
const history = require('./src/history');

/**
 * CLI usage for the Forex Newsletter system
 */
if (require.main === module) {
  const command = process.argv[2];
  const intervalArg = process.argv.find(a => a.startsWith('--interval='));
  const interval = intervalArg ? parseInt(intervalArg.split('=')[1]) : 30;
  
  // Show help
  if (!command || command === '--help' || command === '-h') {
    console.log(`
📰 FX Newsletter Generator - Usage:

COMMANDS:
  watch                 🚀 Start auto-watcher & Telegram Bot (Interactive)
  check                 🔍 Check once for new articles (cron style)
  search <term>         🔎 Search in article history
  sources               📚 List all available news sources
  briefing              ☕ Generate and send the Morning Briefing (Manual)
  ask <uid> <q>         🙋 Pose une question IA sur l'historique d'un utilisateur

OPTIONS:
  --interval=<min>      Watch interval in minutes (default: 30)
  --force               Force check even if URL hasn't changed (for 'check')

EXAMPLES:
  node index.js watch
  node index.js search inflation
  node index.js check --force
  node index.js briefing
  node index.js ask 1162362981 "C'est quoi l'impact de Kevin Warsh ?"
    `);
    process.exit(0);
  }

  // Handle commands
  if (command === 'watch') {
    // 1. Start Bot interface (Interactive)
    try { 
        require('./src/bot'); 
    } catch (e) { 
        console.error('❌ Bot Initialization Error:', e.message); 
    }

    // 2. Start the auto-watcher
    startWatcher({ intervalMinutes: interval });
    
  } else if (command === 'check') {
    const force = process.argv.includes('--force');
    checkForNewArticle({ forceProcess: force })
        .then(() => process.exit(0))
        .catch(() => process.exit(1));

  } else if (command === 'search') {
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

  } else if (command === 'sources') {
    const sources = sourceManager.listSources();
    console.log('\n📚 Available News Sources:\n');
    sources.forEach(s => {
        console.log(`   - ${s.id.padEnd(15)} : ${s.name} (${s.type})`);
    });
    process.exit(0);

  } else if (command === 'briefing') {
    const { generateBriefing } = require('./src/briefing');
    const userManager = require('./src/users');
    const bot = require('./src/bot');
    
    // For manual testing, pick the first user or use empty subs
    const userIds = Object.keys(userManager.users);
    const testUserId = userIds[0];
    const user = testUserId ? userManager.users[testUserId] : { subscriptions: [] };
    
    generateBriefing(user.subscriptions)
        .then(async (text) => {
            console.log('\n--- BRIEFING PREVIEW ---\n');
            console.log(text);
            console.log('\n--- END OF PREVIEW ---\n');
            if (testUserId) {
                await bot.bot.sendMessage(testUserId, text, { parse_mode: 'HTML' });
                console.log(`✅ Briefing sent to ${user.name} (${testUserId}).`);
            }
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ Briefing Failed:', err.message);
            process.exit(1);
        });

  } else if (command === 'ask') {
    const userId = process.argv[3];
    const question = process.argv[4];
    if (!userId || !question) {
        console.error('❌ Usage: node index.js ask <userId> "<question>"');
        process.exit(1);
    }
    const { askQuestion } = require('./src/rag');
    askQuestion(userId, question)
        .then(answer => {
            console.log('\n🤖 IA RESPONSE :\n');
            console.log(answer);
            console.log('\n');
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ RAG Failed:', err.message);
            process.exit(1);
        });

  } else {
    console.error(`❌ Unknown command: ${command}`);
    console.log('Run "node index.js --help" for usage information.');
    process.exit(1);
  }
}
