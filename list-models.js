require('dotenv').config();
const axios = require('axios');

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('\n📋 SEARCHING AVAILABLE MODELS...');
  
  try {
    const response = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    const models = response.data.models;
    console.log(`✅ Found ${models.length} models. Supported ones:`);
    
    models.forEach(m => {
      if (m.supportedGenerationMethods.includes('generateContent')) {
        console.log(`   - ${m.name.replace('models/', '')}`);
      }
    });

  } catch (error) {
    console.error(`❌ Error listing models: ${error.message}`);
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    }
  }
}

listModels();
