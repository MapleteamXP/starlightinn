/**
 * Filter.js — Profanity & Content Filtering System
 *
 * A robust, client-side content filter for Starlight Inn v3.0.
 * Handles profanity, slurs, inappropriate terms, leet-speak,
 * repeated-character obfuscation, and false-positive prevention.
 *
 * Features:
 * - 200+ word profanity list organized by severity
 * - Leet-speak decoding (4→a, 3→e, 1→i, 0→o, 5→s, 7→t, $→s, @→a)
 * - Repeated character reduction ("heeeello" → "hello")
 * - Whitelist to prevent false positives ("class", "pass", "assign")
 * - Preserves original text structure; replaces only matched tokens
 * - Dedicated filters: chat, usernames, room names, bios
 *
 * @author Starlight Inn Safety Team
 * @version 3.0.0
 */

export class Filter {
  /**
   * Create a new content Filter.
   */
  constructor() {
    /** @type {string[]} Profanity list organized by severity. */
    this.profanityList = [
      // === SEVERE — slurs, hate speech, extremely offensive ===
      // Racial / ethnic slurs
      'chink', 'gook', 'jap', 'kike', 'nigga', 'nigger', 'negro', 'wetback',
      'raghead', 'cameljockey', 'sandnigger', 'beaner', 'spic', 'spick',
      'coon', 'coons', 'coont', 'darkie', 'darky', 'pickaninny', 'porchmonkey',
      'tarbaby', 'uncletom', 'whitey', 'cracker', 'honky', 'honkey', 'redskin',
      'injun', 'squaw', 'gyped', 'gypped', 'chinaman',
      // LGBTQ+ slurs
      'fag', 'fags', 'faggot', 'faggots', 'faggy', 'faggit', 'fagget',
      'dyke', 'dykes', 'lesbo', 'tranny', 'trannies', 'shemale', 'heshe',
      // Ableist / other severe slurs
      'retard', 'retards', 'retarded', 'tard', 'tards', 'spaz', 'spastic',
      'cripple', 'crip', 'mong', 'mongoloid', 'windowlicker', 'sped',
      // Sexual / violent severe
      'cunt', 'cunts', 'cunty', 'cuntbag', 'twat', 'twats', 'twatface',
      'shithead', 'shitstain', 'shitcunt', 'fuckface', 'fuckhead', 'fucktard',
      'fuckwit', 'fuckwitt', 'fuckstick', 'fucknut', 'fucknugget',
      'assrape', 'buttrape', 'gangbang', 'bukkake',

      // === MODERATE — common profanity, sexual terms ===
      // F-bomb family
      'fuck', 'fucks', 'fucked', 'fucking', 'fucker', 'fuckers', 'fucky',
      'fuk', 'fuks', 'fuked', 'fuking', 'fuker', 'fukers', 'fukin',
      'fck', 'fcking', 'fcked', 'fcku', 'phuck', 'phuk', 'phucking',
      // S-bomb family
      'shit', 'shits', 'shitted', 'shitting', 'shitty', 'shite', 'shites',
      'shitter', 'shitbag', 'shitface', 'shithole', 'shitshow', 'shitstorm',
      'shiit', 'shyt', 'shyte', 'shytty',
      // A-word family
      'ass', 'asses', 'asshole', 'assholes', 'asshat', 'asswipe', 'assclown',
      'assface', 'asscrack', 'asslick', 'asslicker', 'assbag', 'assbandit',
      'butthole', 'buttface', 'butthead', 'buttlick', 'buttlicker',
      // B-word family
      'bitch', 'bitches', 'bitchy', 'bitched', 'bitching', 'biatch', 'biotch',
      'beyotch', 'biyatch', 'beeyotch',
      // D-word family
      'damn', 'damnit', 'damned', 'dang', 'darn', 'darnit',
      'dick', 'dicks', 'dicked', 'dicking', 'dickhead', 'dickface',
      'dickwad', 'dickweed', 'dickbag', 'dickhole', 'dicknose', 'dickcheese',
      'dicklick', 'dicklicker', 'prick', 'pricks',
      // Sexual moderate
      'cock', 'cocks', 'cocksucker', 'cocksucking', 'cockhead', 'cockbag',
      'pussy', 'pussies', 'puss', 'pussface', 'pussbag',
      'tit', 'tits', 'titties', 'titty', 'nipple', 'nipples',
      'blowjob', 'blowjobs', 'handjob', 'handjobs', 'rimjob',
      'pecker', 'peckerhead', 'woodie', 'woody', 'boner', 'boners',
      'whore', 'whores', 'whoring', 'slut', 'sluts', 'slutty', 'slutting',
      'hoe', 'hoes', 'tramp', 'tramps', 'skank', 'skanks', 'skanky',
      'hooker', 'hookers', 'brothel', 'pimp', 'pimps', 'john',
      'cum', 'cums', 'cumming', 'cummed', 'cumshot', 'cumshots', 'bukkake',
      'jizz', 'jizzes', 'jizzed', 'skeet', 'skeeted',
      'orgy', 'orgies', 'threesome', 'foursome', 'swingers',
      'masturbate', 'masturbates', 'masturbating', 'masturbation',
      'wank', 'wanks', 'wanked', 'wanking', 'wanker', 'wankers',
      'jackoff', 'jerkoff', 'jerksoff', 'jackingoff', 'jerkingoff',
      'muff', 'muffdiver', 'screw', 'screwing', 'screwed', 'screws',
      'porn', 'porno', 'pornography', 'xxx', 'x-rated', 'hardcore', 'nsfw',
      'hentai', 'rule34', 'futanari', 'lolicon', 'shotacon',
      // Bodily / gross moderate
      'piss', 'pisses', 'pissed', 'pissing', 'pissoff', 'pisshead',
      'poop', 'poops', 'pooped', 'pooping', 'shat',
      'fart', 'farts', 'farted', 'farting', 'queef', 'queefs',

      // === MILD — borderline, suggestive, crude ===
      // H-word family
      'hell', 'heck', 'h-e-double-hockey-sticks',
      'bastard', 'bastards', 'bastardo',
      'bloody', 'bollocks', 'bugger', 'buggers', 'buggered',
      'bollock', 'knob', 'knobs', 'knobhead', 'knobjockey',
      'tosser', 'todger', 'willy', 'willies',
      'arse', 'arses', 'arsehole', 'arseholes',
      'git', 'gits', 'twit', 'twits', 'twerp', 'twerps',
      'nerd', 'nerds', 'geek', 'geeks', 'dork', 'dorks', 'dweeb', 'dweebs',
      'moron', 'morons', 'idiot', 'idiots', 'stupid', 'dummy', 'dummies',
      'dunce', 'dunces', 'imbecile', 'imbeciles', 'lame', 'lamer',
      'suck', 'sucks', 'sucked', 'sucking', 'sucker', 'suckers',
      'loser', 'losers', 'failure', 'fail', 'fails', 'epicfail',
      'kill', 'kills', 'killing', 'killed', 'killer', 'killers',
      'murder', 'murders', 'murdered', 'murdering', 'murderer',
      'die', 'dies', 'died', 'dying', 'death', 'deaths', 'dead',
      'suicide', 'suicides', 'suicidal', 'overdose', 'overdoses',
      'cutting', 'cutter', 'selfharm', 'self-harm',
      'rape', 'rapes', 'raped', 'raping', 'rapist', 'rapists',
      'molest', 'molests', 'molested', 'molesting', 'molester',
      'pedo', 'pedos', 'pedophile', 'pedophiles', 'predator', 'predators',
      'stalker', 'stalkers', 'stalking', 'harass', 'harasses', 'harassed',
      'bully', 'bullies', 'bullied', 'bullying', 'cyberbully',
      'threat', 'threats', 'threaten', 'threatens', 'threatened',
      'gun', 'guns', 'shoot', 'shoots', 'shot', 'shooting', 'shooter',
      'bomb', 'bombs', 'bombed', 'bombing', 'terrorist', 'terrorists',
      'drug', 'drugs', 'cocaine', 'heroin', 'meth', 'crack', 'weed',
      'marijuana', 'stoned', 'high', 'tripping', 'trip', 'trips',
      'pills', 'xanax', 'oxy', 'oxycotin', 'fentanyl',
      'beer', 'beers', 'vodka', 'whiskey', 'drunk', 'drunken',
      'alcoholic', 'alcoholism', 'hangover', 'wasted', 'smashed',
      'ugly', 'uglier', 'ugliest', 'fatso', 'fatass', 'lardass',
      'anorexic', 'anorexia', 'bulimia', 'bulimic', 'binge',
      'stinky', 'smelly', 'gross', 'disgusting', 'vomit', 'vomits',
      'puke', 'pukes', 'barf', 'barfs', 'spew', 'spews',
      'hate', 'hates', 'hated', 'hating', 'hater', 'haters',
      'racist', 'racists', 'racism', 'sexist', 'sexists', 'sexism',
      'homophobic', 'homophobia', 'transphobic', 'transphobia',
      'nazi', 'nazis', 'nazism', 'hitler', 'fascist', 'fascists',
      'kkk', 'klan', 'supremacist', 'supremacists',
      'swastika', 'heil', 'siegheil', 'whitepower', 'whitepride',
      ' ISIS ', 'taliban', 'alqaeda', 'terror', 'terrorism',
      'extremist', 'extremists', 'radicalized', 'jihad', 'jihadi',
    ];

    /** @type {string[]} Whitelist of words that look like profanity but are innocent. */
    this.whitelist = [
      'class', 'pass', 'assign', 'hello', 'sass',
      'scuba', 'compass', 'bass', 'grass', 'mass',
      'glass', 'harass', 'harassed', 'harassment',
      'canvass', 'trespass', 'surpass', 'impasse',
      'embarrass', 'embarrassed', 'embarrassing',
      'dismiss', 'dismissed', 'amass', 'declass',
      'glassware', 'passport', 'password', 'passphrase',
      'passage', 'passenger', 'passing', 'passion',
      'compassion', 'passive', 'passport', 'encompass',
      'sass', 'sassy', 'assassin', 'assassinate',
      'bassoon', 'ambassador', 'embassy', 'cassette',
      'cassava', 'harass', 'harasses', 'harassed',
      'butte', 'buttes', 'scuttle', 'scuttled',
      'button', 'butter', 'butterfly', 'buttermilk',
      'shitake', 'shittake', 'shiitake',
      'canal', 'canary', 'canadian', 'candid',
      'candle', 'candor', 'candy', 'cane', 'canoe',
      'canon', 'canopy', 'cant', 'canteen', 'canvas',
      'manuscript', 'scandal', 'vatican',
      'analysis', 'analyst', 'analytic', 'paralysis',
      'schedule', 'scheduled', 'scheduling',
      'shellfish', 'shells', 'shelter', 'shelve',
    ];

    /** @type {string} Replacement string for filtered content. */
    this.replacement = '\u2606\u2606\u2606'; // three star unicode (cozy aesthetic)

    /** @type {RegExp} Compiled pattern for repeated character reduction. */
    this.repeatPattern = /(\w)\1{2,}/g;

    /** @type {RegExp} Compiled pattern for excessive punctuation. */
    this.punctPattern = /[^a-zA-Z0-9\s]/g;
  }

  /**
   * Normalize text for profanity checking.
   * Converts leet-speak, reduces repeated chars, lowercases, strips punctuation.
   * @param {string} text - Raw input text.
   * @returns {string} Normalized text.
   */
  normalize(text) {
    if (typeof text !== 'string') return '';

    return text
      .toLowerCase()
      // Leet-speak decoding
      .replace(/4/g, 'a')
      .replace(/3/g, 'e')
      .replace(/1/g, 'i')
      .replace(/0/g, 'o')
      .replace(/5/g, 's')
      .replace(/7/g, 't')
      .replace(/\$/g, 's')
      .replace(/@/g, 'a')
      .replace(/!/g, 'i')
      .replace(/\(/g, 'c')
      .replace(/\)/g, 'd')
      .replace(/\+/g, 't')
      .replace(/\|/g, 'l')
      .replace(/\[/g, 'c')
      .replace(/\]/g, 'e')
      .replace(/</g, 'c')
      .replace(/>/g, 'e')
      .replace(/%/g, 'x')
      .replace(/#/g, 'h')
      .replace(/&/g, 'e')
      // Reduce repeated characters to max 2 ("heeeello" → "heello")
      .replace(this.repeatPattern, '$1$1')
      // Strip remaining non-alphanumeric (except spaces)
      .replace(/[^a-z0-9\s]/g, '');
  }

  /**
   * Filter profanity from text.
   * @param {string} text - Input text to filter.
   * @returns {string} Filtered text with profanity replaced.
   */
  filter(text) {
    if (typeof text !== 'string' || text.length === 0) return text;

    const normalized = this.normalize(text);
    let filtered = text;

    // Build a token map from normalized positions back to original
    const tokens = this.tokenize(normalized);

    for (const word of this.profanityList) {
      if (word.length < 3) continue;

      // Skip whitelisted words that contain profanity substrings
      const isWhitelisted = this.whitelist.some(w =>
        normalized.includes(w) && w.includes(word)
      );
      if (isWhitelisted) continue;

      // Find all occurrences in normalized text
      let pos = 0;
      while ((pos = normalized.indexOf(word, pos)) !== -1) {
        // Verify it's a whole-word match (bounded by word boundaries)
        const before = pos === 0 ? ' ' : normalized[pos - 1];
        const after = pos + word.length >= normalized.length
          ? ' '
          : normalized[pos + word.length];

        if (this.isWordChar(before) || this.isWordChar(after)) {
          pos += 1;
          continue;
        }

        // Map normalized position to original text position
        const originalSlice = this.mapToOriginal(text, normalized, pos, word.length);
        if (originalSlice) {
          filtered = filtered.substring(0, originalSlice.start)
            + this.replacement
            + filtered.substring(originalSlice.end);
        }

        pos += word.length;
      }
    }

    // Also catch spaced-out profanity: "f u c k"
    filtered = this.filterSpacedProfanity(filtered);

    // Catch mixed-case obfuscation like "Sh1t", "F*ck"
    filtered = this.filterObfuscated(filtered);

    return filtered;
  }

  /**
   * Tokenize text into word-like segments.
   * @param {string} text - Normalized text.
   * @returns {string[]} Array of tokens.
   */
  tokenize(text) {
    return text.split(/\s+/).filter(t => t.length > 0);
  }

  /**
   * Check if a character is a word character.
   * @param {string} ch - Single character.
   * @returns {boolean}
   */
  isWordChar(ch) {
    return /[a-z0-9]/.test(ch);
  }

  /**
   * Map a normalized text position back to the original text range.
   * @param {string} original - Original text.
   * @param {string} normalized - Normalized text.
   * @param {number} normStart - Start position in normalized text.
   * @param {number} normLen - Length in normalized text.
   * @returns {{start:number,end:number}|null} Original range.
   */
  mapToOriginal(original, normalized, normStart, normLen) {
    // Approximate mapping: walk both strings in parallel
    let oIdx = 0;
    let nIdx = 0;
    const normEnd = normStart + normLen;
    let start = -1;

    while (oIdx < original.length && nIdx < normalized.length) {
      if (nIdx === normStart) start = oIdx;
      if (nIdx === normEnd && start !== -1) {
        return { start, end: oIdx };
      }

      const oChar = original[oIdx].toLowerCase();
      const nChar = normalized[nIdx];

      // Try to match; if original char was stripped in normalization, skip it
      if (oChar === nChar) {
        oIdx++;
        nIdx++;
      } else {
        oIdx++;
      }
    }

    // If we reached end while trying to find end position
    if (start !== -1 && nIdx >= normEnd) {
      return { start, end: original.length };
    }

    return null;
  }

  /**
   * Detect and filter spaced-out profanity like "f u c k".
   * @param {string} text - Text to filter.
   * @returns {string} Filtered text.
   */
  filterSpacedProfanity(text) {
    // Common spaced-out patterns
    const patterns = [
      /\bf\s+u\s+c\s+k\b/gi,
      /\bs\s+h\s+i\s+t\b/gi,
      /\bb\s+i\s+t\s+c\s+h\b/gi,
      /\ba\s+s\s+s\s+h\s+o\s+l\s+e\b/gi,
      /\bd\s+i\s+c\s+k\b/gi,
      /\bc\s+u\s+n\s+t\b/gi,
      /\bn\s+i\s+g\s+g\s+a\b/gi,
      /\bf\s+a\s+g\b/gi,
    ];

    let filtered = text;
    for (const pattern of patterns) {
      filtered = filtered.replace(pattern, this.replacement);
    }
    return filtered;
  }

  /**
   * Filter obfuscated profanity with embedded symbols.
   * @param {string} text - Text to filter.
   * @returns {string} Filtered text.
   */
  filterObfuscated(text) {
    // Patterns like f*ck, sh!t, b1tch, a$$hole
    const patterns = [
      /\bf[*\-_.]?ck\b/gi,
      /\bs[!*\-_.]?ht\b/gi,
      /\bb[1i!*]tch\b/gi,
      /\ba[$s*]\s*[$s*]\s*h[o0]le\b/gi,
      /\bd[i!1*]ck\b/gi,
      /\bc[u*]nt\b/gi,
      /\bn[i!1*]gg[a@4]\b/gi,
      /\bf[a@4]g\b/gi,
    ];

    let filtered = text;
    for (const pattern of patterns) {
      filtered = filtered.replace(pattern, this.replacement);
    }
    return filtered;
  }

  /**
   * Check if text is clean (no profanity found).
   * @param {string} text - Text to check.
   * @returns {boolean} True if no profanity detected.
   */
  isClean(text) {
    return this.filter(text) === text;
  }

  /**
   * Check if text contains any profanity.
   * @param {string} text - Text to check.
   * @returns {boolean} True if profanity is present.
   */
  containsProfanity(text) {
    const normalized = this.normalize(text);

    for (const word of this.profanityList) {
      if (word.length < 3) continue;
      const isWhitelisted = this.whitelist.some(w =>
        normalized.includes(w) && w.includes(word)
      );
      if (isWhitelisted) continue;

      const pos = normalized.indexOf(word);
      if (pos !== -1) {
        const before = pos === 0 ? ' ' : normalized[pos - 1];
        const after = pos + word.length >= normalized.length
          ? ' '
          : normalized[pos + word.length];
        if (!this.isWordChar(before) && !this.isWordChar(after)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get the severity level of a word.
   * @param {string} word - Profanity word.
   * @returns {'mild'|'moderate'|'severe'} Severity level.
   */
  getSeverity(word) {
    const severe = ['cunt', 'nigger', 'faggot', 'rape', 'pedophile', 'hitler', 'nazi'];
    const moderate = ['fuck', 'shit', 'bitch', 'dick', 'cock', 'pussy', 'asshole', 'whore', 'slut'];

    const w = word.toLowerCase();
    if (severe.some(s => w.includes(s))) return 'severe';
    if (moderate.some(m => w.includes(m))) return 'moderate';
    return 'mild';
  }

  /**
   * Filter a player username / display name.
   * @param {string} name - Raw name.
   * @returns {string} Filtered name.
   */
  filterName(name) {
    if (!name || typeof name !== 'string') return '';
    const filtered = this.filter(name);
    // Names with profanity are rejected entirely
    if (filtered !== name) return '';
    return name.trim().substring(0, 32); // max 32 chars
  }

  /**
   * Filter a chat message.
   * @param {string} message - Raw chat message.
   * @returns {string} Filtered message.
   */
  filterChat(message) {
    if (!message || typeof message !== 'string') return '';
    return this.filter(message).substring(0, 256); // max 256 chars
  }

  /**
   * Filter a room / area name.
   * @param {string} name - Raw room name.
   * @returns {string} Filtered room name.
   */
  filterRoomName(name) {
    if (!name || typeof name !== 'string') return '';
    const filtered = this.filter(name);
    if (filtered !== name) return '';
    return name.trim().substring(0, 64); // max 64 chars
  }

  /**
   * Filter a player bio / description.
   * @param {string} bio - Raw bio text.
   * @returns {string} Filtered bio.
   */
  filterBio(bio) {
    if (!bio || typeof bio !== 'string') return '';
    return this.filter(bio).substring(0, 500); // max 500 chars
  }

  /**
   * Filter a room description.
   * @param {string} desc - Raw description.
   * @returns {string} Filtered description.
   */
  filterDescription(desc) {
    if (!desc || typeof desc !== 'string') return '';
    return this.filter(desc).substring(0, 300);
  }

  /**
   * Add a custom word to the profanity list at runtime.
   * @param {string} word - Word to add.
   */
  addProfanity(word) {
    if (typeof word === 'string' && word.length >= 2) {
      const normalized = word.toLowerCase().trim();
      if (!this.profanityList.includes(normalized)) {
        this.profanityList.push(normalized);
      }
    }
  }

  /**
   * Add a word to the whitelist at runtime.
   * @param {string} word - Word to whitelist.
   */
  addWhitelist(word) {
    if (typeof word === 'string' && word.length >= 2) {
      const normalized = word.toLowerCase().trim();
      if (!this.whitelist.includes(normalized)) {
        this.whitelist.push(normalized);
      }
    }
  }

  /**
   * Get statistics about the filter.
   * @returns {{profanityCount:number, whitelistCount:number, replacement:string}}
   */
  getStats() {
    return {
      profanityCount: this.profanityList.length,
      whitelistCount: this.whitelist.length,
      replacement: this.replacement,
    };
  }
}

export default Filter;
