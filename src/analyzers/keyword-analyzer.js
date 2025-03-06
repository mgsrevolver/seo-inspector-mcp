// src/analyzers/keyword-analyzer.js
import * as cheerio from 'cheerio';
import natural from 'natural';

// Initialize the stemmer and lemmatizer
const stemmer = natural.PorterStemmer;
const wordnet = new natural.WordNet();

// Function to get the base form of a word (using stemming as fallback if lemmatization fails)
async function normalizeWord(word) {
  return new Promise((resolve) => {
    // Try lemmatization first (more accurate but slower)
    wordnet.lookup(word, (results) => {
      if (results && results.length > 0 && results[0].lemma) {
        resolve(results[0].lemma);
      } else {
        // Fall back to stemming if lemmatization fails
        resolve(stemmer.stem(word));
      }

      // Set a timeout in case WordNet hangs
      setTimeout(() => {
        resolve(stemmer.stem(word));
      }, 50);
    });
  });
}

// Get stem immediately without async (for cases where we need synchronous processing)
function stemWord(word) {
  return stemmer.stem(word);
}

export async function detectTargetKeywords(html, title, metaDescription) {
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

  // Combine all important words
  const importantWords = [...titleWords, ...metaWords, ...h1Words];

  // Count word frequency in body text
  const wordCounts = {};
  const normalizedWordMap = {}; // Maps normalized words back to their most common original form
  const words = bodyText.split(/\s+/);

  // First pass: stem all words and count frequencies
  for (let i = 0; i < words.length; i++) {
    // Clean the word (remove punctuation, etc.)
    const word = words[i].replace(/[^\w\s]/g, '').trim();

    if (word && word.length > 3 && !commonWords.includes(word)) {
      // Use stemming for the first pass (faster)
      const stemmedWord = stemWord(word);

      // Count the stemmed word
      wordCounts[stemmedWord] = (wordCounts[stemmedWord] || 0) + 1;

      // Keep track of the original forms
      if (
        !normalizedWordMap[stemmedWord] ||
        words.filter((w) => stemWord(w) === stemmedWord).length >
          words.filter((w) => w === normalizedWordMap[stemmedWord]).length
      ) {
        normalizedWordMap[stemmedWord] = word;
      }
    }
  }

  // Count 2-word phrases (potential keywords)
  const phraseCounts = {};
  const normalizedPhraseMap = {}; // Maps normalized phrases back to their original form

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
      // Create the original phrase
      const originalPhrase = `${word1} ${word2}`;

      // Stem both words for the normalized phrase
      const stemmedWord1 = stemWord(word1);
      const stemmedWord2 = stemWord(word2);
      const normalizedPhrase = `${stemmedWord1} ${stemmedWord2}`;

      // Count the normalized phrase
      phraseCounts[normalizedPhrase] =
        (phraseCounts[normalizedPhrase] || 0) + 1;

      // Keep track of the original form (use the most frequent one)
      if (
        !normalizedPhraseMap[normalizedPhrase] ||
        phraseCounts[normalizedPhrase] >
          (phraseCounts[normalizedPhraseMap[normalizedPhrase]] || 0)
      ) {
        normalizedPhraseMap[normalizedPhrase] = originalPhrase;
      }
    }
  }

  // Prioritize words that appear in title, meta description, and h1
  const scoredWords = Object.keys(wordCounts).map((stemmedWord) => {
    let score = wordCounts[stemmedWord];
    const originalWord = normalizedWordMap[stemmedWord];

    // Boost score if word appears in important elements
    // We need to check if any variation of the word appears in these elements
    const inTitle = titleWords.some((w) => stemWord(w) === stemmedWord);
    const inMeta = metaWords.some((w) => stemWord(w) === stemmedWord);
    const inH1 = h1Words.some((w) => stemWord(w) === stemmedWord);

    if (inTitle) score += 10;
    if (inMeta) score += 5;
    if (inH1) score += 8;

    return { word: originalWord, stem: stemmedWord, score };
  });

  // Prioritize phrases that appear in title, meta description, and h1
  const scoredPhrases = Object.keys(phraseCounts).map((normalizedPhrase) => {
    let score = phraseCounts[normalizedPhrase] * 1.5; // Phrases are more valuable than single words
    const originalPhrase = normalizedPhraseMap[normalizedPhrase];

    // Check if any variation of the phrase appears in important elements
    const phraseInTitle =
      title && stemWord(title.toLowerCase()).includes(normalizedPhrase);
    const phraseInMeta =
      metaDescription &&
      stemWord(metaDescription.toLowerCase()).includes(normalizedPhrase);
    let phraseInH1 = false;

    $('h1').each((i, el) => {
      if (stemWord($(el).text().toLowerCase()).includes(normalizedPhrase)) {
        phraseInH1 = true;
      }
    });

    if (phraseInTitle) score += 15;
    if (phraseInMeta) score += 10;
    if (phraseInH1) score += 12;

    return { phrase: originalPhrase, normalizedPhrase, score };
  });

  // Sort by score and take top results
  const topWords = scoredWords.sort((a, b) => b.score - a.score).slice(0, 5);
  const topPhrases = scoredPhrases
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Calculate keyword density for top words and phrases
  const totalWords = words.length;

  const topWordsWithDensity = topWords.map((word) => ({
    ...word,
    density: ((wordCounts[word.stem] / totalWords) * 100).toFixed(2) + '%',
  }));

  const topPhrasesWithDensity = topPhrases.map((phrase) => ({
    ...phrase,
    density:
      (
        (phraseCounts[phrase.normalizedPhrase] / (totalWords - 1)) *
        100
      ).toFixed(2) + '%',
  }));

  return {
    singleWords: topWordsWithDensity,
    phrases: topPhrasesWithDensity,
  };
}
