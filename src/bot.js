const TelegramBot = require('node-telegram-bot-api');
const userManager = require('./users');
const sourceManager = require('./source-manager');

class NewsBot {
  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.error('❌ TELEGRAM_BOT_TOKEN not found. Bot cannot start.');
        return;
    }

    this.bot = new TelegramBot(token, { polling: true });
    this.userStates = {}; // { chatId: { action: 'awaiting_tag', sourceId: 'ing' } }
    this.initializeHandlers();
    console.log('🤖 Telegram Bot started in Interactive Mode (Multi-Tags).');
  }

  initializeHandlers() {
    // /start
    this.bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        const name = msg.from.first_name || 'Utilisateur';
        userManager.registerUser(chatId.toString(), name);
        this.sendMainMenu(chatId, `👋 Bonjour <b>${name}</b> !\nQue souhaitez-vous faire ?`);
    });

    // Handle persistent keyboard buttons (Text matches)
    this.bot.on('message', (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;
        if (!text || text.startsWith('/')) return;

        // Persistent Keyboard Logic
        if (text === '📚 Sources') {
            return this.showSources(chatId);
        } else if (text === '📋 Mes Abonnements') {
            return this.showMySubscriptions(chatId);
        }

        // State Machine Logic
        if (this.userStates[chatId] && this.userStates[chatId].action === 'awaiting_tags') {
            const sourceId = this.userStates[chatId].sourceId;
            userManager.subscribe(chatId.toString(), sourceId, text);
            this.bot.sendMessage(chatId, `✅ Abonnements mis à jour pour <b>${sourceId}</b>.`, { 
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: "🏠 Menu Principal", callback_data: "menu_main" }]] }
            });
            delete this.userStates[chatId];
        }
    });

    // Handle button clicks (Inline Keyboard)
    this.bot.on('callback_query', async (callbackQuery) => {
        const message = callbackQuery.message;
        const chatId = message.chat.id;
        const data = callbackQuery.data;

        delete this.userStates[chatId];

        if (data === 'menu_main') {
            this.sendMainMenu(chatId, "🏠 Menu Principal");
        } else if (data === 'menu_sources') {
            this.showSources(chatId);
        } else if (data === 'menu_subs') {
            this.showMySubscriptions(chatId);
        } else if (data === 'menu_search') {
            const text = "🔍 <b>Recherche Historique</b>\n\nPour chercher, tapez simplement :\n<code>/search inflation</code>";
            this.bot.sendMessage(chatId, text, { 
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: "🏠 Menu Principal", callback_data: "menu_main" }]] }
            });
        } else if (data.startsWith('view_')) {
            const sourceId = data.replace('view_', '');
            this.showSourceOptions(chatId, sourceId);
        } else if (data.startsWith('sub_all_')) {
            const sourceId = data.replace('sub_all_', '');
            userManager.subscribe(chatId.toString(), sourceId);
            this.bot.sendMessage(chatId, `✅ Abonné à <b>${sourceId}</b> (Tout le contenu).`, { 
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: "🏠 Menu Principal", callback_data: "menu_main" }]] }
            });
        } else if (data.startsWith('sub_tag_')) {
            const sourceId = data.replace('sub_tag_', '');
            this.userStates[chatId] = { action: 'awaiting_tags', sourceId: sourceId };
            this.bot.sendMessage(chatId, `🏷️ Quels **Tags** pour <code>${sourceId}</code> ?\nVous pouvez en mettre plusieurs (ex: #USD, #Fed, #BCE).`, { 
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: "🔙 Retour", callback_data: `view_${sourceId}` }]] }
            });
        } else if (data.startsWith('unsub_src_')) {
            const sourceId = data.replace('unsub_src_', '');
            userManager.unsubscribe(chatId.toString(), sourceId);
            this.bot.sendMessage(chatId, `❌ Désabonné de la source <b>${sourceId}</b>.`, { 
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: "🏠 Menu Principal", callback_data: "menu_main" }]] }
            });
        } else if (data.startsWith('unsub_tag_')) {
            const parts = data.replace('unsub_tag_', '').split(':');
            const sourceId = parts[0];
            const tag = parts[1];
            userManager.unsubscribe(chatId.toString(), sourceId, tag);
            this.bot.sendMessage(chatId, `❌ Tag <b>${tag}</b> supprimé pour ${sourceId}.`, { 
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: "📋 Retour à mes abonnements", callback_data: "menu_subs" }]] }
            });
        }

        this.bot.answerCallbackQuery(callbackQuery.id);
    });

    this.bot.onText(/\/search (.+)/, (msg, match) => {
        const query = match[1];
        const history = require('./history');
        const results = history.search(query);
        let reply = results.length === 0 ? "📭 Aucun résultat." : `🔍 <b>Résultats pour "${query}" :</b>\n\n`;
        results.slice(0, 5).forEach(r => {
            reply += `🔹 <a href="${r.url}">${r.title}</a>\n🏷️ <i>${r.tags.join(', ')}</i>\n\n`;
        });
        this.bot.sendMessage(msg.chat.id, reply, { 
            parse_mode: 'HTML', 
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: [[{ text: "🏠 Menu Principal", callback_data: "menu_main" }]] }
        });
    });

    // Handle /ask <question> (RAG)
    this.bot.onText(/\/ask (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const question = match[1];
        const { askQuestion } = require('./rag');

        this.bot.sendChatAction(chatId, 'typing');
        
        try {
            const answer = await askQuestion(chatId.toString(), question);
            this.bot.sendMessage(chatId, answer, { 
                parse_mode: 'HTML',
                reply_markup: { 
                    inline_keyboard: [
                        [{ text: "➕ Ajouter une source", callback_data: "menu_sources" }],
                        [{ text: "🏠 Menu Principal", callback_data: "menu_main" }]
                    ] 
                }
            });
        } catch (err) {
            console.error('❌ RAG Command Failed:', err.message);
            this.bot.sendMessage(chatId, "⚠️ Désolé, une erreur technique m'empêche de répondre à votre question pour le moment.");
        }
    });

    this.bot.on('polling_error', (err) => console.log(`[Bot Error] ${err.message}`));
  }

  sendMainMenu(chatId, text) {
    // Note: Inline keyboard and Reply keyboard cannot be in the same message.
    // We send the reply keyboard (persistent) first with the main text.
    this.bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
            resize_keyboard: true,
            is_persistent: true,
            keyboard: [
                [{ text: "📚 Sources" }, { text: "📋 Mes Abonnements" }]
            ]
        }
    });

    // Sub-menu for inline actions (if needed, but persistent menu is better)
    this.bot.sendMessage(chatId, "🛠️ <b>Actions rapides :</b>", {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "📚 Liste des Sources", callback_data: "menu_sources" }],
                [{ text: "📋 Mes Abonnements", callback_data: "menu_subs" }],
                [{ text: "🔍 Chercher (Historique)", callback_data: "menu_search" }]
            ]
        }
    });
  }

  showSources(chatId) {
    const sources = sourceManager.listSources();
    const buttons = sources.map(s => ([{ text: `${s.name}`, callback_data: `view_${s.id}` }]));
    buttons.push([{ text: "🏠 Menu Principal", callback_data: "menu_main" }]);
    this.bot.sendMessage(chatId, "📚 <b>Sources Disponibles :</b>", {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
    });
  }

  showSourceOptions(chatId, sourceId) {
    const buttons = [
        [{ text: "🚀 Tout recevoir", callback_data: `sub_all_${sourceId}` }],
        [{ text: "🏷️ Ajouter des Tags", callback_data: `sub_tag_${sourceId}` }],
        [{ text: "🔙 Retour aux sources", callback_data: "menu_sources" }]
    ];
    this.bot.sendMessage(chatId, `⚙️ <b>Options pour ${sourceId}</b>`, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
    });
  }

  showMySubscriptions(chatId) {
    const user = userManager.users[chatId.toString()];
    if (!user || !user.subscriptions || user.subscriptions.length === 0) {
        this.bot.sendMessage(chatId, "📭 Aucun abonnement.", {
            reply_markup: { inline_keyboard: [[{ text: "🔙 Retour", callback_data: "menu_main" }]] }
        });
        return;
    }

    let reply = "📋 <b>Vos Abonnements :</b>\n\n";
    const buttons = [];

    user.subscriptions.forEach((sub) => {
        reply += `📌 <b>${sub.source}</b>\n`;
        if (!sub.tags || sub.tags.length === 0) {
            reply += `   └─ 🌐 Tout le contenu\n`;
            buttons.push([{ text: `❌ Stopper Source: ${sub.source}`, callback_data: `unsub_src_${sub.source}` }]);
        } else {
            sub.tags.forEach(tag => {
                reply += `   └─ ${tag}\n`;
                buttons.push([{ text: `❌ Retirer ${tag} (${sub.source})`, callback_data: `unsub_tag_${sub.source}:${tag}` }]);
            });
            buttons.push([{ text: `❌ Supprimer toute la source ${sub.source}`, callback_data: `unsub_src_${sub.source}` }]);
        }
        reply += "\n";
    });

    buttons.push([{ text: "🏠 Menu Principal", callback_data: "menu_main" }]);
    
    this.bot.sendMessage(chatId, reply, { 
        parse_mode: 'HTML', 
        reply_markup: { inline_keyboard: buttons } 
    });
  }

  async sendArticle(chatId, article, summary) {
    try {
        let message = `<b>${summary.title}</b>\n\n`;
        message += `<i>${summary.introduction}</i>\n\n`;

        if (summary.currencies && Object.keys(summary.currencies).length > 0) {
            for (const [code, data] of Object.entries(summary.currencies)) {
                const emoji = data.emoji || '➡️';
                const sentiment = (data.sentiment || 'neutre').toUpperCase();
                message += `${emoji} <b>${code}</b> (${sentiment})\n`;
                message += `${data.summary}\n`;
                
                if (data.events && data.events.length > 0) {
                    message += `📅 <i>Events:</i>\n`;
                    data.events.forEach(ev => {
                        const time = ev.date ? new Date(ev.date).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}) : '';
                        const impact = ev.impact === 'High' ? '🔴' : '🟠';
                        message += `• ${time} ${impact} ${ev.title}\n`;
                    });
                }
                message += `\n`;
            }
        } else if (summary.conclusion) {
            message += `💡 <b>Analyse :</b>\n${summary.conclusion}\n\n`;
        }

        message += `💡 <b>Key Takeaway:</b> ${summary.keyTakeaway}\n\n`;
        message += `🔗 <a href="${article.url}">Lire l'article original</a>`;

        await this.bot.sendMessage(chatId, message, { 
            parse_mode: 'HTML', 
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "menu_main" }]] }
        });
    } catch (e) {
        console.error(`❌ Bot failed to send article to ${chatId}:`, e.message);
    }
  }

  async sendToAll(text) {
    const userIds = Object.keys(userManager.users);
    for (const userId of userIds) {
        try {
            await this.bot.sendMessage(userId, text, { parse_mode: 'HTML' });
        } catch (e) {
            console.error(`❌ Failed to send broadcast to ${userId}:`, e.message);
        }
    }
  }
}

module.exports = new NewsBot();
