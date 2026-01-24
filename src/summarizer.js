const axios = require('axios');

// Currencies to track
const TRACKED_CURRENCIES = ['USD', 'EUR', 'GBP', 'NZD', 'AUD', 'JPY', 'CAD', 'CHF', 'CNY'];

// Currency display names in French
const CURRENCY_NAMES = {
  USD: 'Dollar américain',
  EUR: 'Euro',
  GBP: 'Livre sterling',
  NZD: 'Dollar néo-zélandais',
  AUD: 'Dollar australien',
  JPY: 'Yen japonais',
  CAD: 'Dollar canadien',
  CHF: 'Franc suisse',
  CNY: 'Yuan chinois',
};

/**
 * Detect which currencies are mentioned in the article content
 * @param {string} content - Article content
 * @returns {string[]} Array of mentioned currency codes
 */
function detectCurrencies(content) {
  const upperContent = content.toUpperCase();
  const mentioned = [];
  
  // Also check for currency pairs like EUR/USD, EURUSD
  const currencyPatterns = TRACKED_CURRENCIES.flatMap(c => [
    c,
    c.toLowerCase(),
    // Common pair patterns
    ...TRACKED_CURRENCIES.filter(c2 => c2 !== c).map(c2 => `${c}/${c2}`),
    ...TRACKED_CURRENCIES.filter(c2 => c2 !== c).map(c2 => `${c}${c2}`),
  ]);

  for (const currency of TRACKED_CURRENCIES) {
    // Check for the currency code
    const regex = new RegExp(`\\b${currency}\\b`, 'gi');
    if (regex.test(content)) {
      mentioned.push(currency);
      continue;
    }
    
    // Check for currency in pairs (e.g., EUR/USD mentions both EUR and USD)
    for (const other of TRACKED_CURRENCIES) {
      if (other === currency) continue;
      const pairRegex = new RegExp(`\\b(${currency}[/]?${other}|${other}[/]?${currency})\\b`, 'gi');
      if (pairRegex.test(content) && !mentioned.includes(currency)) {
        mentioned.push(currency);
        break;
      }
    }
  }

  return mentioned;
}

/**
 * Summarize article using Groq API (Llama 3)
 * @param {object} article - The article object from scraper
 * @param {object} options - Summarization options
 * @returns {Promise<{title: string, introduction: string, currencies: object, conclusion: string, keyTakeaway: string}>}
 */
async function summarizeWithGroq(article, options = {}) {
  const Groq = require('groq-sdk');
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not found in environment variables');
  }

  const groq = new Groq({ apiKey });

  // Detect mentioned currencies
  const mentionedCurrencies = detectCurrencies(article.content);
  console.log(`   Currencies detected: ${mentionedCurrencies.join(', ') || 'none'}`);

  const currencyList = mentionedCurrencies.length > 0 
    ? mentionedCurrencies.map(c => `${c} (${CURRENCY_NAMES[c]})`).join(', ')
    : 'Aucune devise spécifique détectée';

  const prompt = `Tu es un Stratège Macro FX Senior. Tu t'adresses à des gérants de fonds et traders professionnels.

ARTICLE SOURCE (ING FX Daily):
Titre: ${article.title}
Contenu: ${article.content.substring(0, 25000)}

INSTRUCTIONS :
1. Ton objectif est de fournir une ANALYSE FONDAMENTALE DÉTAILLÉE et DENSE.
2. Pour chaque devise, ne fais pas juste un résumé. EXPLIQUE le "Pourquoi" en profondeur :
   - Quels chiffres économiques précis ont influencé le cours ?
   - Quel est l'impact sur les taux (Yields) ?
   - Quelles sont les implications politiques ou banque centrale ?
3. Rédige environ 80 à 100 mots par devise. Sois précis et technique (macro).
4. Ne donne pas de niveaux techniques inventés, reste sur les fondamentaux.

FORMAT DE RÉPONSE (JSON pur):
{
  "title": "Titre en Français (Professionnel)",
  "introduction": "Contexte macro global (3-4 phrases sur le sentiment de marché, Risk-On/Off, Dollar Index, Taux US...)",
  "currencies": {
    "CODE_DEVISE": {
      "sentiment": "haussier" | "baissier" | "neutre",
      "emoji": "📈" | "📉" | "➡️",
      "summary": "Analyse approfondie (minimum 5 phrases). Décris la mécanique du mouvement (ex: Data -> Taux -> FX). Cite les chiffres clés de l'article.",
      "factors": ["Driver Macro 1", "Driver Macro 2"]
    }
  },
  "keyTakeaway": "L'insight macro le plus important de la journée pour un trader."
}

IMPORTANT: Réponds UNIQUEMENT avec le JSON valide.`;

  try {
    console.log(`🤖 Generating French summary with Groq (Llama 3)...`);
    
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a financial analyst JSON generator. Output only valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      response_format: { type: "json_object" } // Force JSON mode
    });

    const textResponse = completion.choices[0]?.message?.content;
    
    if (!textResponse) {
      throw new Error('Empty response from Groq API');
    }

    const result = JSON.parse(textResponse);
    
    console.log(`✅ Summary generated with ${Object.keys(result.currencies || {}).length} currency sections`);
    
    return {
      title: result.title || article.title,
      introduction: result.introduction || '',
      currencies: result.currencies || {},
      conclusion: result.conclusion || '',
      keyTakeaway: result.keyTakeaway || '',
      mentionedCurrencies: mentionedCurrencies,
    };

  } catch (error) {
    console.error(`❌ Error summarizing with Groq:`, error.message);
    throw error;
  }
}

/**
 * Fallback: Simple extractive summary (no API needed)
 * @param {object} article - The article object
 * @returns {object} Summary object
 */
function simpleSummary(article) {
  const mentionedCurrencies = detectCurrencies(article.content);
  
  const sentences = article.content
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 50 && s.length < 300);
  
  const introduction = sentences.slice(0, 2).join('. ') + '.';
  
  // Create simple currency sections based on mentioned currencies
  const currencies = {};
  for (const currency of mentionedCurrencies) {
    // Find sentences mentioning this currency
    const currencyMentions = sentences.filter(s => 
      s.toUpperCase().includes(currency)
    ).slice(0, 2);
    
    if (currencyMentions.length > 0) {
      currencies[currency] = {
        sentiment: 'neutre',
        emoji: '➡️',
        summary: currencyMentions.join('. ') + '.',
        factors: ['Analyse complète requiert API IA'],
      };
    }
  }

  return {
    title: article.title,
    introduction: introduction,
    currencies: currencies,
    conclusion: 'Pour un résumé détaillé en français, configurez votre clé API IA.',
    keyTakeaway: 'Résumé automatique - traduction non disponible sans API.',
    mentionedCurrencies: mentionedCurrencies,
  };
}

module.exports = { 
  summarizeWithGroq, 
  simpleSummary, 
  detectCurrencies,
  TRACKED_CURRENCIES,
  CURRENCY_NAMES,
};
