const nodemailer = require('nodemailer');
const { CURRENCY_NAMES } = require('./summarizer');

// Sentiment colors
const SENTIMENT_COLORS = {
  haussier: { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
  baissier: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
  neutre: { bg: '#f3f4f6', text: '#374151', border: '#9ca3af' },
};

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
      
      return `
        <tr>
          <td style="padding: 0 32px 16px 32px;">
            <div style="background: ${colors.bg}; border-left: 4px solid ${colors.border}; padding: 16px 20px; border-radius: 0 12px 12px 0;">
              <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 24px; margin-right: 12px;">${data.emoji || '💱'}</span>
                <div>
                  <h4 style="color: ${colors.text}; margin: 0; font-size: 16px; font-weight: 700;">
                    ${code} - ${currencyName}
                  </h4>
                  <span style="color: ${colors.text}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${data.sentiment}
                  </span>
                </div>
              </div>
              <p style="color: #374151; margin: 8px 0 12px 0; font-size: 14px; line-height: 1.6;">
                ${data.summary}
              </p>
              ${data.factors && data.factors.length > 0 ? `
                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                  ${data.factors.map(factor => `
                    <span style="background: rgba(255,255,255,0.7); color: #4b5563; padding: 4px 10px; border-radius: 16px; font-size: 11px;">
                      ${factor}
                    </span>
                  `).join('')}
                </div>
              ` : ''}
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
  <title>📊 FX Daily - ${summary.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Header -->
        <table role="presentation" style="max-width: 600px; width: 100%; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%); border-radius: 16px 16px 0 0;">
          <tr>
            <td style="padding: 32px; text-align: center;">
              <div style="font-size: 40px; margin-bottom: 8px;">📊</div>
              <h1 style="color: #f1f5f9; margin: 0; font-size: 22px; font-weight: 600;">
                FX Daily Newsletter
              </h1>
              <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 13px;">
                ${date} • Source: ING Think
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Main Content -->
        <table role="presentation" style="max-width: 600px; width: 100%; background: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Title -->
          <tr>
            <td style="padding: 28px 32px 12px 32px;">
              <h2 style="color: #1e293b; margin: 0; font-size: 20px; font-weight: 700; line-height: 1.3;">
                ${summary.title}
              </h2>
            </td>
          </tr>
          
          <!-- Introduction -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <p style="color: #475569; margin: 0; font-size: 15px; line-height: 1.7; border-left: 3px solid #3b82f6; padding-left: 16px;">
                ${summary.introduction}
              </p>
            </td>
          </tr>
          
          <!-- Currency Sections Header -->
          <tr>
            <td style="padding: 8px 32px 16px 32px;">
              <h3 style="color: #1e293b; margin: 0; font-size: 16px; font-weight: 600; display: flex; align-items: center;">
                <span style="margin-right: 8px;">💱</span> Analyse par Devise
              </h3>
            </td>
          </tr>
          
          <!-- Currency Sections -->
          ${currencySectionsHTML || `
            <tr>
              <td style="padding: 0 32px 24px 32px;">
                <p style="color: #64748b; font-style: italic;">Aucune devise majeure spécifiquement analysée dans cet article.</p>
              </td>
            </tr>
          `}
          
          <!-- Key Takeaway -->
          ${summary.keyTakeaway ? `
          <tr>
            <td style="padding: 8px 32px 24px 32px;">
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 12px;">
                <h3 style="color: #92400e; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">
                  💡 Point Clé à Retenir
                </h3>
                <p style="color: #78350f; margin: 0; font-size: 14px; line-height: 1.6; font-weight: 500;">
                  ${summary.keyTakeaway}
                </p>
              </div>
            </td>
          </tr>
          ` : ''}
          
          <!-- Conclusion -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <div style="background: #f1f5f9; padding: 16px 20px; border-radius: 8px;">
                <h3 style="color: #475569; margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">
                  📈 Perspectives
                </h3>
                <p style="color: #334155; margin: 0; font-size: 14px; line-height: 1.6;">
                  ${summary.conclusion}
                </p>
              </div>
            </td>
          </tr>
          
          <!-- CTA Button -->
          <tr>
            <td style="padding: 8px 32px 32px 32px; text-align: center;">
              <a href="${article.url}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 14px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(249, 115, 22, 0.4);">
                Lire l'article original (EN) →
              </a>
            </td>
          </tr>
        </table>
        
        <!-- Footer -->
        <table role="presentation" style="max-width: 600px; width: 100%; background: #1e293b; border-radius: 0 0 16px 16px;">
          <tr>
            <td style="padding: 24px 32px; text-align: center;">
              <p style="color: #94a3b8; margin: 0 0 8px 0; font-size: 12px;">
                Newsletter FX générée automatiquement depuis ING Think
              </p>
              <p style="color: #64748b; margin: 0; font-size: 11px;">
                Devises suivies: USD • EUR • GBP • JPY • AUD • NZD • CAD • CHF • CNY
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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

