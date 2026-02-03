const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, '..', 'users.json');

class UserManager {
  constructor() {
    this.ensureFileExists();
    this.users = this.load();
  }

  ensureFileExists() {
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify({}, null, 2));
    }
  }

  load() {
    try {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.error('❌ Failed to load users:', e.message);
      return {};
    }
  }

  save() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(this.users, null, 2));
  }

  /**
   * Register or update a user
   * @param {string} userId - Telegram Chat ID
   * @param {string} firstName - User's first name
   */
  registerUser(userId, firstName) {
    if (!this.users[userId]) {
      this.users[userId] = {
        id: userId,
        name: firstName,
        joinedAt: new Date().toISOString(),
        subscriptions: [] // Array of { source: 'ing', tags: ['#USD'] }
      };
      this.save();
      console.log(`👤 New user registered: ${firstName} (${userId})`);
    }
  }

  /**
   * Add a subscription
   * @param {string} userId 
   * @param {string} sourceId 
   * @param {string} tag (Optional - specific tag like '#Inflation')
   */
  subscribe(userId, sourceId, tag = null) {
    if (!this.users[userId]) return false;

    // Check if already subscribed to this exact combo
    const existing = this.users[userId].subscriptions.find(s => 
      s.source === sourceId && s.tag === tag
    );

    if (!existing) {
      this.users[userId].subscriptions.push({ source: sourceId, tag });
      this.save();
      console.log(`✅ User ${userId} subscribed to ${sourceId} [${tag || 'ALL'}]`);
      return true;
    }
    return false;
  }

  /**
   * Get all users who should receive this article
   * @param {string} sourceId 
   * @param {string[]} articleTags 
   */
  getRecipients(sourceId, articleTags = []) {
    const recipients = [];

    for (const userId in this.users) {
      const user = this.users[userId];
      
      // Check each subscription
      const match = user.subscriptions.some(sub => {
        // 1. Must match Source
        if (sub.source !== sourceId && sub.source !== 'all') return false;

        // 2. If subscription has no tag, it matches EVERYTHING from this source
        if (!sub.tag) return true;

        // 3. If subscription has a tag, Article MUST have it
        // Case-insensitive check
        return articleTags.some(t => t.toLowerCase() === sub.tag.toLowerCase());
      });

      if (match) {
        recipients.push(userId);
      }
    }

    return recipients;
  }
}

module.exports = new UserManager();
