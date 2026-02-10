const Parser = require('rss-parser');
const parser = new Parser();

async function checkFeed(url) {
  try {
    console.log(`\n🔍 Checking: ${url}`);
    const feed = await parser.parseURL(url);
    console.log(`✅ Title: ${feed.title}`);
    console.log(`   Items: ${feed.items.length}`);
    if (feed.items.length > 0) {
      console.log('--- First 3 Items ---');
      feed.items.slice(0, 3).forEach(item => {
        console.log(`- [${item.title}]`);
        console.log(`  Link: ${item.link}`);
      });
    }
  } catch (e) {
    console.error(`❌ Error: ${e.message}`);
  }
}

(async () => {
    await checkFeed('https://think.ing.com/rss/all');
    await checkFeed('https://www.investing.com/rss/news_1.rss'); // English feed just to test
})();
