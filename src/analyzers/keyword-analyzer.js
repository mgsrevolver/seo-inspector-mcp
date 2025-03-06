// src/analyzers/keyword-analyzer.js
import * as cheerio from 'cheerio';

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
  const words = bodyText.split(/\s+/);

  words.forEach((word) => {
    // Clean the word (remove punctuation, etc.)
    const cleanWord = word.replace(/[^\w\s]/g, '').trim();
    if (cleanWord && cleanWord.length > 3 && !commonWords.includes(cleanWord)) {
      wordCounts[cleanWord] = (wordCounts[cleanWord] || 0) + 1;
    }
  });

  // Count 2-word phrases (potential keywords)
  const phraseCounts = {};
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
      phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1;
    }
  }

  // Prioritize words that appear in title, meta description, and h1
  const scoredWords = Object.keys(wordCounts).map((word) => {
    let score = wordCounts[word];

    // Boost score if word appears in important elements
    if (titleWords.includes(word)) score += 10;
    if (metaWords.includes(word)) score += 5;
    if (h1Words.includes(word)) score += 8;

    return { word, score };
  });

  // Prioritize phrases that appear in title, meta description, and h1
  const scoredPhrases = Object.keys(phraseCounts).map((phrase) => {
    let score = phraseCounts[phrase] * 1.5; // Phrases are more valuable than single words
    const phraseWords = phrase.split(' ');

    // Boost score if phrase appears in important elements
    if (title && title.toLowerCase().includes(phrase)) score += 15;
    if (metaDescription && metaDescription.toLowerCase().includes(phrase))
      score += 10;
    $('h1').each((i, el) => {
      if ($(el).text().toLowerCase().includes(phrase)) score += 12;
    });

    return { phrase, score };
  });

  // Sort by score and take top results
  const topWords = scoredWords.sort((a, b) => b.score - a.score).slice(0, 5);
  const topPhrases = scoredPhrases
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    singleWords: topWords,
    phrases: topPhrases,
  };
}
