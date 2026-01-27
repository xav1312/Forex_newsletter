const { getRecentArticles } = require('./src/sources/ing-think');

async function debug() {
    console.log('--- DEBUG: RECENT ARTICLES ---');
    try {
        const articles = await getRecentArticles(10);
        articles.forEach((a, i) => {
            console.log(`${i+1}. Title: ${a.title}`);
            console.log(`   Link: ${a.url}`);
            console.log(`   Type: ${a.isSnap ? 'Snap' : 'Article'}`);
            console.log('---------------------------');
        });
    } catch (e) {
        console.error(e);
    }
}

debug();
