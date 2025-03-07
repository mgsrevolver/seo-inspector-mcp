// src/analyzers/keyword-analyzer.js
import * as cheerio from 'cheerio';

// Simple stemming function (very basic, but works for common cases)
function simpleStem(word) {
  word = word.toLowerCase();

  // Handle common endings
  if (word.endsWith('ing')) return word.slice(0, -3);
  if (word.endsWith('ly')) return word.slice(0, -2);
  if (word.endsWith('es')) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  if (word.endsWith('ed')) return word.slice(0, -2);
  if (word.endsWith('er')) return word.slice(0, -2);
  if (word.endsWith('ment')) return word.slice(0, -4);
  if (word.endsWith('tion')) return word.slice(0, -4);

  return word;
}

export function detectTargetKeywords(html, title, metaDescription) {
  const $ = cheerio.load(html);
  const bodyText = $('body').text().toLowerCase();

  // Remove common words and keep only potential keywords
  const commonWords = [
    'a',
    'an',
    'the',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'with',
    'by',
    'about',
    'as',
    'of',
    'from',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'should',
    'could',
    'can',
    'may',
    'might',
    'must',
    'shall',
    'this',
    'that',
    'these',
    'those',
    'it',
    'they',
    'them',
    'their',
    'we',
    'us',
    'our',
    'you',
    'your',
    'he',
    'him',
    'his',
    'she',
    'her',
    'hers',
    'i',
    'me',
    'my',
    'mine',
    'who',
    'whom',
    'whose',
    'which',
    'what',
    'when',
    'where',
    'why',
    'how',
    'all',
    'any',
    'both',
    'each',
    'few',
    'more',
    'most',
    'some',
    'such',
    'no',
    'nor',
    'not',
    'only',
    'own',
    'same',
    'so',
    'than',
    'too',
    'very',
  ];

  // Extract words from title, meta description, and headings
  const titleWords = title ? title.toLowerCase().split(/\s+/) : [];
  const metaWords = metaDescription
    ? metaDescription.toLowerCase().split(/\s+/)
    : [];
  const h1Words = [];
  $('h1').each((i, el) => {
    h1Words.push(...$(el).text().toLowerCase().split(/\s+/));
  });

  // Add h2 words collection
  const h2Words = [];
  $('h2').each((i, el) => {
    h2Words.push(...$(el).text().toLowerCase().split(/\s+/));
  });

  // Combine all important words
  const importantWords = [...titleWords, ...metaWords, ...h1Words, ...h2Words];

  // Count word frequency in body text
  const wordCounts = {};
  const stemmedWordMap = {}; // Maps stemmed words to original forms
  const words = bodyText.split(/\s+/);
  const totalWords = words.length;

  words.forEach((word) => {
    // Clean the word (remove punctuation, etc.)
    const cleanWord = word.replace(/[^\w\s]/g, '').trim();
    if (cleanWord && cleanWord.length > 3 && !commonWords.includes(cleanWord)) {
      // Get the stem of the word
      const stemmed = simpleStem(cleanWord);

      // Count the stemmed word
      wordCounts[stemmed] = (wordCounts[stemmed] || 0) + 1;

      // Keep track of the original form (use the most frequent one)
      if (
        !stemmedWordMap[stemmed] ||
        words.filter((w) => w === cleanWord).length >
          words.filter((w) => w === stemmedWordMap[stemmed]).length
      ) {
        stemmedWordMap[stemmed] = cleanWord;
      }
    }
  });

  // Count 2-word phrases (potential keywords)
  const phraseCounts = {};
  const originalPhraseMap = {}; // Maps normalized phrases to original forms

  for (let i = 0; i < words.length - 1; i++) {
    const word1 = words[i].replace(/[^\w\s]/g, '').trim();
    const word2 = words[i + 1].replace(/[^\w\s]/g, '').trim();

    if (
      word1 &&
      word2 &&
      word1.length > 2 &&
      word2.length > 2 &&
      !commonWords.includes(word1) &&
      !commonWords.includes(word2)
    ) {
      const phrase = `${word1} ${word2}`;
      const normalizedPhrase = `${simpleStem(word1)} ${simpleStem(word2)}`;

      phraseCounts[normalizedPhrase] =
        (phraseCounts[normalizedPhrase] || 0) + 1;

      // Keep track of the original form
      if (!originalPhraseMap[normalizedPhrase]) {
        originalPhraseMap[normalizedPhrase] = phrase;
      }
    }
  }

  // Prioritize words that appear in title, meta description, and h1
  const scoredWords = Object.keys(wordCounts).map((stemmed) => {
    let score = wordCounts[stemmed];
    const originalWord = stemmedWordMap[stemmed];

    // Boost score if word appears in important elements
    const stemmedImportantWords = importantWords.map((w) => simpleStem(w));
    if (stemmedImportantWords.includes(stemmed)) {
      score += 10;
    }

    if (titleWords.map((w) => simpleStem(w)).includes(stemmed)) score += 10;
    if (metaWords.map((w) => simpleStem(w)).includes(stemmed)) score += 5;
    if (h1Words.map((w) => simpleStem(w)).includes(stemmed)) score += 8;
    if (h2Words.map((w) => simpleStem(w)).includes(stemmed)) score += 6;

    // Calculate density (for analysis only, not for recommendations)
    const density = ((wordCounts[stemmed] / totalWords) * 100).toFixed(2);

    return {
      word: originalWord,
      score,
      density,
      inTitle: titleWords.map((w) => simpleStem(w)).includes(stemmed),
      inMetaDescription: metaWords.map((w) => simpleStem(w)).includes(stemmed),
      inH1: h1Words.map((w) => simpleStem(w)).includes(stemmed),
      inH2: h2Words.map((w) => simpleStem(w)).includes(stemmed),
    };
  });

  // Prioritize phrases that appear in title, meta description, and h1
  const scoredPhrases = Object.keys(phraseCounts).map((normalizedPhrase) => {
    let score = phraseCounts[normalizedPhrase] * 1.5; // Phrases are more valuable than single words
    const originalPhrase = originalPhraseMap[normalizedPhrase];
    const phraseWords = normalizedPhrase.split(' ');

    // Boost score if phrase appears in important elements
    const inTitle =
      title && phraseWords.every((pw) => title.toLowerCase().includes(pw));
    const inMetaDescription =
      metaDescription &&
      phraseWords.every((pw) => metaDescription.toLowerCase().includes(pw));

    if (inTitle) score += 15;
    if (inMetaDescription) score += 10;

    let inH1 = false;
    $('h1').each((i, el) => {
      const h1Text = $(el).text().toLowerCase();
      if (phraseWords.every((pw) => h1Text.includes(pw))) {
        inH1 = true;
      }
    });

    let inH2 = false;
    $('h2').each((i, el) => {
      const h2Text = $(el).text().toLowerCase();
      if (phraseWords.every((pw) => h2Text.includes(pw))) {
        inH2 = true;
      }
    });

    if (inH1) score += 12;
    if (inH2) score += 8;

    // Calculate density (for analysis only, not for recommendations)
    const density = (
      (phraseCounts[normalizedPhrase] / (totalWords - 1)) *
      100
    ).toFixed(2);

    return {
      phrase: originalPhrase,
      score,
      density,
      inTitle,
      inMetaDescription,
      inH1,
      inH2,
    };
  });

  // Sort by score and take top results
  const topWords = scoredWords.sort((a, b) => b.score - a.score).slice(0, 5);
  const topPhrases = scoredPhrases
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Add placement analysis for the top phrase
  const placementAnalysis =
    topPhrases.length > 0
      ? {
          primaryPhrase: topPhrases[0].phrase,
          inTitle: topPhrases[0].inTitle,
          inMetaDescription: topPhrases[0].inMetaDescription,
          inH1: topPhrases[0].inH1,
          inH2: topPhrases[0].inH2,
          missingFrom: [],
        }
      : null;

  if (!placementAnalysis.inTitle) placementAnalysis.missingFrom.push('title');
  if (!placementAnalysis.inMetaDescription)
    placementAnalysis.missingFrom.push('meta description');
  if (!placementAnalysis.inH1) placementAnalysis.missingFrom.push('H1 heading');
  if (!placementAnalysis.inH2)
    placementAnalysis.missingFrom.push('H2 headings');

  return {
    singleWords: topWords,
    phrases: topPhrases,
    placementAnalysis,
    keywordSummary: {
      primaryPhrase: topPhrases.length > 0 ? topPhrases[0].phrase : null,
      secondaryPhrases: topPhrases.slice(1, 3).map((p) => p.phrase),
      topSingleWords: topWords.slice(0, 3).map((w) => w.word),
    },
  };
}
