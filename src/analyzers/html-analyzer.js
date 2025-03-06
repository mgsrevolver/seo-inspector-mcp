// src/analyzers/html-analyzer.js
import * as cheerio from 'cheerio';
import { detectTargetKeywords } from './keyword-analyzer.js';
import fs from 'fs/promises';
import path from 'path';

export function analyzeHtml(html, pageIdentifier) {
  const $ = cheerio.load(html);
  const issues = [];
  const recommendations = [];

  // Basic SEO checks
  const title = $('title').text();
  const metaDescription = $('meta[name="description"]').attr('content');
  const h1Count = $('h1').length;
  const h2Count = $('h2').length;
  const h3Count = $('h3').length;

  // Detect potential target keywords
  const keywordAnalysis = detectTargetKeywords(html, title, metaDescription);

  // Check for React-specific elements
  const hasReactRoot =
    $('#root').length > 0 ||
    $('#app').length > 0 ||
    $('[data-reactroot]').length > 0;

  // Check title - HIGH IMPACT
  if (!title) {
    issues.push({
      severity: 'high',
      message: 'Missing page title',
      impact: 90,
      area: 'Meta Tags',
    });
    recommendations.push({
      text: 'Add a descriptive page title',
      impact: 90,
      reason:
        'Title tags are a critical ranking factor and appear in search results',
      implementation: '<title>Your Primary Keyword - Your Brand Name</title>',
    });
  } else if (title.length > 60) {
    issues.push({
      severity: 'medium',
      message: `Title length (${title.length} chars) exceeds recommended maximum of 60 characters`,
      impact: 70,
      area: 'Meta Tags',
    });
    recommendations.push({
      text: 'Shorten title to under 60 characters',
      impact: 70,
      reason: 'Long titles get truncated in search results',
      implementation: `<title>${title.substring(0, 57)}...</title>`,
    });
  }

  // Check meta description
  if (!metaDescription) {
    issues.push({
      severity: 'high',
      message: 'Missing meta description',
      impact: 80,
      area: 'Meta Tags',
    });
    recommendations.push({
      text: 'Add a descriptive meta description',
      impact: 80,
      reason:
        'Meta descriptions appear in search results and affect click-through rates',
      implementation:
        '<meta name="description" content="A compelling description of your page that includes target keywords and encourages clicks.">',
    });
  } else if (metaDescription.length < 50 || metaDescription.length > 160) {
    issues.push({
      severity: 'medium',
      message: `Meta description length (${metaDescription.length} chars) outside recommended range (50-160)`,
      impact: 60,
      area: 'Meta Tags',
    });
    recommendations.push({
      text: 'Adjust meta description to be between 50-160 characters',
      impact: 60,
      reason:
        'Descriptions outside this range may be truncated or considered thin content',
      implementation:
        metaDescription.length < 50
          ? 'Expand your meta description to be more descriptive and include target keywords'
          : 'Shorten your meta description to ensure it displays properly in search results',
    });
  }

  // Check headings
  if (h1Count === 0) {
    issues.push({
      severity: 'high',
      message: 'No H1 heading found',
      impact: 85,
      area: 'Content Structure',
    });
    recommendations.push({
      text: 'Add an H1 heading to your page',
      impact: 85,
      reason:
        'H1 headings help search engines understand the main topic of your page',
      implementation: '<h1>Your Primary Keyword/Topic</h1>',
    });
  } else if (h1Count > 1) {
    issues.push({
      severity: 'medium',
      message: `Multiple H1 headings found (${h1Count})`,
      impact: 65,
      area: 'Content Structure',
    });
    recommendations.push({
      text: 'Use only one H1 heading per page',
      impact: 65,
      reason:
        'Multiple H1s can confuse search engines about the main topic of your page',
      implementation: 'Keep the most important H1 and change others to H2',
    });
  }

  // Check images
  const imagesWithoutAlt = [];
  $('img').each((i, img) => {
    const alt = $(img).attr('alt');
    const src = $(img).attr('src') || 'unknown image';
    if (!alt && !$(img).attr('role')) {
      imagesWithoutAlt.push(src);
      issues.push({
        severity: 'medium',
        message: `Image missing alt text: ${src}`,
        impact: 60,
        area: 'Accessibility',
      });
    }
  });

  if (imagesWithoutAlt.length > 0) {
    recommendations.push({
      text: 'Add alt text to all images',
      impact: 60,
      reason:
        'Alt text improves accessibility and helps search engines understand image content',
      implementation:
        '<img src="image.jpg" alt="Descriptive text about the image">',
    });
  }

  // Check for schema markup
  const schemas = [];
  $('script[type="application/ld+json"]').each((i, script) => {
    try {
      const schema = JSON.parse($(script).html());
      schemas.push(schema);
    } catch (e) {
      issues.push({
        severity: 'high',
        message: 'Invalid JSON-LD schema',
        impact: 70,
        area: 'Structured Data',
      });
    }
  });

  if (schemas.length === 0) {
    issues.push({
      severity: 'medium',
      message: 'No structured data (schema.org) found',
      impact: 65,
      area: 'Structured Data',
    });
    recommendations.push({
      text: 'Add structured data using JSON-LD',
      impact: 65,
      reason:
        'Structured data helps search engines understand your content and can enable rich results',
      implementation: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "${title || 'Page title'}",
  "description": "${metaDescription || 'Page description'}"
}
</script>`,
    });
  }

  // Sort recommendations by impact
  recommendations.sort((a, b) => b.impact - a.impact);

  return {
    pageIdentifier,
    title,
    metaDescription,
    headingStructure: {
      h1: h1Count,
      h2: h2Count,
      h3: h3Count,
    },
    schemaCount: schemas.length,
    issues: issues.sort((a, b) => b.impact - a.impact),
    recommendations,
    isReactApp: hasReactRoot,
    keywordAnalysis,
  };
}
