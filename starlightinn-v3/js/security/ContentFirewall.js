/**
 * ContentFirewall.js — Starlight Inn v7.0
 * Production-grade security, content moderation, and user-safety engine.
 * Handles: profanity filtering, rate limiting, spam detection, account protection,
 * CSP enforcement, reporting, blocking, muting, banning, encryption, safe mode.
 *
 * @version 7.0.0
 * @author Starlight Inn Security Team
 * @license Proprietary
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = Object.freeze({
  RATE_LIMITS: {
    MESSAGE: { regular: 10, verified: 30, windowMs: 60_000 },
    TRADE: { perHour: 5, perDay: 20 },
    ACTION: { perMinute: 60, windowMs: 60_000 }
  },
  BRUTE_FORCE: {
    maxFailures: 5,
    lockoutMs: 15 * 60 * 1000
  },
  SPAM: {
    repeatThreshold: 3,
    repeatWindowMs: 30_000,
    capsThreshold: 0.70,
    wallOfTextLength: 500
  },
  SAFE_MODE: {
    maxAgeDays: 13 * 365,
    chatWhitelistOnly: true,
    allowTrading: false,
    allowPersonalInfo: false
  },
  MUTE_DURATIONS: [5 * 60_000, 30 * 60_000, 60 * 60_000, 24 * 60 * 60_000],
  TRUSTED_ACCOUNT_AGE_MS: 7 * 24 * 60 * 60 * 1000,
  NEW_ACCOUNT_THRESHOLD_MS: 24 * 60 * 60 * 1000,
  ENCRYPTION_KEY_ROTATION_MS: 24 * 60 * 60 * 1000,
  STORAGE_PREFIX: 'si_sec_',
  LOG_RETENTION_DAYS: 30,
  MODERATOR_PANEL_REFRESH_MS: 5000,
  APPEAL_MAX_LENGTH: 2000,
  CSP_NONCE_LENGTH: 32,
  MAX_MESSAGE_LENGTH: 1000,
  MAX_USERNAME_LENGTH: 32,
  FINGERPRINT_COMPONENTS: 8
});

// ─────────────────────────────────────────────────────────────────────────────
// PROFANITY & TOXIC WORD LISTS (300+)
// ─────────────────────────────────────────────────────────────────────────────

const PROFANITY_LIST = Object.freeze([
  'fuck','fck','fvck','fxck','fuk','fuc','fack','feck','fock',
  'shit','sht','sh1t','shiet','shite','shyt','shiit',
  'bitch','btch','b1tch','betch','biatch','bytch','bich',
  'asshole','ahole','azzhole','arsehole','ashole',
  'damn','dmn','dam','damm','dayum',
  'hell','h3ll','he11',
  'crap','cr4p','krap',
  'piss','p1ss','pis',
  'bastard','bstrd','bastrd',
  'dick','d1ck','dik','dikk','dixk',
  'cock','c0ck','kok','kock',
  'pussy','pusy','pssy','pussee',
  'whore','hore','whoar','wh0re',
  'slut','sl1t','slt','slutt',
  'retard','rtard','re tard','reetard',
  'cunt','cnt','c0nt','kunt',
  'nigga','niga','n1gga','n1ga','nigg','negro','negga',
  'faggot','fag','f4g','f4ggot','fagot',
  'dyke','dike','dyk',
  'spic','sp1c','spik','sp1k',
  'chink','ch1nk','ch1k','chinkie',
  'wetback','wetbck','wet bak',
  'gook','g00k','guk','go0k',
  'kike','k1ke','kyke',
  'wop','w0p',
  'beaner','beanr','b3aner',
  'coon','c00n','koon',
  'jap','j4p',
  'raghead','rag hed','raghed',
  'towelhead','towel hed','towlhed','towlhead',
  'cracker','crackr','cr4cker',
  'honky','honkey','honkie','honk3y',
  'paki','pak1','paky',
  'penis','pen1s','penus','peenus',
  'vagina','vag1na','vajina','vajayjay',
  'breast','breest','brest','b00b','boob','boobie','titt','titty','t1t',
  'nipple','n1pple','nipp1e',
  'orgasm','0rgasm','orgasim',
  'masturbate','masturbait','masterbate','mastur8','fap','fapping','f4p',
  'cum','cvm','kum','cumm','cumming',
  'semen','seamen','seemen','s3men',
  'erection','erect1on','erektion',
  'ejaculate','ejacul8','ejakulate',
  'blowjob','blow job','bl0wjob','bj','b.j.',
  'handjob','hand job','hjob',
  'rimjob','rim job',
  'facial','fac1al','f4cial',
  'threesome','3some','threesum',
  'gangbang','gang bang','g4ngbang',
  'milf','m1lf','m.i.l.f',
  'dildo','d1ldo','dild0',
  'vibrator','v1brator','vibe',
  'buttplug','butt plug','but plug',
  'strap-on','strapon','strap on',
  'nsfw','nudes','n00ds','nud3s','noodz',
  'onlyfans','only fans','0nlyfans',
  'porn','p0rn','pr0n','porno','pornhub',
  'hentai','h3ntai',
  'rule34','rule 34','r34',
  'cameltoe','camel toe','camel t0e',
  'upskirt','up skirt','upsk1rt',
  'downblouse','down blouse',
  'upshorts','up shorts',
  'kill','k1ll','ki11','kil','kikl','kell',
  'murder','murd3r','murdr','merder',
  'suicide','suiside','suislide','su1cide','sucide',
  'selfharm','self harm','self-harm','sh','s.h.',
  'cutting','cutt1ng','cutter','c utting',
  'overdose','0verdose','od','o.d.',
  'hang','h4ng','hanging','hang1ng',
  'stab','st4b','stabb',
  'shoot','sh00t','sho0t','shooting','sh00ting',
  'bomb','b0mb','bomm','b0mbing',
  'terrorist','terorist','terr0rist',
  'attack','att4ck','atack',
  'weapon','wepon','wep0n',
  'gun','gvn','gunn',
  'knife','kn1fe','knif',
  'weed','we3d','w33d','marijuana','marihuana','maryjane','mary jane',
  'cocaine','c0caine','coke','c0ke','kokaine',
  'heroin','her0in','heroinn',
  'meth','m3th','crank','cr4nk','ice','crystalmeth','crystal meth',
  'lsd','acid','l.s.d.',
  'mdma','ecstasy','xstasy','molly','m0lly',
  'pills','pil1s','pillz',
  'dealer','d3aler','deelr',
  'trap','tr4p','trapp',
  'plug','plvg','plugg',
  'loser','l0ser','losr','looser',
  'stupid','st00pid','stup1d','stpd','stoopid','dum','dumb','dumm',
  'idiot','id10t','1diot','1d10t','idi0t',
  'moron','m0ron','mor0n',
  'ugly','ug1y','uglee','ugli',
  'fat','f4t','fatt','phat',
  'trash','tr4sh','trasch',
  'garbage','garb4ge','garbaje',
  'worthless','worth1ess','worth less',
  'kill yourself','kys','k.y.s.','kill urself',
  'die','d1e','dye','dee',
  'hate','h8','h8te','hait',
  'suck','sux','sukk','suc','suxx',
  'lame','l4me','lam3',
  'noob','n00b','nub','newb',
  'scrub','scr1b','scrubb',
  'ez','e.z.','easy','ezz','ez game',
  'rekt','rect','rekkt','wrecked',
  'owned','0wned','pwned','p0wned','pwnd',
  'meet up','meetup','m33t up','meet irl',
  'your address','ur address','where live','where u live',
  'how old','how old r u','asl','a.s.l.','age sex loc',
  'send pics','send pix','send nudes','trade pix',
  'private chat','priv chat','priv msg','private msg',
  'off app','off game','outside game','discord','snap','snapchat',
  'instagram','insta','ig','kik','telegram','tg','whatsapp','watsapp',
  'i like kids','i l1ke kids','ur cute','youre cute','you r cute',
  'sugar daddy','sugardaddy','sd','s.d.','sugar baby','sugarbaby',
  'groom','gr00m','grooming','gr00ming',
  'secret','s3cret','dont tell','dont t3ll','dont tell anyone',
  'between us','btwn us','just us',
  'free robux','fr33 robux','free vbucks','fr33 vbucks',
  'click here','click this','cl1ck','clik here',
  'verify account','ver1fy','verification',
  'gift card','g1ft card','giftcard',
  'login here','l0gin','log in','enter password',
  'double your','double ur','2x your','2x ur',
  'hack','h4ck','hax','haxx','hax0r',
  'cheat','ch34t','cheats','ch3ats',
  'mod menu','modmenu','m0d menu',
  'generator','gen3rator','gener8or',
  'fake','f4ke','fakke',
  'scam','sc4m','skam',
  'phish','ph1sh','phishing',
  'bitcoin','btc','crypto','crypt0',
  'investment','1nvestment','invest',
  'get rich','get r1ch','rich quick','r1ch quick',
  'swat','sw4t','swatting','sw4tting',
  'dox','d0x','doxx','d0xx','doxing',
  'ddos','d.d.o.s.','denial of service',
  'hack you','h4ck you','haxx you',
  'leak','l3ak','leek',
  'blackmail','bl4ckmail','black male',
  'extort','3xtort','ext0rt',
  'expose','3xpose','exp0se',
  'cancel you','canc3l',
  'ruin','ru1n','ruin you',
  'come find you','come find u','find where you live',
  'anorexic','an0rexic','anarexic',
  'fatso','fatsoo','f4tso',
  'whale','wh4le','wale',
  'skinny','sk1nny','skinnny',
  'four eyes','4 eyes','foureyes',
  'cripple','cr1pple','crippl',
  'retard','ret4rd','retarded','r3tarded',
  'autistic','aut1stic','autist',
  'special','sp3cial ed','sped',
  'short','sh0rt','shrimp','midget','m1dget','dwarf','dw4rf',
  'damnit','dammit','d4mnit',
  'crap','cr4p','crapp',
  'heck','h3ck','hecc',
  'jeez','j3ez','geez','g3ez',
  'frick','fr1ck','fricc',
  'fudge','fudg3','fudge you',
  'shoot','sh00t','darn','d4rn','darnit',
  'gosh','g0sh','golly','g0lly',
  'heckin','h3ckin','heccin',
  'bloody','bl00dy','bloddy',
  'bollocks','b0llocks','bolox',
  'wanker','w4nker','wank','w4nk',
  'tosser','t0sser',
  'prick','pr1ck','pric',
  'twat','tw4t','twaat',
  'bollox','b0llox',
  'arse','4rse','azz','a zz',
  'bum','bumm','b0m',
  'sod','s0d','sodd',
  'git','g1t','gitt',
  'twit','tw1t','twitt',
  'berk','b3rk',
  'minger','m1nger',
  'munter','m0unter',
  'slapper','sl4pper',
  'tart','t4rt','tartt',
  'cow','c0w','coww',
  'pig','p1g','pigg',
  'dog','d0g','dogg','dawg',
  'rat','r4t','ratt',
  'snake','sn4ke','snakk',
  'roach','r0ach','roch',
  'trout','tr0ut','traut',
  'muppet','m0ppet','mupet',
  'donkey','d0nkey','donk3y','donkee',
  'monkey','m0nkey','monk3y',
  'f.u.c.k','f u c k','f.ck','f*ck','f**k','f***','f****',
  's.h.i.t','s h i t','s.it','s*it','sh*t','sh**','s***',
  'b.i.t.c.h','b i t c h','b.tch','b*tch','b**ch','b***',
  'a.s.s.h.o.l.e','a s s h o l e','a.hole','a*hole','a**hole',
  'd.i.c.k','d i c k','d.ck','d*ck','d**k',
  'c.o.c.k','c o c k','c.ck','c*ck','c**k',
  'p.u.s.s.y','p u s s y','p.ssy','p*ssy','p**sy',
  'n.i.g.g.a','n i g g a','n.gga','n*gga','n**ga','n***a',
  'f.a.g.g.o.t','f a g g o t','f.ggot','f*ggot','f**got',
  'c.u.n.t','c u n t','c.nt','c*nt','c**t'
]);

const WHITELIST_WORDS = Object.freeze([
  'class','classic','classify','classroom','classy',
  'assignment','assistant','assistance','assist','associate','association',
  'pass','passing','passage','passport','compass','bypass','sunglass','sunglasses',
  'glass','grass','brass','embarrass','embarrassing','harass','harassment',
  'darn','darnit','darning',
  'document','documentation','dock',
  'scunthorpe','analyst','analysis','analytical','analyze','analyzing',
  'cantaloupe','grape','grapefruit','pineapple','cranberry','strawberry',
  'shitake','shiitake','mushroom',
  'cocktail','cockpit','peacock','babcock','hitchcock',
  'dickinson','dickens','dickensian','dicker',
  'bass','bassist','basset','bassoon',
  'mass','massive','massacre','massachusetts','amass',
  'assume','assure','assurance','reassure','reassurance',
  'crapshoot','craps',
  'button','mutton','glutton','cotton','carton','baton','crayon','pontoon',
  'happen','happening','happiness','happy','unhappy','slapper','slap',
  'scrap','scrappy','scruple',
  'socket','pocket','rocket','locket','basket','cricket','ticket','wicket','racket','bracket',
  'sussex','essex','middlesex','essexite',
  'hotspot','hotspots','football','basketball','baseball','softball',
  'canal','canals','canalize','canalization',
  'analyst','analysts','analytic','analytics',
  'kansas','arkansas','arkansan','arkansawyer',
  'manuscript','manuscripts',
  'bassett','basswood','bassoonist',
  'passable','passably','passage','passages','passageway','passageways',
  'passbook','passbooks','passed','passenger','passengers','passer','passers',
  'passerby','passersby','passes','passing','passion','passionate','passionately',
  'passions','passive','passively','passiveness','passivity','passkey','passkeys',
  'passport','passports','password','passwords','bypassed','bypasses','bypassing',
  'compasses','encompass','encompassed','encompasses','encompassing','encompassment',
  'sunglass','sunglasses',
  'grassland','grasslands','grassroots','grassy','undergrass',
  'brasserie','brassier','brassiere','brassiness','brassy','embarrassed',
  'embarrasses','embarrassing','embarrassingly','embarrassment','embarrassments',
  'harassed','harasses','harassing','harassment','harassments',
  'canalboat','canalisation','canalization','canaller','canallers',
  'canalize','canalized','canalizes','canalizing',
  'scunthorpe','penistone','lightwater','clitheroe','fukui','fukuoka'
]);

const ALLOWED_URLS = Object.freeze([
  'starlightinn.game',
  'starlight-inn.com',
  'starlightinn.fandom.com',
  'starlightinn.wiki',
  'cdn.starlightinn.game',
  'api.starlightinn.game',
  'help.starlightinn.game',
  'support.starlightinn.game'
]);

const BLOCKED_DOMAINS = Object.freeze([
  'bit.ly','tinyurl.com','t.co','goo.gl','ow.ly','buff.ly','is.gd','short.link',
  'adf.ly','linkbucks.com','shorte.st','ouo.io','sh.st','bc.vc','coinurl.com',
  'cur.lv','ity.im','q.gs','urlcash.net','linkshrink.net','ciick.me',
  'phishing-site.com','malware-site.com','virus-site.com','trojan-site.com',
  'free-robux-generator.com','robux-scam.com','vbucks-scam.com','freegems.com',
  'login-verify-fake.com','account-recovery-scam.com','steam-community-fake.com',
  'discord-gift-fake.com','nitro-scam.com','free-nitro.com','giveaway-scam.com',
  'crypto-scam.com','bitcoin-doubler.com','investment-scam.com','ponzi-site.com'
]);

const REPORT_CATEGORIES = Object.freeze([
  'harassment','scam','inappropriate_content','bot','other',
  'hate_speech','grooming','exploitation','cheating','doxxing'
]);

// ─────────────────────────────────────────────────────────────────────────────
// LEET-SPEAK MAPPING
// ─────────────────────────────────────────────────────────────────────────────

const LEET_MAP = Object.freeze({
  'a': ['a','4','@','^','/-','aye','λ'],
  'b': ['b','8','|3','ß','13','I3'],
  'c': ['c','(','<','[','©','¢'],
  'd': ['d','|)','|}','δ','ð','cl'],
  'e': ['e','3','&','€','£','[-'],
  'f': ['f','|=','ph','ƒ','/='],
  'g': ['g','6','9','&','(_+'],
  'h': ['h','#','|-|',']-[','}{','[-]'],
  'i': ['i','1','!','|','l','ï'],
  'j': ['j','_|',';',']','/'],
  'k': ['k','|<','|{','|X'],
  'l': ['l','1','|','£','|_','7'],
  'm': ['m','|v|','[V]','/V\\','nn'],
  'n': ['n','|\\|','/\\/','И'],
  'o': ['o','0','()','°','ø','*'],
  'p': ['p','|*','|>','|D','9','¶'],
  'q': ['q','(_,)','0_','O,','kw'],
  'r': ['r','|2','12','®','I2'],
  's': ['s','5','$','§','z','_'],
  't': ['t','7','+','†','-|','~|'],
  'u': ['u','|_|','v','µ','(_)'],
  'v': ['v','\\/','|/','\\|'],
  'w': ['w','\\/\\/','vv','\\^/','\\V/'],
  'x': ['x','><','}{','×','%'],
  'y': ['y','`/','¥','j','¿'],
  'z': ['z','2','7_','%','>_']
});

// ─────────────────────────────────────────────────────────────────────────────
// REGULAR EXPRESSION PATTERNS
// ─────────────────────────────────────────────────────────────────────────────

const PATTERNS = Object.freeze({
  URL: /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,})(?:\/[-a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=]*)?/gi,
  SUSPICIOUS_URL: /(?:bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly|adf\.ly|short\.link|free-robux|free-vbucks|verify-account|login-now|double-your)/gi,
  PHONE: /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/gi,
  PHONE_INTL: /\+[0-9]{1,3}[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,4}/gi,
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
  SSN: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  CREDIT_CARD: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  IP_ADDRESS: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  DISCORD_INVITE: /(?:discord\.gg|discord\.com\/invite)\/([a-zA-Z0-9-]{2,32})/gi,
  SOCIAL_HANDLE: /(?:snap|insta|ig|kik|telegram|tg|whatsapp|wa)[:\s]*[@]?([a-zA-Z0-9_.-]{3,30})/gi,
  CRYPTO_WALLET: /\b(?:0x[a-fA-F0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{39,59})\b/g,
  CAPS_CHARS: /[A-Z]/g,
  ALPHA_CHARS: /[a-zA-Z]/g,
  INVISIBLE_UNICODE: /[\u200E\u200F\u202A-\u202E\u2066-\u2069\u00AD\u034F\u180B-\u180D\uFE00-\uFE0F\uFE20-\uFE2F]/g,
  ZERO_WIDTH: /[\u200B\u200C\u200D]/g,
  CYRILLIC_LOOKALIKES: /[а-яА-Я]/g,
  REPEATED_CHARS: /(.)\1{5,}/g,
  EXCESSIVE_PUNCT: /[!?]{4,}/g,
  EXCESSIVE_WHITESPACE: /\s{5,}/g,
  MARKDOWN_LINK: /\[([^\]]+)\]\(([^)]+)\)/g
});

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function generateNonce(length = CONFIG.CSP_NONCE_LENGTH) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    for (let i = 0; i < length; i++) nonce += chars[arr[i] % chars.length];
  } else {
    for (let i = 0; i < length; i++) nonce += chars[Math.floor(Math.random() * chars.length)];
  }
  return nonce;
}

function xorCipher(text, key) {
  if (!text || !key) return text;
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

function encodeToBase64(str) {
  try { return btoa(str); } catch { return str; }
}

function decodeFromBase64(str) {
  try { return atob(str); } catch { return str; }
}

function safeJSONParse(str, fallback = null) {
  try { return JSON.parse(str); } catch { return fallback; }
}

function safeJSONStringify(obj) {
  try { return JSON.stringify(obj); } catch { return '{}'; }
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function now() { return Date.now(); }

function clamp(num, min, max) { return Math.min(Math.max(num, min), max); }

// ─────────────────────────────────────────────────────────────────────────────
// ENCRYPTED LOCALSTORAGE MANAGER
// ─────────────────────────────────────────────────────────────────────────────

class EncryptedStorage {
  constructor(prefix = CONFIG.STORAGE_PREFIX) {
    this.prefix = prefix;
    this._key = this._getOrCreateKey();
    this._lastRotation = this._getLastRotation();
    this._checkRotation();
  }

  _getOrCreateKey() {
    const raw = localStorage.getItem(`${this.prefix}enc_key`);
    if (raw) return decodeFromBase64(raw);
    const newKey = generateNonce(48);
    localStorage.setItem(`${this.prefix}enc_key`, encodeToBase64(newKey));
    return newKey;
  }

  _getLastRotation() {
    const raw = localStorage.getItem(`${this.prefix}key_rot`);
    return raw ? parseInt(raw, 10) : now();
  }

  _checkRotation() {
    if (now() - this._lastRotation > CONFIG.ENCRYPTION_KEY_ROTATION_MS) this.rotateKey();
  }

  rotateKey() {
    const oldKey = this._key;
    const newKey = generateNonce(48);
    const allKeys = Object.keys(localStorage).filter(k =>
      k.startsWith(this.prefix) && k !== `${this.prefix}enc_key` && k !== `${this.prefix}key_rot`
    );
    for (const key of allKeys) {
      try {
        const encrypted = localStorage.getItem(key);
        if (encrypted) {
          const decrypted = xorCipher(decodeFromBase64(encrypted), oldKey);
          const reEncrypted = encodeToBase64(xorCipher(decrypted, newKey));
          localStorage.setItem(key, reEncrypted);
        }
      } catch (err) { /* skip corrupted */ }
    }
    this._key = newKey;
    localStorage.setItem(`${this.prefix}enc_key`, encodeToBase64(newKey));
    localStorage.setItem(`${this.prefix}key_rot`, now().toString());
    this._lastRotation = now();
  }

  set(key, value) {
    const fullKey = `${this.prefix}${key}`;
    const serialized = safeJSONStringify(value);
    const encrypted = encodeToBase64(xorCipher(serialized, this._key));
    localStorage.setItem(fullKey, encrypted);
  }

  get(key, fallback = null) {
    const fullKey = `${this.prefix}${key}`;
    const encrypted = localStorage.getItem(fullKey);
    if (!encrypted) return fallback;
    try {
      const decrypted = xorCipher(decodeFromBase64(encrypted), this._key);
      return safeJSONParse(decrypted, fallback);
    } catch { return fallback; }
  }

  remove(key) { localStorage.removeItem(`${this.prefix}${key}`); }

  has(key) { return localStorage.getItem(`${this.prefix}${key}`) !== null; }

  keys() {
    return Object.keys(localStorage)
      .filter(k => k.startsWith(this.prefix))
      .map(k => k.slice(this.prefix.length));
  }

  clear() { for (const key of this.keys()) this.remove(key); }

  exportSecure() {
    const data = {};
    for (const key of this.keys()) data[key] = this.get(key);
    return data;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITER
// ─────────────────────────────────────────────────────────────────────────────

class RateLimiter {
  constructor(storage) {
    this.storage = storage;
    this._inMemory = new Map();
    this._cleanupInterval = setInterval(() => this._cleanup(), 60_000);
  }

  _getBucket(userId, actionType) {
    const key = `rl_${userId}_${actionType}`;
    return this.storage.get(key) || this._inMemory.get(key) || { count: 0, timestamps: [], blockedUntil: 0 };
  }

  _setBucket(userId, actionType, bucket) {
    const key = `rl_${userId}_${actionType}`;
    this._inMemory.set(key, bucket);
    this.storage.set(key, bucket);
  }

  _cleanup() {
    const cutoff = now() - 24 * 60 * 60 * 1000;
    for (const [key, bucket] of this._inMemory.entries()) {
      if (bucket.timestamps) bucket.timestamps = bucket.timestamps.filter(ts => ts > cutoff);
      if (bucket.blockedUntil && bucket.blockedUntil < now()) bucket.blockedUntil = 0;
      this._inMemory.set(key, bucket);
    }
  }

  check(userId, actionType, userProfile = {}) {
    if (userProfile.admin || userProfile.moderator) {
      return { allowed: true, remaining: Infinity, resetAt: 0, reason: null };
    }
    const bucket = this._getBucket(userId, actionType);
    const currentTime = now();
    if (bucket.blockedUntil > currentTime) {
      return {
        allowed: false, remaining: 0, resetAt: bucket.blockedUntil,
        reason: `Rate limit exceeded. Try again in ${Math.ceil((bucket.blockedUntil - currentTime) / 1000)}s.`
      };
    }
    let limit, windowMs;
    if (actionType === 'message') {
      limit = userProfile.verified ? CONFIG.RATE_LIMITS.MESSAGE.verified : CONFIG.RATE_LIMITS.MESSAGE.regular;
      windowMs = CONFIG.RATE_LIMITS.MESSAGE.windowMs;
    } else if (actionType === 'trade') {
      const hourB = this._getBucket(userId, 'trade_hour');
      const dayB = this._getBucket(userId, 'trade_day');
      const hourStart = currentTime - 60 * 60 * 1000;
      const dayStart = currentTime - 24 * 60 * 60 * 1000;
      hourB.timestamps = (hourB.timestamps || []).filter(ts => ts > hourStart);
      dayB.timestamps = (dayB.timestamps || []).filter(ts => ts > dayStart);
      if (hourB.timestamps.length >= CONFIG.RATE_LIMITS.TRADE.perHour) {
        return { allowed: false, remaining: 0, resetAt: hourB.timestamps[0] + 60 * 60 * 1000, reason: 'Trade hourly limit reached (5/hr).' };
      }
      if (dayB.timestamps.length >= CONFIG.RATE_LIMITS.TRADE.perDay) {
        return { allowed: false, remaining: 0, resetAt: dayB.timestamps[0] + 24 * 60 * 60 * 1000, reason: 'Trade daily limit reached (20/day).' };
      }
      hourB.timestamps.push(currentTime);
      dayB.timestamps.push(currentTime);
      this._setBucket(userId, 'trade_hour', hourB);
      this._setBucket(userId, 'trade_day', dayB);
      return { allowed: true, remaining: CONFIG.RATE_LIMITS.TRADE.perHour - hourB.timestamps.length, resetAt: hourB.timestamps[0] + 60 * 60 * 1000, reason: null };
    } else if (actionType === 'action') {
      limit = CONFIG.RATE_LIMITS.ACTION.perMinute;
      windowMs = CONFIG.RATE_LIMITS.ACTION.windowMs;
    } else {
      limit = 60; windowMs = 60_000;
    }
    bucket.timestamps = (bucket.timestamps || []).filter(ts => ts > currentTime - windowMs);
    if (bucket.timestamps.length >= limit) {
      bucket.blockedUntil = currentTime + windowMs;
      this._setBucket(userId, actionType, bucket);
      return { allowed: false, remaining: 0, resetAt: bucket.blockedUntil, reason: `${actionType} rate limit reached (${limit}/${windowMs}ms).` };
    }
    bucket.timestamps.push(currentTime);
    this._setBucket(userId, actionType, bucket);
    return { allowed: true, remaining: limit - bucket.timestamps.length, resetAt: (bucket.timestamps[0] || currentTime) + windowMs, reason: null };
  }

  getStatus(userId, actionType) {
    const bucket = this._getBucket(userId, actionType);
    const currentTime = now();
    return {
      count: (bucket.timestamps || []).filter(ts => ts > currentTime - 60_000).length,
      blockedUntil: bucket.blockedUntil || 0,
      isBlocked: (bucket.blockedUntil || 0) > currentTime
    };
  }

  reset(userId, actionType) {
    this._setBucket(userId, actionType, { count: 0, timestamps: [], blockedUntil: 0 });
  }

  resetAll(userId) {
    for (const type of ['message','trade','trade_hour','trade_day','action']) this.reset(userId, type);
  }

  destroy() { clearInterval(this._cleanupInterval); }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXT NORMALIZER (Leet-speak, Unicode, Spacing Evasion)
// ─────────────────────────────────────────────────────────────────────────────

class TextNormalizer {
  constructor() {
    this._leetCache = new Map();
    this._buildLeetRegexes();
  }

  _buildLeetRegexes() {
    this._leetRegexes = [];
    for (const word of PROFANITY_LIST) {
      const patterns = this._generateLeetPatterns(word);
      for (const pattern of patterns) {
        try {
          const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
          this._leetRegexes.push({ word, regex });
        } catch { /* skip unregexable */ }
      }
    }
  }

  _generateLeetPatterns(word) {
    const chars = word.split('');
    let basePattern = '';
    for (const char of chars) {
      const lower = char.toLowerCase();
      const variants = LEET_MAP[lower];
      if (variants) {
        basePattern += `[${variants.map(v => v.replace(/[\]\[\\^$.*+?{}|()]/g, '\\$&')).join('')}]+`;
      } else {
        basePattern += char.replace(/[\]\[\\^$.*+?{}|()]/g, '\\$&');
      }
    }
    return [basePattern];
  }

  normalize(text) {
    if (!text) return '';
    let normalized = text;
    normalized = normalized.replace(PATTERNS.INVISIBLE_UNICODE, '');
    normalized = normalized.replace(PATTERNS.ZERO_WIDTH, '');
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC');
    normalized = normalized.replace(/[.\-_\s*]+/g, ' ');
    normalized = normalized.replace(/(.)\1{3,}/g, '$1$1');
    normalized = normalized.replace(/[\uff01-\uff5e]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
    normalized = normalized.replace(/(\w)[!@#$%^&*+={}\[\]|\\:;"'<>,.?/]+(\w)/g, '$1$2');
    normalized = normalized.toLowerCase();
    return normalized;
  }

  numericDecode(text) {
    const map = { '4': 'a', '3': 'e', '1': 'i', '0': 'o', '5': 's', '7': 't', '8': 'b', '6': 'g', '9': 'g' };
    return text.split('').map(c => map[c] || c).join('');
  }

  containsProfanity(text) {
    if (!text) return { found: false, matches: [] };
    const normalized = this.normalize(text);
    const numericDecoded = this.numericDecode(normalized);
    const matches = [];
    for (const { word, regex } of this._leetRegexes) {
      if (regex.test(normalized) || regex.test(numericDecoded)) matches.push(word);
      regex.lastIndex = 0;
    }
    for (const word of PROFANITY_LIST) {
      if (normalized.includes(word) || numericDecoded.includes(word)) {
        if (!matches.includes(word)) matches.push(word);
      }
    }
    const falsePositives = new Set();
    for (const whitelisted of WHITELIST_WORDS) {
      if (normalized.includes(whitelisted)) {
        for (const match of matches) {
          if (whitelisted.includes(match) && match.length < whitelisted.length) falsePositives.add(match);
        }
      }
    }
    const filteredMatches = matches.filter(m => !falsePositives.has(m));
    return { found: filteredMatches.length > 0, matches: [...new Set(filteredMatches)], severity: this._calculateSeverity(filteredMatches) };
  }

  _calculateSeverity(matches) {
    if (matches.length === 0) return 0;
    const tierScores = { 'fuck':10,'fck':10,'fvck':10,'shit':10,'bitch':10,'asshole':10,
      'nigga':10,'niga':10,'n1gga':10,'faggot':10,'fag':10,
      'cunt':10,'retard':10,'dyke':10,'spic':10,'chink':10,
      'gook':10,'kike':10,'coon':10,'raghead':10,'towelhead':10 };
    let maxSeverity = 0;
    for (const match of matches) {
      const score = tierScores[match] || 5;
      maxSeverity = Math.max(maxSeverity, score);
    }
    return maxSeverity;
  }

  censorText(text, replacement = '\u2588') {
    const { found, matches } = this.containsProfanity(text);
    if (!found) return text;
    let censored = text;
    for (const match of matches) {
      const pattern = new RegExp(`\\b${match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      censored = censored.replace(pattern, replacement.repeat(match.length));
    }
    return censored;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATTERN DETECTOR (URLs, PII, Spam)
// ─────────────────────────────────────────────────────────────────────────────

class PatternDetector {
  constructor() {
    this._urlCache = new Map();
    this._urlCheckCache = new Map();
  }

  detectURLs(text) {
    const matches = [];
    let m;
    PATTERNS.URL.lastIndex = 0;
    while ((m = PATTERNS.URL.exec(text)) !== null) {
      matches.push({ raw: m[0], domain: m[1]?.toLowerCase(), index: m.index, length: m[0].length });
    }
    PATTERNS.URL.lastIndex = 0;
    return matches;
  }

  isURLAllowed(domain) {
    if (!domain) return false;
    const lower = domain.toLowerCase();
    for (const allowed of ALLOWED_URLS) {
      if (lower === allowed || lower.endsWith('.' + allowed)) return true;
    }
    return false;
  }

  isURLBlocked(domain) {
    if (!domain) return false;
    const lower = domain.toLowerCase();
    for (const blocked of BLOCKED_DOMAINS) if (lower.includes(blocked)) return true;
    if (PATTERNS.SUSPICIOUS_URL.test(lower)) return true;
    PATTERNS.SUSPICIOUS_URL.lastIndex = 0;
    return false;
  }

  detectPhoneNumbers(text) {
    const matches = [];
    let m;
    PATTERNS.PHONE.lastIndex = 0;
    while ((m = PATTERNS.PHONE.exec(text)) !== null) matches.push({ raw: m[0], type: 'us_phone', index: m.index });
    PATTERNS.PHONE.lastIndex = 0;
    PATTERNS.PHONE_INTL.lastIndex = 0;
    while ((m = PATTERNS.PHONE_INTL.exec(text)) !== null) {
      if (!matches.some(e => e.index === m.index)) matches.push({ raw: m[0], type: 'intl_phone', index: m.index });
    }
    PATTERNS.PHONE_INTL.lastIndex = 0;
    return matches;
  }

  detectEmails(text) {
    const matches = [];
    let m;
    PATTERNS.EMAIL.lastIndex = 0;
    while ((m = PATTERNS.EMAIL.exec(text)) !== null) matches.push({ raw: m[0], index: m.index });
    PATTERNS.EMAIL.lastIndex = 0;
    return matches;
  }

  detectSSN(text) {
    const matches = [];
    let m;
    PATTERNS.SSN.lastIndex = 0;
    while ((m = PATTERNS.SSN.exec(text)) !== null) matches.push({ raw: m[0], index: m.index });
    PATTERNS.SSN.lastIndex = 0;
    return matches;
  }

  detectDiscordInvites(text) {
    const matches = [];
    let m;
    PATTERNS.DISCORD_INVITE.lastIndex = 0;
    while ((m = PATTERNS.DISCORD_INVITE.exec(text)) !== null) matches.push({ raw: m[0], code: m[1], index: m.index });
    PATTERNS.DISCORD_INVITE.lastIndex = 0;
    return matches;
  }

  detectSocialHandles(text) {
    const matches = [];
    let m;
    PATTERNS.SOCIAL_HANDLE.lastIndex = 0;
    while ((m = PATTERNS.SOCIAL_HANDLE.exec(text)) !== null) {
      matches.push({ raw: m[0], platform: m[0].split(/[:\s@]/)[0], handle: m[1], index: m.index });
    }
    PATTERNS.SOCIAL_HANDLE.lastIndex = 0;
    return matches;
  }

  detectMarkdownLinks(text) {
    const matches = [];
    let m;
    PATTERNS.MARKDOWN_LINK.lastIndex = 0;
    while ((m = PATTERNS.MARKDOWN_LINK.exec(text)) !== null) matches.push({ raw: m[0], label: m[1], url: m[2], index: m.index });
    PATTERNS.MARKDOWN_LINK.lastIndex = 0;
    return matches;
  }

  detectAllPII(text) {
    return {
      phones: this.detectPhoneNumbers(text),
      emails: this.detectEmails(text),
      ssns: this.detectSSN(text),
      discord: this.detectDiscordInvites(text),
      social: this.detectSocialHandles(text),
      crypto: this._detectCryptoWallets(text),
      ips: this._detectIPs(text),
      creditCards: this._detectCreditCards(text),
      urls: this.detectURLs(text)
    };
  }

  _detectCryptoWallets(text) {
    const matches = [];
    let m;
    PATTERNS.CRYPTO_WALLET.lastIndex = 0;
    while ((m = PATTERNS.CRYPTO_WALLET.exec(text)) !== null) matches.push({ raw: m[0], index: m.index });
    PATTERNS.CRYPTO_WALLET.lastIndex = 0;
    return matches;
  }

  _detectIPs(text) {
    const matches = [];
    let m;
    PATTERNS.IP_ADDRESS.lastIndex = 0;
    while ((m = PATTERNS.IP_ADDRESS.exec(text)) !== null) matches.push({ raw: m[0], index: m.index });
    PATTERNS.IP_ADDRESS.lastIndex = 0;
    return matches;
  }

  _detectCreditCards(text) {
    const matches = [];
    let m;
    PATTERNS.CREDIT_CARD.lastIndex = 0;
    while ((m = PATTERNS.CREDIT_CARD.exec(text)) !== null) matches.push({ raw: m[0], index: m.index });
    PATTERNS.CREDIT_CARD.lastIndex = 0;
    return matches;
  }

  isSpam(text, history = []) {
    const checks = { allCaps: false, wallOfText: false, repeatedChars: false, excessivePunct: false, excessiveWhitespace: false, repeatedMessage: false, score: 0 };
    const alphaMatches = text.match(PATTERNS.ALPHA_CHARS);
    if (alphaMatches && alphaMatches.length > 5) {
      const capsMatches = text.match(PATTERNS.CAPS_CHARS);
      const capsRatio = capsMatches ? capsMatches.length / alphaMatches.length : 0;
      if (capsRatio > CONFIG.SPAM.capsThreshold) { checks.allCaps = true; checks.score += 3; }
    }
    if (text.length > CONFIG.SPAM.wallOfTextLength) { checks.wallOfText = true; checks.score += 2; }
    if (PATTERNS.REPEATED_CHARS.test(text)) { checks.repeatedChars = true; checks.score += 2; }
    PATTERNS.REPEATED_CHARS.lastIndex = 0;
    if (PATTERNS.EXCESSIVE_PUNCT.test(text)) { checks.excessivePunct = true; checks.score += 1; }
    PATTERNS.EXCESSIVE_PUNCT.lastIndex = 0;
    if (PATTERNS.EXCESSIVE_WHITESPACE.test(text)) { checks.excessiveWhitespace = true; checks.score += 1; }
    PATTERNS.EXCESSIVE_WHITESPACE.lastIndex = 0;
    if (history && history.length > 0) {
      const recent = history.slice(-CONFIG.SPAM.repeatThreshold);
      const normalizedMsg = text.toLowerCase().replace(/\s+/g, ' ').trim();
      const identicalCount = recent.filter(h => h.toLowerCase().replace(/\s+/g, ' ').trim() === normalizedMsg).length;
      if (identicalCount >= CONFIG.SPAM.repeatThreshold - 1) { checks.repeatedMessage = true; checks.score += 5; }
    }
    checks.isSpam = checks.score >= 4;
    return checks;
  }

  detectInvisibleText(text) {
    const invisible = [];
    let m;
    PATTERNS.INVISIBLE_UNICODE.lastIndex = 0;
    while ((m = PATTERNS.INVISIBLE_UNICODE.exec(text)) !== null) invisible.push({ char: m[0], codePoint: m[0].codePointAt(0).toString(16), index: m.index });
    PATTERNS.INVISIBLE_UNICODE.lastIndex = 0;
    PATTERNS.ZERO_WIDTH.lastIndex = 0;
    while ((m = PATTERNS.ZERO_WIDTH.exec(text)) !== null) invisible.push({ char: m[0], codePoint: m[0].codePointAt(0).toString(16), index: m.index });
    PATTERNS.ZERO_WIDTH.lastIndex = 0;
    return invisible;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT PROTECTION
// ─────────────────────────────────────────────────────────────────────────────

class AccountProtection {
  constructor(storage) {
    this.storage = storage;
    this._loginAttempts = new Map();
    this._suspiciousIPs = new Set();
    this._lockedAccounts = new Map();
    this._cleanupInterval = setInterval(() => this._cleanup(), 5 * 60_000);
  }

  recordLoginAttempt(username, ip, success) {
    const key = `${username}:${ip || 'unknown'}`;
    const attempts = this._loginAttempts.get(key) || { count: 0, firstAttempt: now(), timestamps: [] };
    attempts.count++;
    attempts.timestamps.push(now());
    this._loginAttempts.set(key, attempts);
    const cutoff = now() - 60 * 60 * 1000;
    attempts.timestamps = attempts.timestamps.filter(ts => ts > cutoff);
    attempts.count = attempts.timestamps.length;
    if (success) {
      this._loginAttempts.delete(key);
      this.storage.remove(`lock_${username}`);
      this._lockedAccounts.delete(username);
      return { locked: false, remaining: CONFIG.BRUTE_FORCE.maxFailures };
    }
    if (attempts.count >= CONFIG.BRUTE_FORCE.maxFailures) {
      this._lockAccount(username, ip);
      return { locked: true, remaining: 0, lockoutUntil: now() + CONFIG.BRUTE_FORCE.lockoutMs };
    }
    return { locked: false, remaining: CONFIG.BRUTE_FORCE.maxFailures - attempts.count };
  }

  _lockAccount(username, ip) {
    const lockData = { lockedAt: now(), unlocksAt: now() + CONFIG.BRUTE_FORCE.lockoutMs, ip: ip || 'unknown', reason: 'brute_force' };
    this.storage.set(`lock_${username}`, lockData);
    this._lockedAccounts.set(username, lockData);
  }

  isAccountLocked(username) {
    const memLock = this._lockedAccounts.get(username);
    if (memLock) {
      if (memLock.unlocksAt > now()) return { locked: true, unlocksAt: memLock.unlocksAt, reason: memLock.reason };
      this._lockedAccounts.delete(username);
    }
    const storageLock = this.storage.get(`lock_${username}`);
    if (storageLock && storageLock.unlocksAt > now()) {
      this._lockedAccounts.set(username, storageLock);
      return { locked: true, unlocksAt: storageLock.unlocksAt, reason: storageLock.reason };
    }
    if (storageLock) this.storage.remove(`lock_${username}`);
    return { locked: false };
  }

  markIPSuspicious(ip, reason = 'unknown') {
    if (!ip) return;
    this._suspiciousIPs.add(ip);
    const suspiciousList = this.storage.get('suspicious_ips', []);
    if (!suspiciousList.some(entry => entry.ip === ip)) {
      suspiciousList.push({ ip, markedAt: now(), reason });
      this.storage.set('suspicious_ips', suspiciousList);
    }
  }

  isIPSuspicious(ip) {
    if (!ip) return false;
    if (this._suspiciousIPs.has(ip)) return true;
    const suspiciousList = this.storage.get('suspicious_ips', []);
    return suspiciousList.some(entry => entry.ip === ip);
  }

  getSuspiciousIPs() { return this.storage.get('suspicious_ips', []); }

  removeSuspiciousIP(ip) {
    this._suspiciousIPs.delete(ip);
    const list = this.storage.get('suspicious_ips', []);
    this.storage.set('suspicious_ips', list.filter(entry => entry.ip !== ip));
  }

  _cleanup() {
    const cutoff = now() - CONFIG.BRUTE_FORCE.lockoutMs;
    for (const [key, data] of this._loginAttempts.entries()) {
      if (data.timestamps.length === 0 || data.timestamps[data.timestamps.length - 1] < cutoff) this._loginAttempts.delete(key);
    }
    for (const [username, lock] of this._lockedAccounts.entries()) {
      if (lock.unlocksAt <= now()) { this._lockedAccounts.delete(username); this.storage.remove(`lock_${username}`); }
    }
  }

  generateDeviceFingerprint() {
    const components = [
      navigator.userAgent || 'unknown',
      navigator.language || 'unknown',
      screen.width + 'x' + screen.height,
      screen.colorDepth || 'unknown',
      navigator.hardwareConcurrency || 'unknown',
      new Date().getTimezoneOffset(),
      !!navigator.webdriver,
      !!(window.ontouchstart || navigator.maxTouchPoints > 0)
    ];
    return hashString(components.join('|'));
  }

  destroy() { clearInterval(this._cleanupInterval); }
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

class ReportSystem {
  constructor(storage) {
    this.storage = storage;
    this._reportQueue = this.storage.get('report_queue', []);
    this._reportIdCounter = this.storage.get('report_counter', 0);
  }

  submitReport({ reporterId, targetId, category, description, evidence = {}, screenshotData = null, chatLog = [], timestamp = now() }) {
    if (!REPORT_CATEGORIES.includes(category)) return { success: false, error: `Invalid category. Must be one of: ${REPORT_CATEGORIES.join(', ')}` };
    if (!description || description.length < 10) return { success: false, error: 'Description must be at least 10 characters.' };
    this._reportIdCounter++;
    const reportId = `REP-${Date.now().toString(36).toUpperCase()}-${this._reportIdCounter.toString(36).toUpperCase()}`;
    const report = {
      id: reportId, reporterId, targetId, category,
      description: description.slice(0, 2000), evidence,
      screenshotData: screenshotData ? screenshotData.slice(0, 500_000) : null,
      chatLog: chatLog.slice(-50), timestamp, status: 'pending',
      priority: this._calculatePriority(category, evidence),
      assignedTo: null, resolution: null, resolvedAt: null, createdAt: now()
    };
    this._reportQueue.push(report);
    this._persistQueue();
    if (report.priority === 'critical') this._autoEscalate(report);
    return { success: true, reportId };
  }

  _calculatePriority(category, evidence) {
    const criticalCategories = ['grooming', 'exploitation', 'doxxing'];
    if (criticalCategories.includes(category)) return 'critical';
    if (evidence && evidence.piiDetected) return 'high';
    if (category === 'harassment' || category === 'hate_speech') return 'high';
    if (category === 'scam' || category === 'bot') return 'medium';
    return 'low';
  }

  _autoEscalate(report) {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('si_security_report_critical', { detail: report }));
    }
  }

  getReports(filters = {}) {
    let reports = [...this._reportQueue];
    if (filters.status) reports = reports.filter(r => r.status === filters.status);
    if (filters.category) reports = reports.filter(r => r.category === filters.category);
    if (filters.priority) reports = reports.filter(r => r.priority === filters.priority);
    if (filters.targetId) reports = reports.filter(r => r.targetId === filters.targetId);
    if (filters.reporterId) reports = reports.filter(r => r.reporterId === filters.reporterId);
    if (filters.assignedTo) reports = reports.filter(r => r.assignedTo === filters.assignedTo);
    if (filters.since) reports = reports.filter(r => r.timestamp >= filters.since);
    if (filters.until) reports = reports.filter(r => r.timestamp <= filters.until);
    return reports.sort((a, b) => (b.priority === 'critical' ? 1 : 0) - (a.priority === 'critical' ? 1 : 0) || b.timestamp - a.timestamp);
  }

  getReportById(reportId) { return this._reportQueue.find(r => r.id === reportId) || null; }

  assignReport(reportId, moderatorId) {
    const report = this.getReportById(reportId);
    if (!report) return { success: false, error: 'Report not found.' };
    report.assignedTo = moderatorId;
    report.status = 'investigating';
    this._persistQueue();
    return { success: true };
  }

  resolveReport(reportId, resolution, moderatorId) {
    const report = this.getReportById(reportId);
    if (!report) return { success: false, error: 'Report not found.' };
    report.status = 'resolved'; report.resolution = resolution; report.resolvedAt = now(); report.assignedTo = moderatorId;
    this._persistQueue();
    return { success: true };
  }

  dismissReport(reportId, moderatorId) {
    const report = this.getReportById(reportId);
    if (!report) return { success: false, error: 'Report not found.' };
    report.status = 'dismissed'; report.resolvedAt = now(); report.assignedTo = moderatorId;
    this._persistQueue();
    return { success: true };
  }

  getPendingCount() { return this._reportQueue.filter(r => r.status === 'pending' || r.status === 'investigating').length; }

  getStats() {
    const stats = {};
    for (const cat of REPORT_CATEGORIES) stats[cat] = this._reportQueue.filter(r => r.category === cat).length;
    stats.total = this._reportQueue.length;
    stats.pending = this.getPendingCount();
    stats.resolved = this._reportQueue.filter(r => r.status === 'resolved').length;
    stats.dismissed = this._reportQueue.filter(r => r.status === 'dismissed').length;
    return stats;
  }

  pruneOldReports(days = CONFIG.LOG_RETENTION_DAYS) {
    const cutoff = now() - days * 24 * 60 * 60 * 1000;
    this._reportQueue = this._reportQueue.filter(r => r.createdAt > cutoff);
    this._persistQueue();
  }

  _persistQueue() { this.storage.set('report_queue', this._reportQueue); this.storage.set('report_counter', this._reportIdCounter); }
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK LIST MANAGER
// ─────────────────────────────────────────────────────────────────────────────

class BlockListManager {
  constructor(storage) { this.storage = storage; }

  getBlockedUsers(userId) { return this.storage.get(`blocks_${userId}`, []); }

  blockUser(userId, targetId, reason = '') {
    const blocked = this.getBlockedUsers(userId);
    if (blocked.some(b => b.userId === targetId)) return { success: false, error: 'User already blocked.' };
    blocked.push({ userId: targetId, blockedAt: now(), reason: reason.slice(0, 200) });
    this.storage.set(`blocks_${userId}`, blocked);
    return { success: true };
  }

  unblockUser(userId, targetId) {
    const blocked = this.getBlockedUsers(userId);
    const filtered = blocked.filter(b => b.userId !== targetId);
    this.storage.set(`blocks_${userId}`, filtered);
    return { success: true, wasBlocked: filtered.length < blocked.length };
  }

  isBlocked(userId, targetId) { return this.getBlockedUsers(userId).some(b => b.userId === targetId); }

  getBlockCount(userId) { return this.getBlockedUsers(userId).length; }

  shouldHideMessage(userId, messageSenderId) { return this.isBlocked(userId, messageSenderId); }

  shouldPreventInteraction(userId, targetId) { return this.isBlocked(userId, targetId) || this.isBlocked(targetId, userId); }
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTE SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

class MuteSystem {
  constructor(storage) {
    this.storage = storage;
    this._activeMutes = new Map();
    this._loadMutes();
    this._cleanupInterval = setInterval(() => this._cleanupExpired(), 30_000);
  }

  _loadMutes() {
    const allKeys = this.storage.keys().filter(k => k.startsWith('mute_'));
    for (const key of allKeys) {
      const muteData = this.storage.get(key);
      if (muteData && muteData.expiresAt > now()) {
        this._activeMutes.set(key.replace('mute_', ''), muteData);
      }
    }
  }

  muteUser(userId, durationMs, reason = '', appliedBy = 'system') {
    const expiresAt = now() + durationMs;
    const muteData = { userId, appliedAt: now(), expiresAt, reason: reason.slice(0, 500), appliedBy, durationMs };
    this._activeMutes.set(userId, muteData);
    this.storage.set(`mute_${userId}`, muteData);
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('si_security_user_muted', { detail: muteData }));
    }
    return { success: true, expiresAt, durationMs };
  }

  unmuteUser(userId, appliedBy = 'system') {
    this._activeMutes.delete(userId);
    this.storage.remove(`mute_${userId}`);
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('si_security_user_unmuted', { detail: { userId, appliedBy, at: now() } }));
    }
    return { success: true };
  }

  isMuted(userId) {
    const muteData = this._activeMutes.get(userId);
    if (!muteData) {
      const stored = this.storage.get(`mute_${userId}`);
      if (stored && stored.expiresAt > now()) { this._activeMutes.set(userId, stored); return { muted: true, ...stored }; }
      return { muted: false };
    }
    if (muteData.expiresAt <= now()) { this.unmuteUser(userId); return { muted: false }; }
    return { muted: true, ...muteData };
  }

  getRemainingMuteTime(userId) {
    const status = this.isMuted(userId);
    return status.muted ? Math.max(0, status.expiresAt - now()) : 0;
  }

  getActiveMutes() {
    const result = [];
    for (const [userId, data] of this._activeMutes.entries()) {
      if (data.expiresAt > now()) result.push({ userId, ...data });
    }
    return result;
  }

  autoMuteForViolation(userId, violationType, severity = 5) {
    let durationMs;
    if (severity >= 9) durationMs = CONFIG.MUTE_DURATIONS[3];
    else if (severity >= 7) durationMs = CONFIG.MUTE_DURATIONS[2];
    else if (severity >= 5) durationMs = CONFIG.MUTE_DURATIONS[1];
    else durationMs = CONFIG.MUTE_DURATIONS[0];
    return this.muteUser(userId, durationMs, `Auto-mute: ${violationType} (severity ${severity})`, 'auto');
  }

  _cleanupExpired() {
    for (const [userId, data] of this._activeMutes.entries()) {
      if (data.expiresAt <= now()) this.unmuteUser(userId);
    }
  }

  destroy() { clearInterval(this._cleanupInterval); }
}

// ─────────────────────────────────────────────────────────────────────────────
// BAN SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

class BanSystem {
  constructor(storage, accountProtection) {
    this.storage = storage;
    this.accountProtection = accountProtection;
    this._bannedAccounts = new Set();
    this._bannedIPs = new Set();
    this._bannedFingerprints = new Set();
    this._loadBans();
    this._cleanupInterval = setInterval(() => this._cleanupExpired(), 60_000);
  }

  _loadBans() {
    const accounts = this.storage.get('banned_accounts', []);
    const ips = this.storage.get('banned_ips', []);
    const fingerprints = this.storage.get('banned_fingerprints', []);
    for (const entry of accounts) if (entry.expiresAt === null || entry.expiresAt > now()) this._bannedAccounts.add(entry.userId);
    for (const entry of ips) if (entry.expiresAt === null || entry.expiresAt > now()) this._bannedIPs.add(entry.ip);
    for (const entry of fingerprints) if (entry.expiresAt === null || entry.expiresAt > now()) this._bannedFingerprints.add(entry.fingerprint);
  }

  banAccount(userId, reason = '', durationMs = null, appliedBy = 'system') {
    const banData = { userId, reason: reason.slice(0, 500), appliedAt: now(), expiresAt: durationMs ? now() + durationMs : null, appliedBy, type: 'account' };
    const accounts = this.storage.get('banned_accounts', []);
    accounts.push(banData);
    this.storage.set('banned_accounts', accounts);
    this._bannedAccounts.add(userId);
    this._dispatch('account_banned', banData);
    return { success: true, banData };
  }

  banIP(ip, reason = '', durationMs = null, appliedBy = 'system') {
    const banData = { ip, reason: reason.slice(0, 500), appliedAt: now(), expiresAt: durationMs ? now() + durationMs : null, appliedBy, type: 'ip' };
    const ips = this.storage.get('banned_ips', []);
    ips.push(banData);
    this.storage.set('banned_ips', ips);
    this._bannedIPs.add(ip);
    this._dispatch('ip_banned', banData);
    return { success: true, banData };
  }

  banFingerprint(fingerprint, reason = '', durationMs = null, appliedBy = 'system') {
    const banData = { fingerprint, reason: reason.slice(0, 500), appliedAt: now(), expiresAt: durationMs ? now() + durationMs : null, appliedBy, type: 'device' };
    const fingerprints = this.storage.get('banned_fingerprints', []);
    fingerprints.push(banData);
    this.storage.set('banned_fingerprints', fingerprints);
    this._bannedFingerprints.add(fingerprint);
    this._dispatch('device_banned', banData);
    return { success: true, banData };
  }

  banUserComprehensive(userId, ip, fingerprint, reason = '', durationMs = null, appliedBy = 'system') {
    const results = {
      account: this.banAccount(userId, reason, durationMs, appliedBy),
      ip: ip ? this.banIP(ip, reason, durationMs, appliedBy) : null,
      device: fingerprint ? this.banFingerprint(fingerprint, reason, durationMs, appliedBy) : null
    };
    return { success: true, results };
  }

  unbanAccount(userId) {
    const accounts = this.storage.get('banned_accounts', []).filter(a => a.userId !== userId);
    this.storage.set('banned_accounts', accounts);
    this._bannedAccounts.delete(userId);
    return { success: true };
  }

  unbanIP(ip) {
    const ips = this.storage.get('banned_ips', []).filter(entry => entry.ip !== ip);
    this.storage.set('banned_ips', ips);
    this._bannedIPs.delete(ip);
    return { success: true };
  }

  unbanFingerprint(fingerprint) {
    const fingerprints = this.storage.get('banned_fingerprints', []).filter(entry => entry.fingerprint !== fingerprint);
    this.storage.set('banned_fingerprints', fingerprints);
    this._bannedFingerprints.delete(fingerprint);
    return { success: true };
  }

  isBanned(userId, ip, fingerprint) {
    const result = { banned: false, reasons: [] };
    if (this._bannedAccounts.has(userId)) { result.banned = true; result.reasons.push('account'); }
    if (ip && this._bannedIPs.has(ip)) { result.banned = true; result.reasons.push('ip'); }
    if (fingerprint && this._bannedFingerprints.has(fingerprint)) { result.banned = true; result.reasons.push('device'); }
    return result;
  }

  getBanDetails(userId) { return this.storage.get('banned_accounts', []).find(a => a.userId === userId) || null; }

  getAllBans() {
    return {
      accounts: this.storage.get('banned_accounts', []),
      ips: this.storage.get('banned_ips', []),
      fingerprints: this.storage.get('banned_fingerprints', [])
    };
  }

  _cleanupExpired() {
    const nowTime = now();
    this.storage.set('banned_accounts', this.storage.get('banned_accounts', []).filter(a => a.expiresAt === null || a.expiresAt > nowTime));
    this.storage.set('banned_ips', this.storage.get('banned_ips', []).filter(e => e.expiresAt === null || e.expiresAt > nowTime));
    this.storage.set('banned_fingerprints', this.storage.get('banned_fingerprints', []).filter(e => e.expiresAt === null || e.expiresAt > nowTime));
  }

  _dispatch(name, detail) {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent(`si_security_${name}`, { detail }));
    }
  }

  destroy() { clearInterval(this._cleanupInterval); }
}

// ─────────────────────────────────────────────────────────────────────────────
// SAFE MODE (Under-13 Protection)
// ─────────────────────────────────────────────────────────────────────────────

class SafeModeManager {
  constructor(storage) {
    this.storage = storage;
    this._enabledFor = new Set();
  }

  enableSafeMode(userId, birthDate) {
    if (!birthDate) return { success: false, error: 'Birth date required.' };
    const ageMs = now() - new Date(birthDate).getTime();
    const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears >= 13) return { success: false, error: 'Safe mode only for users under 13.' };
    this._enabledFor.add(userId);
    this.storage.set(`safemode_${userId}`, { enabledAt: now(), birthDate, ageYears });
    return { success: true, ageYears };
  }

  disableSafeMode(userId, parentPin) {
    const stored = this.storage.get(`safemode_${userId}`);
    if (!stored) return { success: false, error: 'Safe mode not enabled.' };
    this._enabledFor.delete(userId);
    this.storage.remove(`safemode_${userId}`);
    return { success: true };
  }

  isSafeMode(userId) {
    if (this._enabledFor.has(userId)) return true;
    const stored = this.storage.get(`safemode_${userId}`);
    if (stored) { this._enabledFor.add(userId); return true; }
    return false;
  }

  canChat(userId, message) {
    if (!this.isSafeMode(userId)) return { allowed: true };
    const words = message.toLowerCase().split(/\s+/);
    const allowedWords = this._getAllowedWords();
    for (const word of words) {
      if (!allowedWords.includes(word) && word.length > 2) {
        return { allowed: false, reason: `Word "${word}" not in safe chat whitelist.` };
      }
    }
    return { allowed: true };
  }

  canTrade(userId) { return { allowed: !this.isSafeMode(userId), reason: 'Trading disabled in safe mode.' }; }

  canSharePersonalInfo(userId) { return { allowed: !this.isSafeMode(userId), reason: 'Personal info sharing disabled in safe mode.' }; }

  _getAllowedWords() {
    return Object.freeze([
      'hello','hi','hey','goodbye','bye','see','you','later',
      'yes','no','maybe','ok','okay','sure','thanks','thank','please',
      'welcome','sorry','excuse','pardon','help','helping','helped',
      'friend','friends','buddy','pal','mate','player','players',
      'game','games','play','playing','played','fun','enjoy','enjoying',
      'win','won','winning','lose','lost','losing','draw','tie',
      'team','teams','group','party','guild','clan','club',
      'room','rooms','house','houses','inn','starlight','world',
      'map','area','zone','level','stage','quest','mission',
      'item','items','gear','weapon','armor','shield','potion',
      'gold','coin','coins','money','shop','store','market',
      'buy','bought','sell','sold','trade','trading','price','cost',
      'craft','crafting','make','making','build','building','create','creating',
      'color','colors','red','blue','green','yellow','orange','purple','pink','black','white','brown','gray',
      'big','small','large','tiny','huge','little','tall','short',
      'fast','slow','quick','swift','rapid',
      'good','great','awesome','amazing','cool','nice','neat','sweet','wonderful','fantastic','excellent',
      'bad','sad','happy','glad','joy','upset','angry','mad','calm','peaceful',
      'go','going','went','come','coming','came','leave','leaving','left','arrive','arriving','arrived',
      'walk','walking','walked','run','running','ran','jump','jumping','jumped','fly','flying','flew',
      'eat','eating','ate','food','drink','drinking','drank','water','juice','soda',
      'sleep','sleeping','slept','rest','resting','rested',
      'talk','talking','talked','chat','chatting','say','saying','said','tell','telling','told',
      'look','looking','looked','see','seeing','saw','watch','watching','watched',
      'find','finding','found','search','searching','searched','seek','seeking','sought',
      'get','getting','got','have','having','had','give','giving','gave','take','taking','took',
      'want','wanting','wanted','need','needing','needed','like','liking','liked','love','loving','loved',
      'know','knowing','knew','think','thinking','thought','believe','believing','believed',
      'where','what','when','why','how','who','which','whose',
      'here','there','everywhere','somewhere','nowhere','anywhere',
      'today','tomorrow','yesterday','now','then','soon','later','before','after',
      'morning','afternoon','evening','night','day','week','month','year','time',
      'one','two','three','four','five','six','seven','eight','nine','ten',
      'first','second','third','last','next','previous',
      'north','south','east','west','up','down','left','right','forward','backward',
      'new','old','fresh','clean','hot','cold','warm','cool','icy',
      'easy','hard','difficult','simple','complex','basic','advanced',
      'begin','beginning','began','started','start','starting','stop','stopping','stopped',
      'end','ending','ended','finish','finishing','finished','complete','completing','completed',
      'open','opening','opened','close','closing','closed','lock','locking','locked','unlock','unlocking','unlocked',
      'enter','entering','entered','exit','exiting','exited','join','joining','joined',
      'ready','set','go','wait','waiting','waited','pause','pausing','paused','resume','resuming','resumed',
      'ready','prepared',
      'attack','attacking','attacked','defend','defending','defended','fight','fighting','fought','battle','battling','battled',
      'heal','healing','healed','cure','curing','cured','recover','recovering','recovered',
      'spell','spells','magic','magical','cast','casting','casted','power','powers','powerful',
      'fire','water','earth','wind','air','ice','lightning','thunder','storm','nature',
      'dragon','dragons','fairy','fairies','elf','elves','dwarf','dwarves','human','humans','orc','orcs',
      'king','queen','prince','princess','knight','knights','wizard','wizards','witch','witches','mage','mages',
      'sword','swords','bow','bows','arrow','arrows','staff','staffs','wand','wands','ring','rings',
      'castle','castles','tower','towers','village','villages','city','cities','town','towns',
      'forest','forests','mountain','mountains','river','rivers','lake','lakes','ocean','oceans','sea','seas',
      'cave','caves','dungeon','dungeons','labyrinth','maze','ruins','temple','temples',
      'treasure','treasures','chest','chests','box','boxes','bag','bags','pack','packs',
      'animal','animals','pet','pets','dog','dogs','cat','cats','bird','birds','fish','fishes','horse','horses',
      'monster','monsters','beast','beasts','creature','creatures','enemy','enemies','foe','foes',
      'victory','victories','defeat','defeats','success','successful','failure','fail','failures',
      'reward','rewards','prize','prizes','bonus','bonuses','gift','gifts','present','presents',
      'event','events','festival','festivals','holiday','holidays','celebration','celebrations',
      'birthday','birthdays','anniversary','anniversaries','party','parties','gathering','gatherings',
      'congratulations','congrats','well','done','good','job','nice','work','great','effort',
      'bravo','hooray','yay','wow','woo','hoo','awesome','rad','epic','legendary','mythic',
      'common','uncommon','rare','unique','special','normal','basic','standard','premium',
      'rank','ranks','ranking','score','scoring','scored','points','point','total','totals',
      'leaderboard','leaderboards','chart','charts','stats','statistics','stat','record','records',
      'challenge','challenges','challenging','challenged','goal','goals','objective','objectives',
      'achievement','achievements','trophy','trophies','medal','medals','badge','badges','pin','pins',
      'avatar','avatars','profile','profiles','picture','pictures','icon','icons','emoji','emojis',
      'theme','themes','skin','skins','outfit','outfits','costume','costumes','clothes','clothing',
      'hat','hats','cape','capes','mask','masks','glasses','goggles','helmet','helmets',
      'crown','crowns','tiara','tiaras','necklace','necklaces','bracelet','bracelets',
      'shoe','shoes','boot','boots',
      'flower','flowers','tree','trees','bush','bushes','grass','leaf','leaves','plant','plants',
      'rose','roses','daisy','daisies','tulip','tulips','lily','lilies','sunflower','sunflowers',
      'star','stars','moon','moons','sun','suns','planet','planets','comet','comets','galaxy','galaxies',
      'space','cosmos','universe','sky','skies','cloud','clouds','rain','raining','rained','snow','snowing','snowed',
      'storm','storms','thunder','lightning','wind','winds','breeze','breezes',
      'rainbow','rainbows','diamond','diamonds','gem','gems','crystal','crystals','jewel','jewels',
      'pearl','pearls','ruby','rubies','sapphire','sapphires','emerald','emeralds','topaz','topazes',
      'amethyst','amethysts','opal','opals','jade','garnet','garnets','amber','quartz','quartzes',
      'potion','potions','elixir','elixirs','antidote','antidotes',
      'scroll','scrolls','tome','tomes','book','books','page','pages','chapter','chapters',
      'spellbook','spellbooks','grimoire','grimoires','manual','manuals','guide','guides',
      'recipe','recipes','formula','formulas','blueprint','blueprints','plan','plans',
      'material','materials','component','components','ingredient','ingredients','resource','resources',
      'wood','woods','stone','stones','rock','rocks','ore','ores','metal','metals','iron','steel','gold','silver','bronze','copper',
      'cloth','cloths','fabric','fabrics','silk','wool','cotton','linen','leather','leathers','fur','furs',
      'crystal','crystals','shard','shards','fragment','fragments','piece','pieces','part','parts',
      'upgrade','upgrades','upgrading','upgraded','level','levels','leveling','leveled','max','maximum',
      'experience','experiences','xp','exp','skill','skills','ability','abilities','talent','talents',
      'strength','strong','stamina','endurance','energy','energies','health','healthy','hp','life','lives',
      'mana','mp','magic','magical','power','powers','force','forces','might','dominance',
      'speed','speeds','agility','agile','dexterity','dexterous','reflex','reflexes',
      'intelligence','intelligent','wisdom','wise','knowledge','knowing','mind','minds',
      'charisma','charismatic','charm','charms','charming','charmed','luck','lucky','fortune','fortunate',
      'blessing','blessings','curse','curses','hex','hexes','jinx','jinxes','ward','wards','shield','shields',
      'aura','auras','essence','essences','soul','souls','spirit','spirits','ghost','ghosts','phantom','phantoms',
      'camp','camps','base','bases','home','homes','basecamp','headquarters','hq',
      'spawn','spawns','respawn','respawning','respawned','checkpoint','checkpoints','save','saving','saved',
      'menu','menus','setting','settings','option','options','preference','preferences','config','configs',
      'audio','sound','sounds','music','musics','song','songs','volume','volumes','mute','muted','unmute','unmuted',
      'video','videos','graphic','graphics','resolution','resolutions','quality','qualities','fps','frame','frames',
      'control','controls','keybind','keybinds','shortcut','shortcuts','button','buttons','click','clicking','clicked',
      'mouse','keyboard','controller','controllers','joystick','joysticks','pad','pads',
      'tutorial','tutorials','guide','guides','lesson','lessons','hint','hints','tip','tips','trick','tricks',
      'story','stories','lore','legend','legends','myth','myths','tale','tales','saga','sagas','chronicle','chronicles',
      'questline','questlines','storyline','storylines','arc','arcs','plot','plots','scene','scenes','act','acts',
      'cutscene','cutscenes','dialogue','dialogues','conversation','conversations','speech','speeches',
      'character','characters','npc','npcs','non-player','companion','companions','follower','followers','ally','allies','allied',
      'villain','villains','boss','bosses','miniboss','minibosses','elite','elites','champion','champions',
      'hero','heroes','protagonist','protagonists','main','character','supporting','cameo','cameos',
      'secret','secrets','hidden','easter','egg','eggs','reference','references','nod','nods','callback','callbacks',
      'unlock','unlocks','unlocking','unlocked','reveal','reveals','revealing','revealed','discover','discovers','discovering','discovered',
      'mystery','mysteries','clue','clues','hint','hints','riddle','riddles','puzzle','puzzles','enigma','enigmas',
      'code','codes','cipher','ciphers','password','passwords','combination','combinations','sequence','sequences',
      'pattern','patterns','shape','shapes','form','forms','figure','figures','design','designs','symbol','symbols','rune','runes',
      'glyph','glyphs','sigil','sigils','emblem','emblems','sign','signs','mark','marks','brand','brands','stamp','stamps',
      'trail','trails','track','tracks','footprint','footprints','path','paths','way','ways','road','roads',
      'bridge','bridges','gate','gates','door','doors','portal','portals','teleport','teleporting','teleported','warp','warping','warped',
      'summon','summons','summoning','summoned','call','calls','calling','called','invoke','invokes','invoking','invoked',
      'banish','banishes','banishing','banished','exile','exiles','exiling','exiled','remove','removes','removing','removed',
      'protect','protects','protecting','protected','guard','guards','guarding','guarded','save','saves','saving','saved','rescue','rescues','rescuing','rescued',
      'danger','dangers','dangerous','safe','safer','safest','safety','secure','security','protected',
      'trap','traps','snare','snares','pitfall','pitfalls','hazard','hazards','risk','risks','risky','peril','perils','perilous',
      'alarm','alarms','alert','alerts','warning','warnings','warn','warns','caution','cautions','beware',
      'shield','shields','barrier','barriers','wall','walls','fence','fences','block','blocks','blocking','blocked',
      'armor','armors','mail','mails','plate','plates','scale','scales','chain','chains','leather','leathers','cloth','cloths','robe','robes',
      'pants','shirt','shirts','tunic','tunics','vest','vests','coat','coats','jacket','jackets','cloak','cloaks','mantle','mantles',
      'glove','gloves','gauntlet','gauntlets','mitt','mitts','bracer','bracers','vambrace','vambraces',
      'belt','belts','sash','sashes','girdle','girdles','buckle','buckles','strap','straps',
      'bag','bags','pouch','pouches','satchel','satchels','pack','packs','backpack','backpacks','sack','sacks',
      'purse','purses','wallet','wallets','container','containers','box','boxes','crate','crates','barrel','barrels','chest','chests','locker','lockers',
      'shelf','shelves','rack','racks','stand','stands','table','tables','desk','desks','counter','counters',
      'chair','chairs','stool','stools','bench','benches','seat','seats','sofa','sofas','couch','couches',
      'bed','beds','bunk','bunks','hammock','hammocks','cot','cots','mattress','mattresses','pillow','pillows','blanket','blankets',
      'lamp','lamps','lantern','lanterns','torch','torches','candle','candles','light','lights','glow','glows','beam','beams','ray','rays',
      'fire','fires','flame','flames','blaze','blazes','inferno','infernos','bonfire','bonfires','campfire','campfires','embers','ash','ashes','smoke','smokes',
      'water','waters','pool','pools','pond','ponds','stream','streams','brook','brooks','creek','creeks','spring','springs','well','wells','fountain','fountains',
      'dock','docks','pier','piers','wharf','wharves','harbor','harbors','port','ports','marina','marinas',
      'beach','beaches','shore','shores','coast','coasts','sand','sands','pebble','pebbles','shell','shells','driftwood','driftwoods',
      'island','islands','isle','isles','atoll','atolls','archipelago','archipelagos','reef','reefs','cay','cays',
      'jungle','jungles','rainforest','rainforests','swamp','swamps','marsh','marshes','bog','bogs','fen','fens','moor','moors','heath','heaths',
      'tundra','tundras','taiga','taigas','steppe','steppes','prairie','prairies','plain','plains','savanna','savannas','meadow','meadows','pasture','pastures',
      'desert','deserts','dune','dunes','oasis','oases',
      'canyon','canyons','ravine','ravines','gorge','gorges','valley','valleys','glen','glens','dale','dales','hollow','hollows','basin','basins','crater','craters',
      'plateau','plateaus','mesa','mesas','butte','buttes','pinnacle','pinnacles','spire','spires','peak','peaks','summit','summits','top','tops',
      'cliff','cliffs','bluff','bluffs','escarpment','escarpments','precipice','precipices','ledge','ledges','shelf','shelves','rim','rims','edge','edges','brink','brinks',
      'glacier','glaciers','iceberg','icebergs','floe','floes','shelf','iceshelf','icecap','icecaps','permafrost','permafrosts',
      'volcano','volcanoes','crater','craters','caldera','calderas','cone','cones','vent','vents','fissure','fissures','lava','lavas','magma','magmas',
      'geyser','geysers','hot','spring','springs','fumarole','fumaroles','mudpot','mudpots',
      'crystal','crystals','geode','geodes','cluster','clusters','formation','formations','stalactite','stalactites','stalagmite','stalagmites','column','columns','pillar','pillars',
      'fossil','fossils','bone','bones','skeleton','skeletons','skull','skulls','remains','relic','relics','artifact','artifacts','antiquity','antiquities','heirloom','heirlooms',
      'ruin','ruins','remnant','remnants','vestige','vestiges','trace','traces','echo','echoes','memory','memories','shadow','shadows','ghost','ghosts',
      'dance','dances','prance','prances','frolic','frolics','romp','romps','gambol','gambols','caper','capers','frisk','frisks','sport','sports','play','plays','revel','revels',
      'strut','struts','swagger','swaggers','sashay','sashays','swish','swishes','sweep','sweeps','glide','glides','float','floats','hover','hovers','levitate','levitates',
      'march','marches','parade','parades','procession','processions','column','columns','file','files','rank','ranks','row','rows','line','lines','queue','queues',
      'circle','circles','ring','rings','loop','loops','orbit','orbits','cycle','cycles','round','rounds','circuit','circuits','lap','laps','turn','turns',
      'twist','twists','twirl','twirls','tangle','tangles','knot','knots','snarl','snarls','mesh','meshes','web','webs','net','nets','network','networks','grid','grids','matrix','matrices','lattice','lattices',
      'frame','frames','structure','structures','skeleton','skeletons','framework','frameworks','scaffold','scaffolds','shell','shells','hull','hulls','body','bodies','form','forms','shape','shapes','mold','molds','cast','casts',
      'model','models','mockup','mockups','prototype','prototypes','template','templates','pattern','patterns','archetype','archetypes',
      'stereotype','stereotypes','prejudice','prejudices','bias','biases','leaning','leanings','tendency','tendencies','inclination','inclinations','propensity','propensities','proclivity','proclivities','predilection','predilections',
      'habit','habits','routine','routines','ritual','rituals','custom','customs','tradition','traditions','practice','practices','convention','conventions','norm','norms','standard','standards','rule','rules','law','laws','principle','principles',
      'doctrine','doctrines','dogma','dogmas','tenet','tenets','creed','creeds','credo','credos','belief','beliefs','faith','faiths','religion','religions','cult','cults','sect','sects','denomination','denominations',
      'philosophy','philosophies','ideology','ideologies','theory','theories','hypothesis','hypotheses','thesis','theses','postulate','postulates','premise','premises','assumption','assumptions','supposition','suppositions','speculation','speculations',
      'conjecture','conjectures','surmise','surmises','guess','guesses','estimate','estimates','approximation','approximations','calculation','calculations','computation','computations','reckoning','reckonings','tally','tallies','count','counts','sum','sums','total','totals',
      'amount','amounts','quantity','quantities','volume','volumes','mass','masses','weight','weights','measure','measures','measurement','measurements','dimension','dimensions','size','sizes','scale','scales','magnitude','magnitudes','degree','degrees','extent','extents','scope','scopes',
      'range','ranges','reach','reaches','span','spans','stretch','stretches','spread','spreads','expanse','expanses','area','areas','space','spaces','territory','territories','domain','domains','realm','realms','zone','zones','region','regions','sector','sectors','district','districts','quarter','quarters',
      'patch','patches','spot','spots','dot','dots','speck','specks','fleck','flecks','flake','flakes','chip','chips','splinter','splinters','shard','shards','fragment','fragments','piece','pieces','bit','bits','part','parts','portion','portions','share','shares','fraction','fractions','percentage','percentages','percent','percents','proportion','proportions','ratio','ratios','rate','rates',
      'frequency','frequencies','occurrence','occurrences','incidence','incidences','prevalence','prevalences','abundance','abundances','profusion','profusions','plethora','plethoras','myriad','myriads','multitude','multitudes','host','hosts','horde','hordes','swarm','swarms','throng','throngs','crowd','crowds','mob','mobs','mass','masses','bulk','bulks','heap','heaps','pile','piles','stack','stacks','mound','mounds','hill','hills','mountain','mountains'
    ]);
  }

  filterChat(message) {
    const words = message.toLowerCase().split(/\s+/);
    const allowed = this._getAllowedWords();
    const filtered = [];
    for (const word of words) {
      if (allowed.includes(word) || word.length <= 2 || /^\d+$/.test(word)) filtered.push(word);
      else filtered.push('[filtered]');
    }
    return filtered.join(' ');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT SECURITY POLICY ENFORCER
// ─────────────────────────────────────────────────────────────────────────────

class CSPEnforcer {
  constructor() {
    this._nonce = generateNonce();
    this._directives = {
      'default-src': ["'self'"],
      'script-src': ["'self'", `'nonce-${this._nonce}'`, "'strict-dynamic'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
      'font-src': ["'self'", 'data:'],
      'connect-src': ["'self'", 'wss:', 'https://api.starlightinn.game'],
      'media-src': ["'self'", 'blob:', 'https:'],
      'object-src': ["'none'"],
      'frame-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': []
    };
  }

  getNonce() { return this._nonce; }

  generateHeader() {
    const parts = [];
    for (const [directive, values] of Object.entries(this._directives)) {
      if (values.length > 0) parts.push(`${directive} ${values.join(' ')}`);
      else parts.push(directive);
    }
    return parts.join('; ');
  }

  generateMetaTag() {
    return `<meta http-equiv="Content-Security-Policy" content="${this.generateHeader()}">`;
  }

  addDirective(directive, value) {
    if (!this._directives[directive]) this._directives[directive] = [];
    if (!this._directives[directive].includes(value)) this._directives[directive].push(value);
  }

  removeDirectiveValue(directive, value) {
    if (this._directives[directive]) this._directives[directive] = this._directives[directive].filter(v => v !== value);
  }

  validateInlineScript(scriptContent) {
    return { allowed: false, reason: 'Use external scripts or nonce-validated inline scripts.' };
  }

  rotateNonce() {
    this._nonce = generateNonce();
    this._directives['script-src'] = this._directives['script-src'].filter(v => !v.startsWith("'nonce-"));
    this._directives['script-src'].push(`'nonce-${this._nonce}'`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY LOGGER
// ─────────────────────────────────────────────────────────────────────────────

class SecurityLogger {
  constructor(storage, maxEntries = 10000) {
    this.storage = storage;
    this.maxEntries = maxEntries;
    this._buffer = [];
    this._flushInterval = setInterval(() => this._flush(), 30_000);
  }

  log(level, event, details = {}) {
    const entry = { timestamp: now(), level, event, details, sessionId: this._getSessionId(), url: typeof window !== 'undefined' ? window.location?.href : null };
    this._buffer.push(entry);
    if (this._buffer.length >= 100) this._flush();
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('si_security_security_log', { detail: entry }));
    }
  }

  info(event, details) { this.log('info', event, details); }
  warn(event, details) { this.log('warn', event, details); }
  error(event, details) { this.log('error', event, details); }
  critical(event, details) { this.log('critical', event, details); }

  _flush() {
    if (this._buffer.length === 0) return;
    const existing = this.storage.get('security_logs', []);
    const combined = [...existing, ...this._buffer];
    this.storage.set('security_logs', combined.slice(-this.maxEntries));
    this._buffer = [];
  }

  getLogs(filters = {}) {
    this._flush();
    let logs = this.storage.get('security_logs', []);
    if (filters.level) logs = logs.filter(l => l.level === filters.level);
    if (filters.event) logs = logs.filter(l => l.event === filters.event);
    if (filters.since) logs = logs.filter(l => l.timestamp >= filters.since);
    if (filters.until) logs = logs.filter(l => l.timestamp <= filters.until);
    if (filters.limit) logs = logs.slice(-filters.limit);
    return logs;
  }

  exportLogs() { this._flush(); return this.storage.get('security_logs', []); }

  clearLogs() { this._buffer = []; this.storage.set('security_logs', []); }

  _getSessionId() {
    let sid = sessionStorage?.getItem('si_session_id');
    if (!sid) { sid = `sess-${generateNonce(16)}`; sessionStorage?.setItem('si_session_id', sid); }
    return sid;
  }

  destroy() { clearInterval(this._flushInterval); this._flush(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CONTENT FIREWALL CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class ContentFirewall {
  constructor(options = {}) {
    this.storage = new EncryptedStorage(options.storagePrefix || CONFIG.STORAGE_PREFIX);
    this.rateLimiter = new RateLimiter(this.storage);
    this.normalizer = new TextNormalizer();
    this.patternDetector = new PatternDetector();
    this.accountProtection = new AccountProtection(this.storage);
    this.reportSystem = new ReportSystem(this.storage);
    this.blockList = new BlockListManager(this.storage);
    this.muteSystem = new MuteSystem(this.storage);
    this.banSystem = new BanSystem(this.storage, this.accountProtection);
    this.safeMode = new SafeModeManager(this.storage);
    this.csp = new CSPEnforcer();
    this.logger = new SecurityLogger(this.storage);
    this._messageHistory = new Map();
    this._eventListeners = new Map();
    this.logger.info('content_firewall_initialized', { version: '7.0.0' });
  }

  processMessage(userId, message, profile = {}) {
    const violations = [];
    const result = { allowed: true, reason: null, censoredMessage: message, action: 'allow', severity: 0, violations };
    const deviceFP = this.accountProtection.generateDeviceFingerprint();
    const banCheck = this.banSystem.isBanned(userId, profile.ip, deviceFP);
    if (banCheck.banned) {
      result.allowed = false; result.reason = `Account banned: ${banCheck.reasons.join(', ')}`;
      result.action = 'ban';
      this.logger.critical('message_blocked_banned', { userId, reasons: banCheck.reasons });
      return result;
    }
    const muteCheck = this.muteSystem.isMuted(userId);
    if (muteCheck.muted) {
      result.allowed = false; result.reason = `You are muted. Remaining: ${Math.ceil(this.muteSystem.getRemainingMuteTime(userId) / 1000)}s.`;
      result.action = 'mute'; violations.push({ type: 'muted', detail: muteCheck.reason });
      this.logger.warn('message_blocked_muted', { userId });
      return result;
    }
    const rateCheck = this.rateLimiter.check(userId, 'message', profile);
    if (!rateCheck.allowed) {
      result.allowed = false; result.reason = rateCheck.reason; result.action = 'rate_limit';
      violations.push({ type: 'rate_limit', detail: rateCheck.reason });
      this.logger.warn('message_rate_limited', { userId, reason: rateCheck.reason });
      return result;
    }
    if (message.length > CONFIG.MAX_MESSAGE_LENGTH) {
      result.allowed = false; result.reason = `Message too long (${message.length}/${CONFIG.MAX_MESSAGE_LENGTH}).`;
      result.action = 'reject'; violations.push({ type: 'too_long', detail: message.length });
      return result;
    }
    if (this.safeMode.isSafeMode(userId)) {
      const safeCheck = this.safeMode.canChat(userId, message);
      if (!safeCheck.allowed) {
        result.allowed = false; result.reason = safeCheck.reason; result.action = 'safe_mode';
        violations.push({ type: 'safe_mode', detail: safeCheck.reason });
        return result;
      }
    }
    const profanityCheck = this.normalizer.containsProfanity(message);
    if (profanityCheck.found) {
      violations.push({ type: 'profanity', words: profanityCheck.matches, severity: profanityCheck.severity });
      result.severity = Math.max(result.severity, profanityCheck.severity);
      result.censoredMessage = this.normalizer.censorText(message);
      this.logger.warn('profanity_detected', { userId, words: profanityCheck.matches, severity: profanityCheck.severity });
    }
    const pii = this.patternDetector.detectAllPII(message);
    const hasPII = pii.phones.length || pii.emails.length || pii.ssns.length || pii.creditCards.length || pii.ips.length || pii.crypto.length;
    if (hasPII) {
      violations.push({ type: 'pii', detail: pii });
      result.severity = Math.max(result.severity, 7);
      if (this.safeMode.isSafeMode(userId) || profile.accountCreatedAt > now() - CONFIG.NEW_ACCOUNT_THRESHOLD_MS) {
        result.allowed = false; result.reason = 'Personal information sharing is not allowed.';
        result.action = 'pii_blocked'; return result;
      }
    }
    const urlMatches = this.patternDetector.detectURLs(message);
    for (const url of urlMatches) {
      if (!this.patternDetector.isURLAllowed(url.domain)) {
        if (this.patternDetector.isURLBlocked(url.domain)) {
          violations.push({ type: 'malicious_url', url: url.domain });
          result.severity = Math.max(result.severity, 8);
          result.allowed = false; result.reason = 'Malicious URL detected.';
          result.action = 'url_blocked'; return result;
        }
        violations.push({ type: 'unauthorized_url', url: url.domain });
        if (!profile.verified && profile.accountCreatedAt > now() - CONFIG.NEW_ACCOUNT_THRESHOLD_MS) {
          result.allowed = false; result.reason = 'URL sharing restricted for new accounts.'; result.action = 'url_blocked'; return result;
        }
      }
    }
    const history = this._messageHistory.get(userId) || [];
    const spamCheck = this.patternDetector.isSpam(message, history);
    if (spamCheck.isSpam) {
      violations.push({ type: 'spam', detail: spamCheck });
      result.severity = Math.max(result.severity, 4);
      if (spamCheck.repeatedMessage) {
        result.allowed = false; result.reason = 'Repeated message detected (spam).'; result.action = 'spam';
        this.muteSystem.autoMuteForViolation(userId, 'spam', 5);
        return result;
      }
    }
    const invisible = this.patternDetector.detectInvisibleText(message);
    if (invisible.length > 0) {
      violations.push({ type: 'invisible_text', chars: invisible.length });
      result.severity = Math.max(result.severity, 3);
    }
    const markdownLinks = this.patternDetector.detectMarkdownLinks(message);
    if (markdownLinks.length > 0) {
      for (const link of markdownLinks) {
        const urlMatchesInLink = this.patternDetector.detectURLs(link.url);
        for (const url of urlMatchesInLink) {
          if (this.patternDetector.isURLBlocked(url.domain)) {
            violations.push({ type: 'obfuscated_url', url: url.domain });
            result.allowed = false; result.reason = 'Obfuscated malicious URL detected.'; result.action = 'url_blocked'; return result;
          }
        }
      }
    }
    if (profile.accountCreatedAt && profile.accountCreatedAt > now() - CONFIG.NEW_ACCOUNT_THRESHOLD_MS) {
      if (pii.discord.length || pii.social.length) {
        violations.push({ type: 'new_user_restriction', detail: 'Social handles restricted for new accounts.' });
        result.allowed = false; result.reason = 'Social platform sharing restricted for new accounts.'; result.action = 'new_user_restricted'; return result;
      }
    }
    if (result.severity >= 8) {
      result.action = 'auto_report';
      this.reportSystem.submitReport({ reporterId: 'system', targetId: userId, category: 'inappropriate_content', description: `Auto-detected severe violation (severity ${result.severity}). Violations: ${violations.map(v => v.type).join(', ')}`, evidence: { violations }, chatLog: [message] });
      this.muteSystem.autoMuteForViolation(userId, 'severe_violation', result.severity);
    } else if (result.severity >= 5) {
      result.action = 'warn';
      this.logger.warn('violation_warning', { userId, severity: result.severity, violations });
    }
    const historyArray = this._messageHistory.get(userId) || [];
    historyArray.push(message);
    if (historyArray.length > 100) historyArray.shift();
    this._messageHistory.set(userId, historyArray);
    return result;
  }

  processTradeRequest(userId, targetId, profile = {}) {
    const result = { allowed: true, reason: null, violations: [] };
    const banCheck = this.banSystem.isBanned(userId, profile.ip, this.accountProtection.generateDeviceFingerprint());
    if (banCheck.banned) { result.allowed = false; result.reason = 'Account banned.'; return result; }
    if (this.muteSystem.isMuted(userId).muted) { result.allowed = false; result.reason = 'You are muted.'; return result; }
    if (this.blockList.shouldPreventInteraction(userId, targetId)) { result.allowed = false; result.reason = 'Cannot trade with blocked user.'; return result; }
    const safeTrade = this.safeMode.canTrade(userId);
    if (!safeTrade.allowed) { result.allowed = false; result.reason = safeTrade.reason; return result; }
    const rateCheck = this.rateLimiter.check(userId, 'trade', profile);
    if (!rateCheck.allowed) { result.allowed = false; result.reason = rateCheck.reason; return result; }
    return result;
  }

  processAction(userId, actionType, profile = {}) {
    const rateCheck = this.rateLimiter.check(userId, 'action', profile);
    if (!rateCheck.allowed) {
      this.logger.warn('action_rate_limited', { userId, actionType, reason: rateCheck.reason });
      return { allowed: false, reason: rateCheck.reason };
    }
    return { allowed: true };
  }

  recordLogin(username, ip, passwordHash, success) {
    const result = this.accountProtection.recordLoginAttempt(username, ip, success);
    this.logger.info('login_attempt', { username, ip: ip ? hashString(ip) : null, success, locked: result.locked });
    if (!success) {
      const attempts = this.accountProtection._loginAttempts.get(`${username}:${ip || 'unknown'}`);
      if (attempts && attempts.count >= 3) {
        this.accountProtection.markIPSuspicious(ip, 'repeated_failed_logins');
      }
    }
    return result;
  }

  isAccountLocked(username) { return this.accountProtection.isAccountLocked(username); }

  blockUser(userId, targetId, reason) { return this.blockList.blockUser(userId, targetId, reason); }
  unblockUser(userId, targetId) { return this.blockList.unblockUser(userId, targetId); }
  isBlocked(userId, targetId) { return this.blockList.isBlocked(userId, targetId); }

  muteUser(userId, durationMs, reason, appliedBy) { return this.muteSystem.muteUser(userId, durationMs, reason, appliedBy); }
  unmuteUser(userId, appliedBy) { return this.muteSystem.unmuteUser(userId, appliedBy); }
  isMuted(userId) { return this.muteSystem.isMuted(userId); }

  banAccount(userId, reason, durationMs, appliedBy) { return this.banSystem.banAccount(userId, reason, durationMs, appliedBy); }
  banIP(ip, reason, durationMs, appliedBy) { return this.banSystem.banIP(ip, reason, durationMs, appliedBy); }
  banFingerprint(fp, reason, durationMs, appliedBy) { return this.banSystem.banFingerprint(fp, reason, durationMs, appliedBy); }
  banComprehensive(userId, ip, fp, reason, durationMs, appliedBy) { return this.banSystem.banUserComprehensive(userId, ip, fp, reason, durationMs, appliedBy); }
  unbanAccount(userId) { return this.banSystem.unbanAccount(userId); }
  unbanIP(ip) { return this.banSystem.unbanIP(ip); }
  unbanFingerprint(fp) { return this.banSystem.unbanFingerprint(fp); }
  isBanned(userId, ip, fp) { return this.banSystem.isBanned(userId, ip, fp); }

  submitReport(reportData) { return this.reportSystem.submitReport(reportData); }
  getReports(filters) { return this.reportSystem.getReports(filters); }
  getReportStats() { return this.reportSystem.getStats(); }

  enableSafeMode(userId, birthDate) { return this.safeMode.enableSafeMode(userId, birthDate); }
  disableSafeMode(userId, pin) { return this.safeMode.disableSafeMode(userId, pin); }
  isSafeMode(userId) { return this.safeMode.isSafeMode(userId); }

  getCSPHeader() { return this.csp.generateHeader(); }
  getCSPNonce() { return this.csp.getNonce(); }

  getSecurityLogs(filters) { return this.logger.getLogs(filters); }
  clearSecurityLogs() { this.logger.clearLogs(); }

  exportSecurityState() { return this.storage.exportSecure(); }

  on(eventName, callback) {
    if (!this._eventListeners.has(eventName)) this._eventListeners.set(eventName, []);
    this._eventListeners.get(eventName).push(callback);
  }

  off(eventName, callback) {
    if (!this._eventListeners.has(eventName)) return;
    const listeners = this._eventListeners.get(eventName);
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  }

  _emit(eventName, data) {
    if (!this._eventListeners.has(eventName)) return;
    for (const cb of this._eventListeners.get(eventName)) {
      try { cb(data); } catch (err) { /* ignore callback errors */ }
    }
  }

  destroy() {
    this.rateLimiter.destroy();
    this.accountProtection.destroy();
    this.muteSystem.destroy();
    this.banSystem.destroy();
    this.logger.destroy();
    this._eventListeners.clear();
    this._messageHistory.clear();
  }
}

export default ContentFirewall;
