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
    this.initializeHandlers();
    console.log('🤖 Telegram Bot started in Polling mode.');
  }

  initializeHandlers() {
    // /start
    this.bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        const name = msg.from.first_name;
        
        userManager.registerUser(chatId.toString(), name);
        
        const welcomeMsg = `👋 Bonjour ${name} !\n\n` +
                           `Je suis votre assistant Forex AI. 🤖\n` +
                           `Je surveille les marchés et je vous envoie des analyses filtrées par IA.\n\n` +
                           `📌 **Commandes disponibles :**\n` +
                           `/sources - Voir les sources disponibles\n` +
                           `/subscribe <source> [tag] - S'abonner (ex: /subscribe ing #USD)\n` +
                           `/mysubs - Voir mes abonnements\n` +
                           `/search <term> - Chercher dans l'historique`;
        
        this.bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });
    });

    // /sources
    this.bot.onText(/\/sources/, (msg) => {
        const sources = sourceManager.listSources();
        let reply = "📚 **Sources Disponibles :**\n\n";
        sources.forEach(s => {
            reply += `🔹 \`${s.id}\` : ${s.name} (${s.type})\n`;
        });
        this.bot.sendMessage(msg.chat.id, reply, { parse_mode: 'Markdown' });
    });

    // /subscribe
    this.bot.onText(/\/subscribe (.+)/, (msg, match) => {
        const chatId = msg.chat.id.toString();
        const args = match[1].split(' '); // e.g. ["ing", "#USD"]
        const sourceId = args[0];
        const tag = args[1]; // Optional

        try {
            // Validate Source
            sourceManager.getSource(sourceId); // Throws if invalid
            
            userManager.subscribe(chatId, sourceId, tag);
            
            let reply = `✅ Abonnement confirmé pour **${sourceId}**`;
            if (tag) reply += ` (Filtre: ${tag})`;
            else reply += ` (Tout le contenu)`;
            
            this.bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' });

        } catch (e) {
            this.bot.sendMessage(chatId, `❌ Erreur : Source inconnue '${sourceId}'. Utilisez /sources pour voir la liste.`);
        }
    });

    // /mysubs
    this.bot.onText(/\/mysubs/, (msg) => {
        const user = userManager.users[msg.chat.id.toString()];
        if (!user || user.subscriptions.length === 0) {
            this.bot.sendMessage(msg.chat.id, "📭 Aucun abonnement actif.");
            return;
        }

        let reply = "📋 **Vos Abonnements :**\n\n";
        user.subscriptions.forEach((sub, i) => {
            reply += `${i+1}. **${sub.source}** ${sub.tag ? `(Tag: ${sub.tag})` : '(All)'}\n`;
        });
        this.bot.sendMessage(msg.chat.id, reply, { parse_mode: 'Markdown' });
    });
    
    // Error Handling
    this.bot.on('polling_error', (error) => {
      console.log(`[Polling Error] ${error.code}: ${error.message}`);
    });
  }
}

module.exports = new NewsBot();
