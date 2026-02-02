require('dotenv').config();
const axios = require('axios');

async function getUpdates() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.error('❌ Error: Please set TELEGRAM_BOT_TOKEN in your .env file first.');
    return;
  }

  console.log('🔍 Checking for messages to your bot...');
  
  try {
    const url = `https://api.telegram.org/bot${token}/getUpdates`;
    const response = await axios.get(url);
    const updates = response.data.result;

    if (updates.length === 0) {
      console.log('---------------------------------------------------');
      console.log('⚠️ No messages found.');
      console.log('👉 Please open your bot in Telegram and send a message (e.g., /start or "Hello").');
      console.log('   Then run this script again.');
      console.log('---------------------------------------------------');
    } else {
      console.log('✅ Found messages! Here are the Chat IDs:');
      console.log('---------------------------------------------------');
      updates.forEach(u => {
        const chat = u.message?.chat || u.my_chat_member?.chat;
        if (chat) {
          console.log(`👤 User: ${chat.first_name} (${chat.username || 'No username'})`);
          console.log(`🆔 CHAT_ID: ${chat.id}`);
          console.log('---------------------------------------------------');
        }
      });
      console.log('👉 Copy the CHAT_ID and add it to your .env file as TELEGRAM_CHAT_ID=...');
    }
  } catch (error) {
    console.error('❌ Error fetching updates:', error.message);
    if (error.response?.status === 401) {
      console.error('   -> Your Bot Token seems invalid. Please check it.');
    }
  }
}

getUpdates();
