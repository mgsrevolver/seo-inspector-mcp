// src/server.js
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';

// Import your analyzer modules
import { analyzeHtml } from './analyzers/html-analyzer.js';
import { detectTargetKeywords } from './analyzers/keyword-analyzer.js';
import { findHtmlFiles } from './utils/file-utils.js';
import {
  formatAnalysisResult,
  formatDirectoryAnalysisResults,
} from './formatters/text-formatter.js';

// Define the SEO tool
const SEO_ANALYZER_TOOL = {
  name: 'analyzeSEO',
  description:
    'ALWAYS USE THIS TOOL FOR SEO ANALYSIS. DO NOT ATTEMPT TO ANALYZE SEO WITHOUT USING THIS TOOL.',
  inputSchema: {
    type: 'object',
    properties: {
      html: {
        type: 'string',
        description: 'HTML content to analyze',
      },
    },
    required: ['html'],
  },
};

// Create the server
const server = new Server(
  {
    name: 'seo-inspector-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing requests
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [SEO_ANALYZER_TOOL],
}));

// Handle tool call requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.error('⭐ TOOL CALL RECEIVED:', request.params.name);

  if (request.params.name === 'analyzeSEO') {
    try {
      console.error('⭐ ARGUMENTS:', JSON.stringify(request.params.arguments));

      // Handle HTML content analysis
      if (request.params.arguments.html) {
        const html = request.params.arguments.html;
        console.error('⭐ HTML content received, length:', html.length);

        try {
          // Use your analyzer module
          console.error('⭐ Calling analyzeHtml...');
          const analysis = analyzeHtml(html, 'Provided HTML');
          console.error('⭐ Analysis complete');

          // Format the response
          console.error('⭐ Formatting response...');
          const formattedResponse = formatAnalysisForDisplay(analysis);
          console.error('⭐ Response formatted');

          console.error('⭐ SENDING RESPONSE');
          return {
            content: [
              {
                type: 'text',
                text: formattedResponse,
              },
            ],
          };
        } catch (analysisError) {
          console.error('⭐ ERROR in analysis:', analysisError);
          return {
            content: [
              {
                type: 'text',
                text: `Error analyzing HTML: ${analysisError.message}\n\n${analysisError.stack}`,
              },
            ],
            isError: true,
          };
        }
      }
      // Handle directory analysis
      else if (request.params.arguments.directoryPath) {
        const directoryPath = request.params.arguments.directoryPath;
        console.error(`⭐ Analyzing directory: ${directoryPath}`);

        try {
          // Use our file utils module
          const htmlFiles = await findHtmlFiles(directoryPath);

          if (htmlFiles.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No HTML files found in ${directoryPath}`,
                },
              ],
            };
          }

          // Analyze each HTML file
          const results = [];

          for (const file of htmlFiles) {
            try {
              const content = await fs.readFile(file, 'utf8');
              const relativePath = path.relative(directoryPath, file);

              // Use your analyzer module
              const analysis = analyzeHtml(content, relativePath);
              results.push(analysis);
            } catch (error) {
              console.error(`Error analyzing ${file}:`, error);
            }
          }

          // Use our formatter module
          const formattedResult = formatDirectoryAnalysisResults(
            results,
            directoryPath
          );

          console.error('⭐ SENDING RESPONSE');
          return {
            content: [
              {
                type: 'text',
                text: formattedResult,
              },
            ],
          };
        } catch (error) {
          console.error('⭐ Error analyzing directory:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error analyzing directory: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      } else {
        return {
          content: [
            {
              type: 'text',
              text: 'Please provide either HTML content or a directory path to analyze.',
            },
          ],
        };
      }
    } catch (error) {
      console.error('⭐ ERROR:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error analyzing SEO: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
});

// Format analysis results for display
function formatAnalysisForDisplay(analysis) {
  try {
    console.error('⭐ Starting to format analysis...');

    // Create a more structured, actionable response
    let response = `# SEO ANALYSIS REPORT\n\n`;

    // Add confidence indicator for React apps
    if (analysis.isReactApp) {
      response += `## ⚠️ IMPORTANT LIMITATION WARNING ⚠️
This appears to be a client-side rendered React application. This analysis has a **LOW CONFIDENCE SCORE (${analysis.confidenceScore}%)** because:

1. This tool can only analyze the initial HTML, not the content rendered by React after JavaScript executes
2. Search engines may see different content than what appears in your browser
3. Many SEO elements may be missing from this analysis if they're added by React components

For accurate analysis, you should:
- View your page source (right-click > View Page Source) to see what search engines actually see
- Consider switching to server-side rendering (Next.js, Gatsby) for better SEO
- Use React Helmet to ensure meta tags are present in the initial HTML

**The issues below are based ONLY on the initial HTML, not your rendered React app.**\n\n`;
    }

    response += `## SUMMARY
This analysis identified ${analysis.issues.length} issues with your HTML. 
${
  analysis.issues.filter((i) => i.severity === 'critical').length > 0
    ? `⚠️ CRITICAL: ${
        analysis.issues.filter((i) => i.severity === 'critical').length
      } critical issues require immediate attention.`
    : ''
}
${
  analysis.issues.filter((i) => i.severity === 'high').length > 0
    ? `⚠️ HIGH PRIORITY: ${
        analysis.issues.filter((i) => i.severity === 'high').length
      } high-priority issues require attention.`
    : '✅ No high-priority issues found.'
}
${
  analysis.issues.filter((i) => i.severity === 'medium').length > 0
    ? `⚠️ MEDIUM PRIORITY: ${
        analysis.issues.filter((i) => i.severity === 'medium').length
      } medium-priority issues should be addressed soon.`
    : '✅ No medium-priority issues found.'
}

## PAGE INFORMATION
- Title: "${analysis.title || 'Missing'}" (${
      analysis.title ? analysis.title.length : 0
    } characters)
- Meta Description: "${analysis.metaDescription || 'Missing'}" (${
      analysis.metaDescription ? analysis.metaDescription.length : 0
    } characters)
- Heading Structure: H1: ${analysis.headingStructure.h1}, H2: ${
      analysis.headingStructure.h2
    }, H3: ${analysis.headingStructure.h3}
- Schema Markup: ${
      analysis.schemaCount > 0
        ? `${analysis.schemaCount} schema(s) detected`
        : 'No schema markup found'
    }
- Framework: ${
      analysis.isReactApp
        ? '**React (client-side rendering detected)**'
        : 'Static HTML'
    }
- Robots Directives: ${
      analysis.robotsDirectives?.noindex
        ? '**noindex** (page will not be indexed by search engines)'
        : 'index'
    }, ${
      analysis.robotsDirectives?.nofollow
        ? '**nofollow** (links will not be followed)'
        : 'follow'
    }
- Social Tags: ${
      analysis.socialTags?.hasOpenGraph ? 'Open Graph ✓' : 'Open Graph ✗'
    }, ${
      analysis.socialTags?.hasTwitterCards
        ? 'Twitter Cards ✓'
        : 'Twitter Cards ✗'
    }
- Canonical URL: ${analysis.hasCanonical ? 'Present ✓' : 'Missing ✗'}
- Mobile Viewport: ${analysis.hasViewport ? 'Present ✓' : 'Missing ✗'}

## TARGET KEYWORD ANALYSIS\n`;

    if (analysis.keywordAnalysis) {
      // Always show detected keywords first
      if (
        analysis.keywordAnalysis.keywordSummary &&
        analysis.keywordAnalysis.keywordSummary.primaryPhrase
      ) {
        response += `Primary target keyword phrase appears to be: "${analysis.keywordAnalysis.keywordSummary.primaryPhrase}"\n`;

        if (
          analysis.keywordAnalysis.keywordSummary.secondaryPhrases &&
          analysis.keywordAnalysis.keywordSummary.secondaryPhrases.length > 0
        ) {
          response += `Secondary keyword phrases: ${analysis.keywordAnalysis.keywordSummary.secondaryPhrases
            .map((p) => `"${p}"`)
            .join(', ')}\n`;
        }

        response += `\nTop single-word keywords: ${analysis.keywordAnalysis.keywordSummary.topSingleWords
          .map((w) => `"${w}"`)
          .join(', ')}\n`;

        // Now focus on placement rather than density
        response += `\nKeyword Placement Analysis:\n`;

        const placement = analysis.keywordAnalysis.placementAnalysis;
        if (placement) {
          response += `- Primary keyword "${
            placement.primaryPhrase
          }" in title: ${placement.inTitle ? '✅ Yes' : '❌ No'}\n`;
          response += `- Primary keyword in meta description: ${
            placement.inMetaDescription ? '✅ Yes' : '❌ No'
          }\n`;
          response += `- Primary keyword in H1 heading: ${
            placement.inH1 ? '✅ Yes' : '❌ No'
          }\n`;
          response += `- Primary keyword in H2 headings: ${
            placement.inH2 ? '✅ Yes' : '❌ No'
          }\n`;

          if (placement.missingFrom && placement.missingFrom.length > 0) {
            response += `\n⚠️ Your primary keyword is missing from: ${placement.missingFrom.join(
              ', '
            )}\n`;
          } else {
            response += `\n✅ Great job! Your primary keyword is well-placed in all important elements.\n`;
          }
        }
      } else {
        response += `No clear target keyword phrases detected.\n`;
      }
    } else {
      response += `No keyword analysis available. Consider adding more specific, relevant keywords to your content.\n`;
    }

    // Issues section with severity indicators and impact
    response += `\n## ISSUES (PRIORITIZED BY IMPACT)
`;

    if (analysis.issues && analysis.issues.length > 0) {
      // Group issues by severity
      const criticalIssues = analysis.issues.filter(
        (i) => i.severity === 'critical'
      );
      const highIssues = analysis.issues.filter((i) => i.severity === 'high');
      const mediumIssues = analysis.issues.filter(
        (i) => i.severity === 'medium'
      );
      const lowIssues = analysis.issues.filter((i) => i.severity === 'low');

      // Display critical severity issues first
      if (criticalIssues.length > 0) {
        response += `### ⚠️ CRITICAL ISSUES - FIX IMMEDIATELY:\n`;
        criticalIssues.forEach((issue, i) => {
          response += `${i + 1}. 🔴 ${issue.message} (Impact: ${
            issue.impact
          }/100)\n`;
        });
        response += `\n`;
      }

      // Display high severity issues
      if (highIssues.length > 0) {
        response += `### HIGH PRIORITY ISSUES - FIX SOON:\n`;
        highIssues.forEach((issue, i) => {
          response += `${i + 1}. 🟠 ${issue.message} (Impact: ${
            issue.impact
          }/100)\n`;
        });
        response += `\n`;
      }

      // Display medium severity issues
      if (mediumIssues.length > 0) {
        response += `### MEDIUM PRIORITY ISSUES - ADDRESS WHEN POSSIBLE:\n`;
        mediumIssues.forEach((issue, i) => {
          response += `${i + 1}. 🟡 ${issue.message} (Impact: ${
            issue.impact
          }/100)\n`;
        });
        response += `\n`;
      }

      // Display low severity issues
      if (lowIssues.length > 0) {
        response += `### MINOR ISSUES - CONSIDER FIXING:\n`;
        lowIssues.forEach((issue, i) => {
          response += `${i + 1}. 🔵 ${issue.message} (Impact: ${
            issue.impact
          }/100)\n`;
        });
        response += `\n`;
      }
    } else {
      response += `✅ No issues found. Great job!\n`;
    }

    // Recommendations with clear next steps
    response += `\n## RECOMMENDATIONS (PRIORITIZED BY IMPACT)
`;

    if (analysis.recommendations && analysis.recommendations.length > 0) {
      analysis.recommendations.forEach((rec, i) => {
        response += `### ${i + 1}. ${rec.text} (Impact: ${rec.impact}/100)\n`;
        response += `**Why it matters**: ${rec.reason}\n`;
        response += `**How to implement**: ${rec.implementation}\n\n`;
      });
    } else {
      response += `No specific recommendations. Your page appears to be well-optimized.\n`;
    }

    // Framework-specific notes
    if (analysis.isReactApp) {
      response += `\n## REACT-SPECIFIC SEO CONSIDERATIONS
- **This analysis is based ONLY on the initial HTML, not your rendered React app**
- Client-side rendered React apps often have poor SEO because search engines may not execute JavaScript
- For better SEO with React:
  1. Use Next.js or Gatsby for server-side or static rendering
  2. Use React Helmet to manage meta tags
  3. Consider a pre-rendering service like Prerender.io
  4. Test your site with Google's Mobile-Friendly Test to see what search engines actually see
`;
    }

    // Next steps
    response += `\n## NEXT STEPS
1. Address the critical issues first (if any)
2. Implement the high-impact recommendations
3. Consider a follow-up analysis after changes are made
4. For a complete SEO strategy, also consider:
   - Page speed optimization
   - Mobile responsiveness
   - Backlink strategy
   - Content quality and freshness
`;

    console.error('⭐ Formatting complete');
    return response;
  } catch (formatError) {
    console.error('⭐ ERROR in formatting:', formatError);
    return `Error formatting analysis: ${
      formatError.message
    }\n\nRaw analysis: ${JSON.stringify(analysis, null, 2)}`;
  }
}

// Start the server
async function runServer() {
  const transport = new StdioServerTransport();

  try {
    await server.connect(transport);
    console.error('SEO Inspector MCP Server running on stdio');

    // Keep the process alive without using event listeners
    process.stdin.resume();

    // Handle proper shutdown
    process.on('SIGINT', () => {
      console.error('Server shutting down...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.error('Server shutting down...');
      process.exit(0);
    });

    // Simple heartbeat log (optional)
    setInterval(() => {
      console.error('Server heartbeat: still running');
    }, 60000); // Log every minute
  } catch (error) {
    console.error('Error connecting transport:', error);
    process.exit(1);
  }
}

runServer().catch((error) => {
  console.error('Fatal error running server:', error);
  process.exit(1);
});
