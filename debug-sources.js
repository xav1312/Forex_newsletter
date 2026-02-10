const sourceManager = require('./src/source-manager');

try {
  console.log('--- DEBUG START ---');
  const sources = sourceManager.listSources();
  console.log('List Sources count:', sources.length);
  console.log(JSON.stringify(sources, null, 2));
  console.log('--- DEBUG END ---');
} catch (e) {
  console.error('ERROR:', e);
}
