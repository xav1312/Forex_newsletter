const axios = require('axios');

// Currencies to track
// Currencies to track (G10 + Whitelist)
const TRACKED_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'CHF', 'AUD', 'NZD', 'CNY'];

// Currency display names in French
const CURRENCY_NAMES = {
  USD: 'Dollar américain',
  EUR: 'Euro',
  GBP: 'Livre sterling',
  JPY: 'Yen japonais',
  CAD: 'Dollar canadien',
  CHF: 'Franc suisse',
  AUD: 'Dollar australien',
  NZD: 'Dollar néo-zélandais',
  CNY: 'Yuan chinois',
};

/**
 * Detect which currencies are mentioned in the article content
 * @param {string} content - Article content
 * @returns {string[]} Array of mentioned currency codes
 */
function detectCurrencies(content) {
  const mentioned = [];
  
  for (const currency of TRACKED_CURRENCIES) {
    // Look for the ING header pattern: Code: Heading
    // Example: "USD: Dollar licks its wounds" or "EUR: 1.19"
    // We check for the code at the start of a line or after significant whitespace
    const headerRegex = new RegExp(`(^|\\n)\\s*\\b${currency}\\b\\s*:`, 'i');
    const isInHeading = headerRegex.test(content);
    
    // Fallback: If not a heading, it must be mentioned frequently (at least 3-4 times)
    // to be considered a "main topic".
    const occurrenceRegex = new RegExp(`\\b${currency}\\b`, 'gi');
    const matches = content.match(occurrenceRegex);
    const frequentMention = matches && matches.length >= 4;
    
    if (isInHeading || frequentMention) {
      mentioned.push(currency);
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
  console.log(`   Currencies detected for analysis: ${mentionedCurrencies.join(', ') || 'none'}`);

  // Select prompt based on source type
  let prompt;
  
  if (options.sourceType === 'general_news') {
    console.log('   ℹ️ Using GENERAL NEWS prompt');
    prompt = `Tu es un analyste économique senior. Ta mission est de résumer cette actualité pour des traders.

ARTICLE SOURCE :
Titre: ${article.title}
Contenu: ${article.content.substring(0, 15000)}

INSTRUCTIONS :
1. Résume l'événement principal en 3-4 phrases percutantes.
2. Identifie l'impact probable sur les marchés (Devises, Matières Premières, Actions).
3. Adapte le ton : Professionnel, factuel, direct.

FORMAT DE RÉPONSE (JSON pur):
{
  "title": "Titre pro en Français",
  "introduction": "Le fait marquant (Summary)",
  "currencies": {}, 
  "keyTakeaway": "L'impact majeur à retenir (1 phrase)",
  "conclusion": "Analyse d'impact (Bullish/Bearish pour quels actifs ?)",
  "tags": ["#Tag1", "#Tag2"]
}

IMPORTANT: Réponds UNIQUEMENT avec le JSON.
CONSIGNES TAGS : N'utilise #USD que si l'article traite spécifiquement de l'économie US ou de la Fed. Si l'article traite d'une autre devise (ex: JPY) sans impact majeur US, ne mets pas #USD.`;

  } else {
    // Default: FX Daily breakdown (ING style)
    console.log('   ℹ️ Using FX DAILY breakdown prompt');
    prompt = `Tu es un Stratège Macro FX Senior chez ING. Ta mission est de résumer l'analyse "FX Daily" pour des clients institutionnels.

ARTICLE SOURCE :
Titre: ${article.title}
Contenu: ${article.content.substring(0, 25000)}

INSTRUCTIONS CRITIQUES :
1. **FIDÉLITÉ ABSOLUE AU SENTIMENT** : 
   - L'article contient des marqueurs explicites comme **[SENTIMENT: HAUSSIER]**, **[SENTIMENT: BAISSIER]** ou **[SENTIMENT: NEUTRE]**.
   - Ces marqueurs sont la SOURCE DE VÉRITÉ ABSOLUE. Tu DOIS les utiliser pour définir le sentiment de la section correspondante.
   - Si un tel marqueur est présent au début d'une section, ignore toute autre contradiction textuelle et utilise-le.
   - En l'absence de marqueur, identifie les cibles numériques et le langage directionnel ("work its way higher" -> haussier, "targets 1.17" -> baissier).
2. **RESTRICTION DE DEVISES** : Ne génère de sections QUE pour : ${mentionedCurrencies.join(', ')}.
3. **TONALITÉ** : Professionnelle, macro-économique, précise. Cite les chiffres clés.
4. **CONTENU** : Environ 80 mots par devise. Explique la logique macro.

FORMAT DE RÉPONSE (JSON pur):
{
  "title": "Titre pro en Français",
  "introduction": "Contexte macro global (3-4 phrases).",
  "currencies": {
    "CODE": {
      "sentiment": "haussier" | "baissier" | "neutre",
      "emoji": "📈" | "📉" | "➡️",
      "summary": "Analyse détaillée (min 5 phrases). Doit correspondre EXACTEMENT à l'opinion de la source.",
      "factors": ["Facteur 1", "Facteur 2"]
    }
  },
  "conclusion": "Direction probable des prochaines sessions.",
  "keyTakeaway": "L'insight le plus important pour un trader.",
  "tags": ["#Tag1", "#Tag2"]
}

IMPORTANT: Réponds UNIQUEMENT avec le JSON.
CONSIGNES TAGS : N'utilise #USD que si l'article traite spécifiquement de l'économie US ou de la Fed.`;
  }

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
      tags: result.tags || mentionedCurrencies,
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
    tags: mentionedCurrencies.map(c => `#${c}`), // Naive tagging
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
