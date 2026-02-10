const history = require('./history');
const userManager = require('./users');
const Groq = require('groq-sdk');

/**
 * Ask a question to the user's personal news context
 * @param {string} userId - Telegram User ID
 * @param {string} question - The question to ask
 */
async function askQuestion(userId, question) {
    console.log(`🔍 RAG Search for User ${userId}: "${question}"`);

    // 1. Get User Subscriptions
    const user = userManager.users[userId];
    if (!user || !user.subscriptions || user.subscriptions.length === 0) {
        return "⚠️ Vous n'avez aucun abonnement actif. Je ne peux pas chercher d'informations dans votre historique personnel.";
    }

    const subscribedSources = user.subscriptions.map(s => s.source);
    
    // 2. Filter History based on User's Subscriptions
    const allHistory = history.load();
    const userHistory = allHistory.filter(item => {
        // Strict match (new data with IDs)
        if (subscribedSources.includes(item.source)) return true;
        
        // Fuzzy match (old data with siteNames)
        return subscribedSources.some(sub => {
            const cleanSub = sub.toLowerCase().replace(/_/g, '');
            const cleanSource = item.source.toLowerCase().replace(/_/g, '');
            return cleanSource.includes(cleanSub);
        });
    });

    if (userHistory.length === 0) {
        return "📭 Je n'ai trouvé aucun article dans l'historique de vos sources d'abonnement.";
    }

    // 3. Selection of relevant context
    // 3a. Extract potential keywords from the question
    const keywords = question.toLowerCase()
        .replace(/[?.,!]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3); // Ignore small words
    
    // 3b. Filter/Sort history by relevance to keywords
    let contextNews = [];
    if (keywords.length > 0) {
        contextNews = userHistory.filter(item => {
            const text = (item.title + ' ' + item.keyTakeaway + ' ' + item.tags.join(' ')).toLowerCase();
            return keywords.some(k => text.includes(k));
        }).slice(0, 5); // Take top 5 relevant
    }
    
    // 3c. Fill/Add the latest articles as general context
    const latestNews = userHistory.slice(0, 5);
    contextNews = [...new Set([...contextNews, ...latestNews])].slice(0, 10);

    const contextText = contextNews.map(n => 
        `[${n.date}] SOURCE: ${n.source}\nTITRE: ${n.title}\nCLE: ${n.keyTakeaway}\nTAGS: ${n.tags.join(', ')}`
    ).join('\n\n---\n\n');

    // 4. AI Synthesis with Groq
    if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY missing for RAG Search');
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const prompt = `Tu es un assistant expert en Trading Forex. Ton rôle est de répondre aux questions de l'utilisateur en te basant UNIQUEMENT sur l'historique de vos sources d'abonnement (les sources que l'utilisateur a choisies) ci-dessous.

CONTEXTE (Articles récents de vos sources d'abonnement) :
${contextText}

QUESTION : "${question}"

INSTRUCTIONS :
1. Analyse le contexte pour trouver la réponse.
2. IMPORTANT : Ne dis pas "mes sources", dis toujours "vos sources d'abonnement" ou "vos sources actuelles". Utilise UNIQUEMENT des minuscules pour le mot "vos".
3. Si la réponse n'est pas dans le contexte, dis-le poliment en expliquant que vos sources actuelles ne mentionnent pas ce sujet spécifique.
4. Cite les sources (ex: "Selon Reuters...") si possible.
5. Synthétise l'information de façon claire et actionnable pour un trader.
6. Réponds en Français avec des emojis.
7. Si les informations sont manquantes, suggère explicitement à l'utilisateur d'ajouter de nouvelles sources via le bouton ci-dessous.

Réponse :`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.3, // Lower temperature for factual accuracy
        });

        return completion.choices[0]?.message?.content;

    } catch (error) {
        console.error('❌ Groq RAG Failed:', error.message);
        throw error;
    }
}

module.exports = { askQuestion };
