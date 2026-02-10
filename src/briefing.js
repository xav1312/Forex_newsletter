const history = require('./history');
const { getEconomicEvents } = require('./economics');
const Groq = require('groq-sdk');

/**
 * Generate a personalized Morning Briefing synthesis
 * @param {Array} userSubscriptions - Array of { source, tags } for the user
 */
async function generateBriefing(userSubscriptions = []) {
    console.log('☕ Generating Personalized Morning Briefing...');

    // 1. Get news from the last 24 hours
    const allHistory = history.load();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const recentNews = allHistory.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= twentyFourHoursAgo;
    });

    // 2. Extract user's target tags for prioritization
    const userTags = new Set();
    userSubscriptions.forEach(sub => {
        if (sub.tags && sub.tags.length > 0) {
            sub.tags.forEach(t => userTags.add(t.toLowerCase()));
        }
    });

    console.log(`   Found ${recentNews.length} articles. User interested in: ${Array.from(userTags).join(', ') || 'Tout'}`);

    // 3. Get today's economic calendar
    const todayEvents = await getEconomicEvents(new Date());
    
    // Filter calendar events to highlight those relevant to user's interested currencies/tags
    // (Economic events usually have a 'currency' or 'country' field)
    const relevantEvents = todayEvents.filter(e => {
        const currencyTag = `#${e.currency}`.toLowerCase();
        return userTags.size === 0 || userTags.has(currencyTag) || userTags.has(e.currency.toLowerCase());
    });

    // 4. AI Synthesis
    if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY missing for Morning Briefing');
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const newsSummary = recentNews.map(n => `- [${n.source}] ${n.title} (Tags: ${n.tags.join(', ')})`).join('\n');
    const calendarSummary = todayEvents.map(e => `- ${e.country} [${e.impact}] : ${e.title}`).join('\n');

    const interestsText = userTags.size > 0 
        ? `L'utilisateur s'intéresse particulièrement aux actifs suivants : ${Array.from(userTags).join(', ')}.`
        : "L'utilisateur s'intéresse à l'ensemble du marché Forex sans filtre spécifique.";

    const prompt = `Tu es un analyste macro senior. Voici l'actualité des dernières 24h et le calendrier économique du jour pour les marchés Forex.

${interestsText}

ACTUALITÉ RÉCENTE (Synthèse) :
${newsSummary || 'Aucune news majeure enregistrée.'}

CALENDRIER ÉCO DU JOUR :
${calendarSummary || "Aucun événement majeur aujourd'hui."}

MISSION : Rédige un "Morning Briefing" PERSONNALISÉ pour ce trader.
IMPORTANT : Oriente ton résumé et tes priorités en fonction des intérêts spécifiques mentionnés ci-dessus si possible, tout en gardant une vision macro globale si des événements majeurs hors-sujet impactents le marché.

Le style doit être : Professionnel, concis, direct, stratégique.

STRUCTURE DE RÉPONSE :
1. **Rétrospective 24h** : En 3 phrases, résume l'humeur globale du marché.
2. **Top News (Priorité Intérêts)** : Cite les 3 faits les plus marquants pour ce profil spécifique.
3. **Plan de Chasse (Focus Jour)** : Quels actifs surveiller aujourd'hui selon le calendrier (en insistant sur ses intérêts) ?
4. **Sentiment Global** : (ex: Bullish USD, Risk-Off, etc.)

Réponds en Français, avec des emojis pour la lisibilité.
`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.5,
        });

        const briefingText = completion.choices[0]?.message?.content;
        return briefingText;

    } catch (error) {
        console.error('❌ Groq Briefing Failed:', error.message);
        throw error;
    }
}

module.exports = { generateBriefing };
