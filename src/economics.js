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
let weeklyCache = null;
let lastCacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Fetch and parse the full weekly calendar (with caching)
 */
async function fetchWeeklyCalendar() {
    // Return cache if valid
    if (weeklyCache && (Date.now() - lastCacheTime < CACHE_DURATION)) {
        return weeklyCache;
    }

    try {
        console.log(`📅 Fetching ForexFactory calendar (Live)...`);
        const response = await axios.get(FF_XML_URL, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            }
        });

        const dom = new JSDOM(response.data, { contentType: "text/xml" });
        const document = dom.window.document;
        const events = [];
        const eventNodes = document.querySelectorAll('event');

        eventNodes.forEach(node => {
            const dateStr = node.querySelector('date')?.textContent;
            const timeStr = node.querySelector('time')?.textContent;
            
            if (!dateStr || !timeStr) return;

            const [month, day, year] = dateStr.split('-');
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
            const country = node.querySelector('country')?.textContent || '';
            const title = node.querySelector('title')?.textContent || '';
            const impact = node.querySelector('impact')?.textContent || 'Low';

            events.push({
                title,
                country, 
                currency: country, // ForexFactory uses country code like USD, EUR often as Currency
                date: eventDate,
                impact, 
                forecast: node.querySelector('forecast')?.textContent || '',
                previous: node.querySelector('previous')?.textContent || ''
            });
        });

        weeklyCache = events;
        lastCacheTime = Date.now();
        return weeklyCache;

    } catch (error) {
        console.error(`❌ Error fetching calendar:`, error.message);
        throw error;
    }
}

/**
 * Get economic events filtered by date
 * @param {Date|string} targetDate - Optional date to filter events for (defaults to Now)
 * @returns {Promise<Array<object>>}
 */
async function getEconomicEvents(targetDate) {
  try {
    // 1. Get full data (cached or fresh)
    const allEvents = await fetchWeeklyCalendar();
    if (!allEvents) return [];

    // 2. Determine filter date
    let refDate = targetDate ? new Date(targetDate) : new Date();
    if (isNaN(refDate.getTime())) {
        console.warn('⚠️ Invalid reference date provided, defaulting to Now.');
        refDate = new Date();
    }
    
    console.log(`   ℹ️ Filtering events for: ${refDate.toDateString()}`);
    const timezone = process.env.TIMEZONE || 'UTC';

    // 3. Filter events
    const matchingEvents = allEvents.filter(event => {
        // Compare "Day" strings to match the target date
        const targetDateString = refDate.toLocaleDateString('en-US', {
            timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric'
        });
        
        const eventDateString = event.date.toLocaleDateString('en-US', {
            timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric'
        });

        return targetDateString === eventDateString;
    });

    // 4. Return only High/Medium impact
    const importantEvents = matchingEvents.filter(e => e.impact === 'High' || e.impact === 'Medium');
    
    console.log(`✅ Found ${importantEvents.length} important events for ${refDate.toDateString()}`);
    return importantEvents;

  } catch (error) {
    console.error(`❌ Error in getEconomicEvents:`, error.message);
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
