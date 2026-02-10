const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, '..', 'users.json');

class UserManager {
  constructor() {
    this.ensureFileExists();
    this.users = this.load();
    this.migrate();
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
   * Migrate old single-tag structure to multi-tag
   */
  migrate() {
    let changed = false;
    for (const userId in this.users) {
      const user = this.users[userId];
      if (user.subscriptions) {
        user.subscriptions = user.subscriptions.map(sub => {
          if (sub.tag !== undefined && !sub.tags) {
            sub.tags = sub.tag ? [sub.tag] : [];
            delete sub.tag;
            changed = true;
          }
          if (!sub.tags) {
            sub.tags = [];
            changed = true;
          }
          return sub;
        });
      }
    }
    if (changed) this.save();
  }

  registerUser(userId, firstName) {
    if (!this.users[userId]) {
      this.users[userId] = {
        id: userId,
        name: firstName,
        joinedAt: new Date().toISOString(),
        subscriptions: [] 
      };
      this.save();
      console.log(`👤 New user registered: ${firstName} (${userId})`);
    }
  }

  /**
   * Add one or more tags to a source subscription
   * @param {string} userId 
   * @param {string} sourceId 
   * @param {string|string[]} inputTags - String or array of tags
   */
  subscribe(userId, sourceId, inputTags = null) {
    if (!this.users[userId]) return false;

    let sub = this.users[userId].subscriptions.find(s => s.source === sourceId);
    
    if (!sub) {
      sub = { source: sourceId, tags: [] };
      this.users[userId].subscriptions.push(sub);
    }

    if (inputTags) {
      const tagsToAdd = Array.isArray(inputTags) 
        ? inputTags 
        : inputTags.split(/[,\s]+/).map(t => t.trim().startsWith('#') ? t.trim() : `#${t.trim()}`);
      
      tagsToAdd.forEach(tag => {
        if (!sub.tags.some(t => t.toLowerCase() === tag.toLowerCase())) {
          sub.tags.push(tag);
        }
      });
    } else {
      // If no tags, it means ALL content
      sub.tags = [];
    }

    this.save();
    console.log(`✅ User ${userId} updated sub for ${sourceId} (Tags: ${sub.tags.join(', ') || 'ALL'})`);
    return true;
  }

  /**
   * Remove a source or specific tags
   */
  unsubscribe(userId, sourceId, tagsToRemove = null) {
    if (!this.users[userId]) return false;

    const subIndex = this.users[userId].subscriptions.findIndex(s => s.source === sourceId);
    if (subIndex === -1) return false;

    if (!tagsToRemove) {
      // Remove entire source
      this.users[userId].subscriptions.splice(subIndex, 1);
    } else {
      const tagsArray = Array.isArray(tagsToRemove) ? tagsToRemove : [tagsToRemove];
      const sub = this.users[userId].subscriptions[subIndex];
      
      sub.tags = sub.tags.filter(t => 
        !tagsArray.some(tr => tr.toLowerCase() === t.toLowerCase())
      );

      // Note: If tags become empty, it technically means "ALL" in our logic, 
      // but usually the user wants to keep the source. 
      // Let's keep it as is.
    }

    this.save();
    return true;
  }

  getRecipients(sourceId, articleTags = []) {
    const recipients = [];
    for (const userId in this.users) {
      const user = this.users[userId];
      const match = user.subscriptions.some(sub => {
        if (sub.source !== sourceId && sub.source !== 'all') return false;
        if (!sub.tags || sub.tags.length === 0) return true;
        return articleTags.some(at => 
          sub.tags.some(st => st.toLowerCase() === at.toLowerCase())
        );
      });
      if (match) recipients.push(userId);
    }
    return recipients;
  }
}

module.exports = new UserManager();
