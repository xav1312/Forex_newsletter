const axios = require('axios');
const { getTradingEconomicsLink } = require('./economics');

/**
 * Send a simple text message to the configured Telegram chat
 * @param {string} text - The message to send
 * @returns {Promise<void>}
 */
async function sendMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('⚠️ Telegram not configured (missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID). Skipping.');
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await axios.post(url, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML', // Allows bolding, links, etc.
      disable_web_page_preview: true
    });
    console.log('✅ Telegram message sent successfully.');
  } catch (error) {
    console.error('❌ Error sending Telegram message:', error.response?.data || error.message);
  }
}

/**
 * Format and send the full newsletter to Telegram
 * @param {object} analysis - The AI generated analysis JSON
 * @param {string} articleUrl - Original link
 */
async function sendNewsletter(analysis, articleUrl) {
  if (!analysis) return;

  // 1. Header with Title
  let message = `<b>${analysis.title}</b>\n\n`;
  message += `<i>${analysis.introduction}</i>\n\n`;

  // 2. Iterate over currencies (if available and valid)
  if (analysis.currencies && Object.keys(analysis.currencies).length > 0) {
    for (const [code, data] of Object.entries(analysis.currencies)) {
      // Check if data has the expected structure (for FX Daily)
      if (data && data.sentiment) {
        const emoji = data.emoji || '➡️';
        const sentiment = data.sentiment ? data.sentiment.toUpperCase() : 'NEUTRE';
        message += `${emoji} <b>${code}</b> (${sentiment})\n`;
        message += `${data.summary || 'Pas de détails.'}\n`;

        // Add Economic Calendar if events exist
        if (data.events && data.events.length > 0) {
           message += `\n📅 <i>Calendrier Éco :</i>\n`;
           data.events.forEach(event => {
             const time = event.date ? new Date(event.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : '';
             const impact = event.impact === 'High' ? '🔴' : '🟠';
             const teLink = getTradingEconomicsLink(code, event.title);
             const linkHtml = teLink ? ` <a href="${teLink}">[Graph ↗]</a>` : '';
             
             message += `• ${time} ${impact} ${event.title}${linkHtml}\n`;
           });
        }
        message += `\n`; // Spacing between currencies
      }
    }
  } else if (analysis.conclusion) {
      // If no specific currencies, show the main analysis/conclusion
      message += `<b>Analyse :</b>\n${analysis.conclusion}\n\n`;
  }

  // 3. Conclusion & Takeaway
  message += `💡 <b>Key Takeaway:</b> ${analysis.keyTakeaway}\n\n`;
  message += `🔗 <a href="${articleUrl}">Lire l'article original</a>`;

  // Send the formatted message
  await sendMessage(message);
}

module.exports = { sendMessage, sendNewsletter };
