// src/formatters/text-formatter.js
export function formatAnalysisResult(result) {
  return `SEO ANALYSIS FOR: ${result.pageIdentifier}
  
  PAGE INFO:
  - Title: ${result.title || 'Missing'} (${
    result.title ? result.title.length : 0
  } chars)
  - Meta Description: ${result.metaDescription || 'Missing'} (${
    result.metaDescription ? result.metaDescription.length : 0
  } chars)
  - Heading Structure: H1: ${result.headingStructure.h1}, H2: ${
    result.headingStructure.h2
  }, H3: ${result.headingStructure.h3}
  - Schema Count: ${result.schemaCount}
  ${
    result.isReactApp ? '- React App: Yes (client-side rendering detected)' : ''
  }
  
  POTENTIAL TARGET KEYWORDS:
  ${
    result.keywordAnalysis.phrases.length > 0
      ? `- Primary phrase: ${result.keywordAnalysis.phrases[0].phrase}
  - Other phrases: ${result.keywordAnalysis.phrases
    .slice(1)
    .map((p) => p.phrase)
    .join(', ')}`
      : '- No clear target keywords detected'
  }
  
  ISSUES (sorted by impact):
  ${result.issues
    .map(
      (issue) =>
        `- [${issue.severity.toUpperCase()}] [Impact: ${issue.impact}] ${
          issue.message
        }`
    )
    .join('\n')}
  
  RECOMMENDATIONS (sorted by impact):
  ${result.recommendations
    .map(
      (rec) => `- [Impact: ${rec.impact}] ${rec.text}
    Why: ${rec.reason}
    How: ${rec.implementation}`
    )
    .join('\n\n')}
  
  ${
    result.isReactApp
      ? '\nNOTE: This is a static HTML analysis. For JavaScript-heavy sites like React apps, the rendered content may differ from the static HTML.'
      : ''
  }`;
}

export function formatDirectoryAnalysisResults(results, directoryPath) {
  // Implementation...
}
