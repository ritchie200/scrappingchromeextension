(function (root) {
  "use strict";

  const NAME_WORD = String.raw`[A-Z][A-Za-z]+(?:['-][A-Z][A-Za-z]+)?`;
  const INITIAL = String.raw`[A-Z]\.`;
  const NAME_TOKEN = String.raw`(?:${NAME_WORD}|${INITIAL})`;
  const NAME_SEPARATOR = String.raw`[ \t]+`;
  const NAME_PATTERN = String.raw`${NAME_TOKEN}(?:${NAME_SEPARATOR}${NAME_TOKEN}){1,3}`;
  const ROLE_PATTERN = [
    "CEO",
    "CTO",
    "CFO",
    "COO",
    "Founder",
    "Co-Founder",
    "President",
    "Vice President",
    "VP",
    "Director",
    "Manager",
    "Lead",
    "Head of",
    "Owner",
    "Partner",
    "Principal",
    "Recruiter",
    "Engineer",
    "Designer",
    "Developer",
    "Consultant",
    "Advisor",
    "Attorney",
    "Professor",
    "Editor",
    "Reporter",
    "Author",
    "Speaker",
    "Host",
    "Presenter",
    "Contact"
  ].join("|");

  const COMMON_FIRST_NAMES = new Set([
    "aaron", "abby", "abdul", "abigail", "adam", "adrian", "aisha", "alex",
    "alexander", "alexandra", "alice", "alicia", "alina", "allison", "amanda",
    "amber", "amelia", "amy", "andrea", "andrew", "angela", "anna", "anthony",
    "antonio", "april", "arjun", "ashley", "austin", "ava", "barbara",
    "ben", "benjamin", "beth", "brian", "brittany", "bruce", "caitlin",
    "carlos", "carol", "caroline", "catherine", "charles", "charlotte",
    "chris", "christian", "christina", "christopher", "claire", "daniel",
    "danielle", "david", "deborah", "dennis", "diana", "diego", "donald",
    "donna", "edward", "elena", "elizabeth", "ella", "emily", "emma",
    "eric", "ethan", "eva", "fatima", "frank", "gabriel", "george",
    "grace", "hannah", "harry", "heather", "henry", "isabella", "jack",
    "jacob", "james", "jane", "janet", "jason", "jennifer", "jeremy",
    "jessica", "john", "jonathan", "jose", "joseph", "joshua", "julia",
    "julie", "justin", "karen", "katherine", "kathryn", "kevin", "kim",
    "laura", "lauren", "linda", "lisa", "luis", "maria", "marie", "mark",
    "martha", "martin", "mary", "matthew", "megan", "michael", "michelle",
    "natalie", "nathan", "nicole", "olivia", "omar", "patricia", "paul",
    "peter", "priya", "rachel", "rahul", "rebecca", "richard", "ritchie",
    "robert", "ryan", "samantha", "samuel", "sandra", "sarah", "scott",
    "sean", "sharon", "sophia", "stephen", "steven", "susan", "thomas",
    "timothy", "victoria", "william", "yusuf", "zoe"
  ]);

  const STOP_TOKENS = new Set([
    "About", "Account", "Admin", "Advertising", "All", "Analytics", "April",
    "Archive", "August", "Author", "Blog", "Board", "Business", "By", "Careers", "Cart",
    "Case", "Category", "Checkout", "Chrome", "City", "Community", "Company",
    "Contact", "Cookie", "Cookies", "Copyright", "Country", "Dashboard",
    "December", "Demo", "Docs", "Documentation", "Download", "Edited", "Email",
    "English", "Events", "Facebook", "Faq", "February", "Features", "Friday",
    "Github", "Google", "Help", "Home", "Instagram", "January", "July",
    "June", "Legal", "Linkedin", "Login", "March", "May", "Menu", "Monday",
    "News", "Newsletter", "November", "October", "Order", "Page", "Person", "Policy",
    "Posted", "Press", "Pricing", "Privacy", "Products", "Profile", "Read", "Resources",
    "Saturday", "Search", "September", "Services", "Settings", "Shop", "Sign",
    "Solutions", "State", "States", "Store", "Subscribe", "Sunday", "Support",
    "Team", "Terms", "Thursday", "Today", "Tuesday", "Twitter", "United",
    "Wednesday", "Welcome", "Written", "YouTube"
  ]);

  const ORGANIZATION_SUFFIXES = new Set([
    "Agency", "Association", "Bank", "Capital", "Clinic", "College", "Company",
    "Corp", "Corporation", "Foundation", "Group", "Hospital", "Inc", "Institute",
    "Labs", "LLC", "Ltd", "Media", "Network", "Partners", "School", "Studio",
    "Systems", "Technologies", "University"
  ]);

  const HONORIFICS = /^(?:Dr|Mr|Mrs|Ms|Miss|Prof)\.?\s+/i;
  const SUFFIXES = /\s+(?:Jr|Sr|II|III|IV)\.?$/i;
  const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+\b/gi;
  const PHONE_PATTERN = /(?:\+?\d[\d().\-\s]{7,}\d)/g;

  function parseNamesFromText(text) {
    const candidates = new Map();
    const safeText = stripNonNameData(String(text || ""));
    const lines = safeText
      .split(/\r?\n/)
      .map((line) => normalizeLine(line))
      .filter(Boolean);

    parseLabeledNames(safeText, candidates);
    parseRoleNames(safeText, candidates);
    parseStandaloneLines(lines, candidates);
    parseLikelyNames(safeText, candidates);

    return Array.from(candidates.values())
      .map((candidate) => ({
        name: candidate.name,
        confidence: toConfidence(candidate.score),
        score: Math.min(99, Math.round(candidate.score)),
        matchCount: candidate.matchCount
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 100);
  }

  function parseLabeledNames(text, candidates) {
    const labeledPattern = new RegExp(
      String.raw`\b(?:by|author|written by|edited by|reviewed by|posted by|reported by|contact(?: person)?|sales contact|account manager|hiring manager|speaker|host|presenter|moderator)\s*[:\-]?\s+(${NAME_PATTERN})`,
      "gi"
    );

    collectMatches(labeledPattern, text, (match) => {
      addCandidate(candidates, match[1], 84);
    });

    const honorificPattern = new RegExp(
      String.raw`\b(?:Dr|Mr|Mrs|Ms|Miss|Prof)\.?\s+(${NAME_PATTERN})`,
      "g"
    );

    collectMatches(honorificPattern, text, (match) => {
      addCandidate(candidates, match[1], 82);
    });
  }

  function parseRoleNames(text, candidates) {
    const nameBeforeRole = new RegExp(
      String.raw`\b(${NAME_PATTERN})\s*(?:,|\||-|/)\s*(?:${ROLE_PATTERN})\b`,
      "g"
    );

    collectMatches(nameBeforeRole, text, (match) => {
      addCandidate(candidates, match[1], 78);
    });

    const roleBeforeName = new RegExp(
      String.raw`\b(?:${ROLE_PATTERN})\s*[:\-]?\s+(${NAME_PATTERN})\b`,
      "g"
    );

    collectMatches(roleBeforeName, text, (match) => {
      addCandidate(candidates, match[1], 74);
    });
  }

  function parseStandaloneLines(lines, candidates) {
    const standalonePattern = new RegExp(String.raw`^(${NAME_PATTERN})$`);

    lines.forEach((line) => {
      if (line.length > 80 || /[.!?@:]/.test(line)) {
        return;
      }

      const match = line.match(standalonePattern);

      if (!match) {
        return;
      }

      const cleaned = cleanCandidateName(match[1]);
      const score = hasCommonFirstName(cleaned) ? 70 : 58;
      addCandidate(candidates, cleaned, score);
    });
  }

  function parseLikelyNames(text, candidates) {
    const likelyPattern = new RegExp(String.raw`\b(${NAME_PATTERN})\b`, "g");

    collectMatches(likelyPattern, text, (match) => {
      const rawName = match[1];
      const context = getContext(text, match.index, rawName.length).toLowerCase();
      const hasRoleContext = /\b(by|author|contact|founder|director|manager|speaker|host|editor|reporter|professor|recruiter)\b/.test(context);
      const baseScore = hasRoleContext ? 64 : 48;
      addCandidate(candidates, rawName, hasCommonFirstName(rawName) ? baseScore + 8 : baseScore);
    });
  }

  function addCandidate(candidates, rawName, baseScore) {
    const name = cleanCandidateName(rawName);

    if (!looksLikePersonName(name)) {
      return;
    }

    const key = normalizeNameKey(name);
    const existing = candidates.get(key);
    const adjustedScore = adjustScore(name, baseScore);

    if (existing) {
      existing.matchCount += 1;
      existing.score = Math.min(99, Math.max(existing.score, adjustedScore) + Math.min(existing.matchCount, 6));
      return;
    }

    candidates.set(key, {
      name,
      score: adjustedScore,
      matchCount: 1
    });
  }

  function adjustScore(name, baseScore) {
    let score = baseScore;
    const tokens = splitNameTokens(name);

    if (hasCommonFirstName(name)) {
      score += 6;
    }

    if (tokens.length === 2) {
      score += 2;
    }

    if (tokens.length > 3) {
      score -= 3;
    }

    return score;
  }

  function looksLikePersonName(name) {
    if (!name || /[@\d/\\]/.test(name)) {
      return false;
    }

    const tokens = splitNameTokens(name);

    if (tokens.length < 2 || tokens.length > 4) {
      return false;
    }

    if (tokens.some((token) => STOP_TOKENS.has(stripToken(token)))) {
      return false;
    }

    if (tokens.some((token) => ORGANIZATION_SUFFIXES.has(stripToken(token)))) {
      return false;
    }

    if (tokens.every((token) => token.length <= 2 || /^[A-Z]\.?$/.test(token))) {
      return false;
    }

    if (!tokens.every(isNameToken)) {
      return false;
    }

    return true;
  }

  function isNameToken(token) {
    const stripped = stripToken(token);

    if (/^[A-Z]\.$/.test(token)) {
      return true;
    }

    return /^[A-Z][A-Za-z]+(?:['-][A-Z][A-Za-z]+)?$/.test(stripped);
  }

  function cleanCandidateName(value) {
    let name = String(value || "")
      .replace(EMAIL_PATTERN, " ")
      .replace(URL_PATTERN, " ")
      .replace(PHONE_PATTERN, " ")
      .replace(/[(){}\[\]"“”]/g, " ")
      .replace(/[,:;]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    name = name.replace(HONORIFICS, "").replace(SUFFIXES, "").trim();
    name = name.split(/\s+(?:at|from|with|for)\s+/i)[0].trim();

    return splitNameTokens(name)
      .map(normalizeTokenCase)
      .join(" ");
  }

  function stripNonNameData(text) {
    return text
      .replace(EMAIL_PATTERN, " ")
      .replace(URL_PATTERN, " ")
      .replace(PHONE_PATTERN, " ");
  }

  function normalizeLine(line) {
    return line
      .replace(/\s+/g, " ")
      .replace(/^[\s\-*|•]+/, "")
      .replace(/[\s\-*|•]+$/, "")
      .trim();
  }

  function normalizeNameKey(name) {
    return splitNameTokens(name)
      .map((token) => stripToken(token).toLowerCase())
      .join(" ");
  }

  function splitNameTokens(name) {
    return String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  function stripToken(token) {
    return String(token || "").replace(/^[^A-Za-z]+|[^A-Za-z.]+$/g, "");
  }

  function normalizeTokenCase(token) {
    const stripped = stripToken(token);

    if (/^[A-Z]{2,}$/.test(stripped)) {
      return token.charAt(0) + token.slice(1).toLowerCase();
    }

    return token;
  }

  function hasCommonFirstName(name) {
    const [firstName] = splitNameTokens(cleanCandidateName(name));

    if (!firstName) {
      return false;
    }

    return COMMON_FIRST_NAMES.has(stripToken(firstName).toLowerCase());
  }

  function collectMatches(regex, text, callback) {
    regex.lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      callback(match);

      if (match[0].length === 0) {
        regex.lastIndex += 1;
      }
    }
  }

  function getContext(text, index, length) {
    const start = Math.max(0, index - 60);
    const end = Math.min(text.length, index + length + 60);
    return text.slice(start, end);
  }

  function toConfidence(score) {
    if (score >= 80) {
      return "high";
    }

    if (score >= 60) {
      return "medium";
    }

    return "low";
  }

  const api = {
    parseNamesFromText,
    cleanCandidateName,
    normalizeNameKey
  };

  root.VisibleNameParser = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
