const nodemailer = require('nodemailer');
const { CURRENCY_NAMES } = require('./summarizer');
// Force git sync update

// Sentiment colors
const SENTIMENT_COLORS = {
  haussier: { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
  baissier: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
  neutre: { bg: '#f3f4f6', text: '#374151', border: '#9ca3af' },
};

const COUNTRY_MAP = {
  'USD': 'united-states',
  'EUR': 'euro-area',
  'GBP': 'united-kingdom',
  'JPY': 'japan',
  'AUD': 'australia',
  'NZD': 'new-zealand',
  'CAD': 'canada',
  'CHF': 'switzerland',
  'CNY': 'china'
};

const INDICATOR_MAP = [
  { keywords: ['Interest Rate', 'Decision', 'Rate'], slug: 'interest-rate' },
  { keywords: ['Inflation', 'CPI'], slug: 'inflation-rate' },
  { keywords: ['GDP'], slug: 'gdp-growth' },
  { keywords: ['Unemployment', 'Job'], slug: 'unemployment-rate' },
  { keywords: ['Retail Sales'], slug: 'retail-sales' },
  { keywords: ['PMI', 'Manufacturing'], slug: 'manufacturing-pmi' },
  { keywords: ['Services'], slug: 'services-pmi' },
  { keywords: ['Trade Balance'], slug: 'balance-of-trade' },
  { keywords: ['Consumer Confidence', 'Sentiment'], slug: 'consumer-confidence' },
  { keywords: ['Building Permits', 'Housing'], slug: 'building-permits' },
  { keywords: ['Producer Prices', 'PPI'], slug: 'producer-prices' },
];

function getTradingEconomicsLink(currency, title) {
  const countrySlug = COUNTRY_MAP[currency];
  if (!countrySlug) return null;

  const indicator = INDICATOR_MAP.find(ind => 
    ind.keywords.some(k => title.toLowerCase().includes(k.toLowerCase()))
  );

  if (indicator) {
    return `https://tradingeconomics.com/${countrySlug}/${indicator.slug}`;
  }
  
  // No generic search fallback to keep it clean (only show button if valid indicator)
  return null;
}

/**
 * Create an HTML email template for the FX newsletter
 * @param {object} article - Original article data
 * @param {object} summary - Summary data with currency sections
 * @returns {string} HTML content
 */
function createNewsletterHTML(article, summary) {
  const date = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Generate currency sections HTML
  const currencySectionsHTML = Object.entries(summary.currencies || {})
    .map(([code, data]) => {
      const colors = SENTIMENT_COLORS[data.sentiment] || SENTIMENT_COLORS.neutre;
      const currencyName = CURRENCY_NAMES[code] || code;
      
      // Economic events HTML (avec lien historique)
      let eventsHtml = '';
      if (data.events && data.events.length > 0) {
        eventsHtml = `
          <div style="margin-top: 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <h5 style="margin: 0 0 10px 0; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">
              📅 CALENDRIER ÉCO (48H GLISSANTES)
            </h5>
            <ul style="margin: 0; padding: 0; list-style: none;">
              ${data.events.map(event => {
                const time = event.date ? new Date(event.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : '';
                const impactIcon = event.impact === 'High' ? '🔴' : '🟠';
                
                // Smart Link Generation
                const teLink = getTradingEconomicsLink(code, event.title);
                const buttonHtml = teLink ? `
                  <a href="${teLink}" style="font-size: 11px; color: #3b82f6; text-decoration: none; border: 1px solid #3b82f6; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">
                    📊 Graph
                  </a>` : '';
                
                return `
                <li style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 13px; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9;">
                  <div style="display: flex; align-items: center;">
                    <span style="min-width: 45px; font-weight: 600; color: #1e293b;">${time}</span>
                    <span style="font-size: 10px; margin-right: 8px;">${impactIcon}</span>
                    <span style="color: #334155; font-weight: 500;">${event.title}</span>
                  </div>
                  ${buttonHtml}
                </li>
                `;
              }).join('')}
            </ul>
          </div>
        `;
      }

      return `
        <tr>
          <td style="padding: 0 32px 16px 32px;">
            <div style="background: ${colors.bg}; border-left: 4px solid ${colors.border}; padding: 20px; border-radius: 0 12px 12px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <div style="display: flex; align-items: center; margin-bottom: 12px;">
                <span style="font-size: 28px; margin-right: 16px;">${data.emoji || '💱'}</span>
                <div>
                  <h4 style="color: ${colors.text}; margin: 0; font-size: 18px; font-weight: 800;">
                    ${code} <span style="font-weight: 400; opacity: 0.8; font-size: 14px;">- ${currencyName}</span>
                  </h4>
                  <span style="background: ${colors.text}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">
                    ${data.sentiment}
                  </span>
                </div>
              </div>
              
              <p style="color: #334155; margin: 0 0 12px 0; font-size: 15px; line-height: 1.8; text-align: left;">
                ${data.summary}
              </p>

              ${data.factors && data.factors.length > 0 ? `
                <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px;">
                  ${data.factors.map(factor => `
                    <span style="background: white; border: 1px solid ${colors.border}; color: ${colors.text}; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">
                      # ${factor}
                    </span>
                  `).join('')}
                </div>
              ` : ''}
              
              ${eventsHtml}
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FX Daily - ${summary.title}</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background-color: #f3f4f6; color: #374151; }
    .container { max-width: 600px; margin: 0 auto; background-color: #f3f4f6; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px 20px; text-align: center; border-radius: 0 0 16px 16px; margin-bottom: 24px; color: white; }
    .card { background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .card-title { margin: 0 0 12px 0; color: #111827; font-size: 18px; font-weight: 700; display: flex; align-items: center; justify-content: space-between; }
    .sentiment-badge { font-size: 11px; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
    .text-content { line-height: 1.6; color: #4b5563; font-size: 15px; margin: 0 0 12px 0; }
    .calendar-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-top: 16px; }
    .calendar-title { font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .event-item { display: flex; align-items: center; justify-content: space-between; font-size: 13px; padding: 6px 0; }
    .btn-graph { font-size: 10px; color: #2563eb; text-decoration: none; border: 1px solid #dbeafe; padding: 2px 8px; border-radius: 4px; background: #eff6ff; }
    .footer { text-align: center; padding: 24px; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    
    <!-- HEADER -->
    <div class="header">
      <div style="font-size: 32px; margin-bottom: 8px;">📊</div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">FX Daily Briefing</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">${date}</p>
    </div>

    <!-- MAIN SUMMARY CARD -->
    <div style="padding: 0 16px;">
      <div class="card" style="border-top: 4px solid #3b82f6;">
        <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #111827;">${summary.title}</h2>
        <p class="text-content" style="font-size: 16px;">${summary.introduction}</p>
        
        ${summary.keyTakeaway ? `
        <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 16px; margin-top: 16px; border-radius: 0 4px 4px 0;">
          <strong style="color: #1e40af; display: block; font-size: 12px; text-transform: uppercase; margin-bottom: 4px;">💡 Insight du Jour</strong>
          <span style="color: #1e3a8a; font-weight: 500;">${summary.keyTakeaway}</span>
        </div>
        ` : ''}
      </div>

      <!-- CURRENCY CARDS -->
      <div style="margin: 24px 0 12px 0; padding-left: 8px;">
        <h3 style="font-size: 14px; text-transform: uppercase; color: #6b7280; font-weight: 700; letter-spacing: 1px; margin: 0;">Analyse par Devise</h3>
      </div>

      ${Object.entries(summary.currencies || {}).map(([code, data]) => {
        const colors = SENTIMENT_COLORS[data.sentiment] || SENTIMENT_COLORS.neutre;
        const currencyName = CURRENCY_NAMES[code] || code;
        const badgeStyle = `background:${colors.bg}; color:${colors.text};`;
        
        // Calendar logic inside map
        let eventsHtml = '';
        if (data.events && data.events.length > 0) {
          eventsHtml = `
            <div class="calendar-box">
              <div class="calendar-title">📅 Calendrier Éco</div>
              ${data.events.map(event => {
                const time = event.date ? new Date(event.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : '';
                const impactIcon = event.impact === 'High' ? '🔴' : '🟠';
                const teLink = getTradingEconomicsLink(code, event.title);
                const buttonHtml = teLink ? `<a href="${teLink}" class="btn-graph">Graph ↗</a>` : '';
                
                return `
                <div class="event-item">
                  <div style="display:flex; align-items:center; flex:1;">
                    <span style="font-weight:600; color:#111827; width:45px;">${time}</span>
                    <span style="margin-right:8px; font-size:10px;">${impactIcon}</span>
                    <span style="color:#4b5563;">${event.title}</span>
                  </div>
                  ${buttonHtml}
                </div>`;
              }).join('')}
            </div>`;
        }

        return `
        <div class="card" style="border-left: 4px solid ${colors.border};">
          <div class="card-title">
            <div style="display:flex; align-items:center;">
              <span style="font-size:24px; margin-right:12px;">${data.emoji}</span>
              <div>
                <span style="display:block;">${code}</span>
                <span style="display:block; font-size:12px; font-weight:400; color:#6b7280;">${currencyName}</span>
              </div>
            </div>
            <span class="sentiment-badge" style="${badgeStyle}">${data.sentiment}</span>
          </div>
          
          <p class="text-content">${data.summary}</p>
          
          ${data.factors && data.factors.length > 0 ? `
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">
              ${data.factors.map(f => `<span style="background:#f3f4f6; color:#4b5563; font-size:11px; padding:2px 8px; border-radius:4px;"># ${f}</span>`).join('')}
            </div>` : ''}
            
          ${eventsHtml}
        </div>`;
      }).join('')}

      <!-- CONCLUSION CARD -->
      <div class="card" style="background: #f8fafc; border: 1px dashed #cbd5e1;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #374151;">🎯 Conclusion</h3>
        <p class="text-content">${summary.conclusion}</p>
      </div>

      <div style="text-align:center; margin: 30px 0;">
        <a href="${article.url}" style="background:#2563eb; color:white; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600; font-size:14px;">Lire l'article original</a>
      </div>

    </div>

    <!-- FOOTER -->
    <div class="footer">
      <p>Généré automatiquement par Antigravity • Source: ING Think</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Send the newsletter email using Resend API
 * @param {object} article - Article data
 * @param {object} summary - Summary data
 * @param {object} emailConfig - Email configuration
 */
async function sendWithResend(article, summary, emailConfig) {
  const { Resend } = require('resend');
  const resendApiKey = process.env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY not found');
  }

  const resend = new Resend(resendApiKey);
  const htmlContent = createNewsletterHTML(article, summary);

  const { to } = emailConfig;
  
  // With free tier, you can only send from onboarding@resend.dev
  // Or you need to verify your own domain
  const fromEmail = process.env.RESEND_FROM || 'FX Newsletter <onboarding@resend.dev>';

  console.log(`📧 Sending newsletter via Resend to: ${to}`);

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [to],
    subject: `📊 FX Daily: ${summary.title}`,
    html: htmlContent,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  console.log(`✅ Email sent via Resend: ${data.id}`);
  return data;
}

/**
 * Send the newsletter email using SMTP (nodemailer)
 * @param {object} article - Article data
 * @param {object} summary - Summary data
 * @param {object} emailConfig - Email configuration
 */
async function sendWithSMTP(article, summary, emailConfig) {
  const nodemailer = require('nodemailer');
  
  const {
    to,
    from = process.env.EMAIL_FROM,
    smtpHost = process.env.SMTP_HOST,
    smtpPort = process.env.SMTP_PORT || 587,
    smtpUser = process.env.SMTP_USER,
    smtpPass = process.env.SMTP_PASSWORD,
  } = emailConfig;

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error('SMTP configuration missing');
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort),
    secure: parseInt(smtpPort) === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const htmlContent = createNewsletterHTML(article, summary);
  const currencyText = Object.entries(summary.currencies || {})
    .map(([code, data]) => `\n${data.emoji} ${code}: ${data.sentiment}\n${data.summary}`)
    .join('\n');

  console.log(`📧 Sending newsletter via SMTP to: ${to}`);

  const info = await transporter.sendMail({
    from: from || `"FX Newsletter" <${smtpUser}>`,
    to: to,
    subject: `📊 FX Daily: ${summary.title}`,
    html: htmlContent,
    text: `${summary.title}\n\n${summary.introduction}\n\n--- Analyse par Devise ---${currencyText}\n\n💡 À retenir: ${summary.keyTakeaway}\n\nLire l'article: ${article.url}`,
  });

  console.log(`✅ Email sent via SMTP: ${info.messageId}`);
  return info;
}

/**
 * Send the newsletter email (tries Resend first, then SMTP)
 * @param {object} article - Article data
 * @param {object} summary - Summary data
 * @param {object} emailConfig - Email configuration
 */
async function sendNewsletter(article, summary, emailConfig) {
  const { to } = emailConfig;

  if (!to) {
    throw new Error('Recipient email address is required');
  }

  // Try Resend first (works on all networks)
  if (process.env.RESEND_API_KEY) {
    try {
      return await sendWithResend(article, summary, emailConfig);
    } catch (error) {
      console.error(`⚠️  Resend failed: ${error.message}`);
      console.log(`   Trying SMTP fallback...`);
    }
  }

  // Fallback to SMTP
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return await sendWithSMTP(article, summary, emailConfig);
  }

  throw new Error('No email provider configured. Set RESEND_API_KEY or SMTP settings in .env');
}

/**
 * Preview the newsletter (returns HTML without sending)
 */
function previewNewsletter(article, summary) {
  return createNewsletterHTML(article, summary);
}

module.exports = { sendNewsletter, previewNewsletter, createNewsletterHTML };

