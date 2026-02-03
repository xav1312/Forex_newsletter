const axios = require('axios');
const { JSDOM } = require('jsdom');

const FF_XML_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml';

/**
 * Fetch and parse ForexFactory economic calendar
 * @returns {Promise<Array<{title: string, country: string, date: Date, impact: string, forecast: string, previous: string}>>}
 */
/**
 * Fetch and parse ForexFactory economic calendar
 * @param {Date|string} targetDate - Optional date to filter events for (defaults to Now)
 * @returns {Promise<Array<object>>}
 */
async function getEconomicEvents(targetDate) {
  try {
    console.log(`📅 Fetching ForexFactory calendar...`);
    const response = await axios.get(FF_XML_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
      }
    });

    const dom = new JSDOM(response.data, { contentType: "text/xml" });
    const document = dom.window.document;
    
    const events = [];
    const eventNodes = document.querySelectorAll('event');

    // Use provided date or default to now
    let refDate = targetDate ? new Date(targetDate) : new Date();
    
    // Validate date
    if (isNaN(refDate.getTime())) {
        console.warn('⚠️ Invalid reference date provided, defaulting to Now.');
        refDate = new Date();
    }
    
    // Log the reference date for debugging
    console.log(`   ℹ️ Filtering events for: ${refDate.toDateString()}`);

    eventNodes.forEach(node => {
      const dateStr = node.querySelector('date')?.textContent; // Format: 1-23-2026
      const timeStr = node.querySelector('time')?.textContent; // Format: 1:30pm
      
      if (!dateStr || !timeStr) return;

      // Parse date and time
      const [month, day, year] = dateStr.split('-');
      
      // Determine time
      const timeMatch = timeStr.match(/(\d+):(\d+)(am|pm)/i);
      let hours = 0;
      let minutes = 0;
      
      if (timeMatch) {
         hours = parseInt(timeMatch[1]);
         minutes = parseInt(timeMatch[2]);
         const period = timeMatch[3].toLowerCase();
         
         if (period === 'pm' && hours < 12) hours += 12;
         if (period === 'am' && hours === 12) hours = 0;
      }

      const eventDate = new Date(year, month - 1, day, hours, minutes);

      const timezone = process.env.TIMEZONE || 'UTC';
      
      // Get "Today" relative to the reference date (Article Date) in the user's timezone
      // We process events matching the Article's "Day"
      const targetDateString = refDate.toLocaleDateString('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
      });

      // Reconstruct event date string from XML match
      const eventDateString = `${parseInt(month)}/${parseInt(day)}/${year}`;

      // Strict comparison: Event must match the Target Date
      if (targetDateString !== eventDateString) return;

      const impact = node.querySelector('impact')?.textContent || 'Low';
      const country = node.querySelector('country')?.textContent || '';
      const title = node.querySelector('title')?.textContent || '';

      events.push({
        title,
        country, 
        currency: country,
        date: eventDate,
        impact, 
        forecast: node.querySelector('forecast')?.textContent || '',
        previous: node.querySelector('previous')?.textContent || ''
      });
    });

    // Filter only High and Medium impact
    const importantEvents = events.filter(e => e.impact === 'High' || e.impact === 'Medium');
    
    console.log(`✅ Found ${importantEvents.length} important events for ${refDate.toDateString()}`);
    return importantEvents;

  } catch (error) {
    console.error(`❌ Error fetching calendar:`, error.message);
    return [];
  }
}

/**
 * Get events formatted for specific currencies
 * @param {string[]} currencies - List of currency codes
 * @param {Date|string} targetDate - Optional date to filter events for
 * @returns {Promise<Object>} Map of currency -> events array
 */
async function getEventsForCurrencies(currencies, targetDate) {
  const allEvents = await getEconomicEvents(targetDate);
  const eventsByCurrency = {};

  // Initialize arrays
  currencies.forEach(c => eventsByCurrency[c] = []);

  allEvents.forEach(event => {
    if (currencies.includes(event.currency)) {
      eventsByCurrency[event.currency].push(event);
    }
  });

  return eventsByCurrency;
}


const COUNTRY_MAP = {
  'USD': 'united-states',
  'EUR': 'euro-area',
  'GBP': 'united-kingdom',
  'JPY': 'japan',
  'AUD': 'australia',
  'NZD': 'new-zealand',
  'CAD': 'canada',
  'CHF': 'switzerland',
  'CNY': 'china'
};

const INDICATOR_MAP = [
  { keywords: ['Interest Rate', 'Decision', 'Rate'], slug: 'interest-rate' },
  { keywords: ['Inflation', 'CPI'], slug: 'inflation-rate' },
  { keywords: ['GDP'], slug: 'gdp-growth' },
  { keywords: ['Unemployment', 'Job'], slug: 'unemployment-rate' },
  { keywords: ['Retail Sales'], slug: 'retail-sales' },
  { keywords: ['PMI', 'Manufacturing'], slug: 'manufacturing-pmi' },
  { keywords: ['Services'], slug: 'services-pmi' },
  { keywords: ['Trade Balance'], slug: 'balance-of-trade' },
  { keywords: ['Consumer Confidence', 'Sentiment'], slug: 'consumer-confidence' },
  { keywords: ['Building Permits', 'Housing'], slug: 'building-permits' },
  { keywords: ['Producer Prices', 'PPI'], slug: 'producer-prices' },
];

function getTradingEconomicsLink(currency, title) {
  const countrySlug = COUNTRY_MAP[currency];
  if (!countrySlug) return null;

  const indicator = INDICATOR_MAP.find(ind => 
    ind.keywords.some(k => title.toLowerCase().includes(k.toLowerCase()))
  );

  if (indicator) {
    return `https://tradingeconomics.com/${countrySlug}/${indicator.slug}`;
  }
  
  return null;
}

module.exports = { 
  getEconomicEvents, 
  getEventsForCurrencies, 
  getTradingEconomicsLink 
};
