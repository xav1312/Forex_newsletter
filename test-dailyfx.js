const Parser = require('rss-parser');

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  }
});

const url = 'https://news.google.com/rss/search?q=site:dailyfx.com+forex&hl=en-GB&gl=GB&ceid=GB:en';

async function test() {
  try {
    console.log('Testing Google News RSS...');
    const feed = await parser.parseURL(url);
    console.log('Success! Items found:', feed.items.length);
    console.log('Top items:', feed.items.slice(0, 2).map(i => i.title));
  } catch (e) {
    console.error('Failed:', e.message);
  }
}

test();
