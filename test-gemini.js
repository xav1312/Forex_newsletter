require('dotenv').config();
const axios = require('axios');

async function testGeminiConnection() {
  const apiKey = process.env.GEMINI_API_KEY;

  console.log('\n🧪 TEST DE CONNEXION GEMINI');
  console.log('---------------------------');

  if (!apiKey) {
    console.error('❌ ERREUR : Aucune clé GEMINI_API_KEY trouvée dans le fichier .env');
    return;
  }

  console.log(`🔑 Clé trouvée : ${apiKey.substring(0, 10)}...`);
  console.log('📡 Envoi d\'une requête de test...');

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: "Réponds juste par le mot 'OK' si tu me reçois." }] }]
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const reply = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (reply) {
      console.log('\n✅ SUCCÈS ! L\'API Gemini fonctionne parfaitement.');
      console.log(`🤖 Réponse de l'IA : "${reply.trim()}"`);
    } else {
      console.log('\n⚠️  Bizarre : L\'API a répondu mais sans texte.');
    }

  } catch (error) {
    console.error('\n❌ ÉCHEC DU TEST');
    if (error.response) {
      console.error(`🔴 Code Erreur : ${error.response.status}`);
      console.error(`📜 Détail : ${JSON.stringify(error.response.data, null, 2)}`);
      
      if (error.response.status === 429) {
        console.error('\n⚠️  C\'est une erreur de QUOTA (Rate Limit).');
        console.error('   Attendez quelques minutes ou vérifiez votre compte Google Cloud.');
      }
    } else {
      console.error(`🔴 Erreur : ${error.message}`);
    }
  }
}

testGeminiConnection();
