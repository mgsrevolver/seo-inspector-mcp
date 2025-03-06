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

  // Check for robots meta tag
  const robotsContent = $('meta[name="robots"]').attr('content');
  const hasNoIndex = robotsContent && robotsContent.includes('noindex');
  const hasNoFollow = robotsContent && robotsContent.includes('nofollow');

  // Check for canonical URL
  const canonicalUrl = $('link[rel="canonical"]').attr('href');

  // Check for social media tags
  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogDescription = $('meta[property="og:description"]').attr('content');
  const ogImage = $('meta[property="og:image"]').attr('content');
  const twitterCard = $('meta[name="twitter:card"]').attr('content');
  const twitterTitle = $('meta[name="twitter:title"]').attr('content');
  const twitterDescription = $('meta[name="twitter:description"]').attr(
    'content'
  );
  const twitterImage = $('meta[name="twitter:image"]').attr('content');

  // Detect potential target keywords
  const keywordAnalysis = detectTargetKeywords(html, title, metaDescription);

  // Check for React-specific elements
  const hasReactRoot =
    $('#root').length > 0 ||
    $('#app').length > 0 ||
    $('[data-reactroot]').length > 0;

  // Check for empty divs that might be React mounting points
  const emptyRootDivs = $('div:empty').length;
  const hasReactScripts =
    $('script').filter((i, el) => {
      const src = $(el).attr('src') || '';
      return (
        src.includes('react') || src.includes('bundle') || src.includes('chunk')
      );
    }).length > 0;

  // More confidently determine if it's a React app
  const isReactApp = hasReactRoot || (emptyRootDivs > 0 && hasReactScripts);

  // Calculate analysis confidence score
  let confidenceScore = 100;

  // If it's a React app, add a specific warning about client-side rendering
  if (isReactApp) {
    // Reduce confidence score for React apps
    confidenceScore = 40;

    issues.push({
      severity: 'critical',
      message:
        '⚠️ WARNING: This is a client-side rendered React app - this analysis is INCOMPLETE',
      impact: 100,
      area: 'Analysis Limitations',
    });

    issues.push({
      severity: 'critical',
      message:
        'Client-side rendered React apps hide content from this analyzer',
      impact: 95,
      area: 'Framework',
    });

    recommendations.push({
      text: 'Switch to server-side rendering for better SEO',
      impact: 95,
      reason:
        'This analysis only sees your initial HTML, not the content rendered by React',
      implementation:
        'Migrate to Next.js, Gatsby, or implement server-side rendering in your current setup',
    });

    recommendations.push({
      text: 'For accurate analysis, view your page source and analyze what search engines actually see',
      impact: 90,
      reason:
        'What you see in the browser is different from what search engines see',
      implementation:
        'Right-click your page and select "View Page Source" to see what search engines see',
    });
  }

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
  } else if (title.length < 30) {
    issues.push({
      severity: 'medium',
      message: `Title is too short (${title.length} chars) - aim for 50-60 characters`,
      impact: 75,
      area: 'Meta Tags',
    });
    recommendations.push({
      text: 'Expand your title to be more descriptive',
      impact: 75,
      reason:
        'Short titles miss opportunities to include keywords and attract clicks',
      implementation: `<title>${title} | Add More Keywords and Brand</title>`,
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

  // Check robots meta tag
  if (hasNoIndex) {
    issues.push({
      severity: 'critical',
      message:
        'Page has noindex directive - it will not appear in search results',
      impact: 100,
      area: 'Indexability',
    });
    recommendations.push({
      text: 'Remove noindex directive if you want this page to be indexed',
      impact: 100,
      reason:
        'The noindex directive explicitly tells search engines not to include this page in search results',
      implementation:
        'Change to <meta name="robots" content="index,follow"> or remove the tag entirely',
    });
  }

  if (hasNoFollow) {
    issues.push({
      severity: 'high',
      message:
        'Page has nofollow directive - search engines will not follow links',
      impact: 85,
      area: 'Indexability',
    });
    recommendations.push({
      text: 'Remove nofollow directive if you want link equity to flow through this page',
      impact: 85,
      reason:
        'The nofollow directive prevents search engines from following links on this page',
      implementation:
        'Change to <meta name="robots" content="index,follow"> or remove the tag entirely',
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

  // Check for heading hierarchy
  if (h1Count === 0 && h2Count > 0) {
    issues.push({
      severity: 'medium',
      message: 'H2 headings found without an H1 heading',
      impact: 70,
      area: 'Content Structure',
    });
    recommendations.push({
      text: 'Add an H1 heading before using H2 headings',
      impact: 70,
      reason:
        'Proper heading hierarchy helps search engines understand your content structure',
      implementation: 'Add an H1 heading at the top of your content',
    });
  }

  // Check for social media tags
  if (!ogTitle && !twitterTitle) {
    issues.push({
      severity: 'medium',
      message: 'Missing social media title tags (Open Graph and Twitter)',
      impact: 60,
      area: 'Social Sharing',
    });
    recommendations.push({
      text: 'Add Open Graph and Twitter Card meta tags',
      impact: 60,
      reason:
        'Social media tags improve how your content appears when shared on social platforms',
      implementation: `<meta property="og:title" content="${
        title || 'Your Title'
      }">
<meta name="twitter:title" content="${title || 'Your Title'}">`,
    });
  }

  if (!ogImage && !twitterImage) {
    issues.push({
      severity: 'medium',
      message: 'Missing social media image tags',
      impact: 55,
      area: 'Social Sharing',
    });
    recommendations.push({
      text: 'Add social media image tags',
      impact: 55,
      reason:
        'Images make your content more appealing when shared on social media',
      implementation: `<meta property="og:image" content="https://yourdomain.com/path/to/image.jpg">
<meta name="twitter:image" content="https://yourdomain.com/path/to/image.jpg">`,
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

  // Check for canonical URL
  if (!canonicalUrl) {
    issues.push({
      severity: 'medium',
      message: 'No canonical URL specified',
      impact: 60,
      area: 'Duplicate Content',
    });
    recommendations.push({
      text: 'Add a canonical URL tag',
      impact: 60,
      reason: 'Canonical URLs help prevent duplicate content issues',
      implementation:
        '<link rel="canonical" href="https://yourdomain.com/current-page/">',
    });
  }

  // Check for mobile viewport
  const hasViewport = $('meta[name="viewport"]').length > 0;
  if (!hasViewport) {
    issues.push({
      severity: 'high',
      message: 'Missing viewport meta tag for mobile responsiveness',
      impact: 80,
      area: 'Mobile Optimization',
    });
    recommendations.push({
      text: 'Add a viewport meta tag',
      impact: 80,
      reason: 'Mobile-friendly pages rank better in mobile search results',
      implementation:
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
    });
  }

  // React-specific recommendations
  if (isReactApp) {
    recommendations.push({
      text: 'Use React Helmet to manage meta tags',
      impact: 85,
      reason:
        'React Helmet allows you to manage all your meta tags within your React components',
      implementation:
        'npm install react-helmet, then import and use in your components',
    });

    recommendations.push({
      text: 'Consider pre-rendering or server-side rendering',
      impact: 90,
      reason: 'Client-side rendered React apps often perform poorly for SEO',
      implementation:
        'Migrate to Next.js or use a pre-rendering service like Prerender.io',
    });

    // Add a special recommendation for React apps
    recommendations.push({
      text: 'IMPORTANT: This analysis is incomplete due to client-side rendering',
      impact: 100,
      reason:
        'This tool can only analyze the initial HTML, not the content rendered by React',
      implementation:
        'For a complete analysis, you need to analyze the rendered HTML that search engines see',
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
    robotsDirectives: {
      noindex: hasNoIndex,
      nofollow: hasNoFollow,
    },
    socialTags: {
      hasOpenGraph: !!(ogTitle || ogDescription || ogImage),
      hasTwitterCards: !!(
        twitterCard ||
        twitterTitle ||
        twitterDescription ||
        twitterImage
      ),
    },
    hasCanonical: !!canonicalUrl,
    hasViewport: hasViewport,
    schemaCount: schemas.length,
    issues: issues.sort((a, b) => b.impact - a.impact),
    recommendations,
    isReactApp,
    keywordAnalysis,
    confidenceScore, // Add confidence score to the analysis
  };
}
