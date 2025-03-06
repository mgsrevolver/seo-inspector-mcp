// seo-requirements.js - Prioritized list of SEO components to check
const SEO_REQUIREMENTS = {
  critical: [
    {
      id: 'title',
      name: 'Page Title',
      description:
        'Each page should have a unique, descriptive title between 30-60 characters',
      impact: 'Critical for search engine rankings and click-through rates',
    },
    {
      id: 'meta-description',
      name: 'Meta Description',
      description:
        'Compelling summary of page content between 50-160 characters',
      impact: 'Affects click-through rates from search results',
    },
    {
      id: 'h1',
      name: 'H1 Heading',
      description:
        'Each page should have exactly one H1 heading that describes the content',
      impact: 'Important for search engines to understand page content',
    },
    {
      id: 'canonical',
      name: 'Canonical URL',
      description: 'Specify the preferred URL for duplicate or similar content',
      impact:
        'Prevents duplicate content issues and consolidates ranking signals',
    },
  ],
  important: [
    {
      id: 'heading-structure',
      name: 'Heading Structure',
      description: 'Proper use of H2-H6 headings to create content hierarchy',
      impact:
        'Helps search engines understand content structure and importance',
    },
    {
      id: 'img-alt',
      name: 'Image Alt Text',
      description: 'Descriptive alternative text for all non-decorative images',
      impact: 'Improves accessibility and helps images rank in image search',
    },
    {
      id: 'schema',
      name: 'Structured Data',
      description: 'JSON-LD schema markup for relevant entity types',
      impact: 'Enables rich snippets and enhanced search features',
    },
    {
      id: 'meta-robots',
      name: 'Robots Directives',
      description:
        'Appropriate use of index/noindex and follow/nofollow directives',
      impact: 'Controls how search engines crawl and index pages',
    },
  ],
  recommended: [
    {
      id: 'open-graph',
      name: 'Open Graph Tags',
      description: 'OG tags for title, description, image, and type',
      impact: 'Controls how content appears when shared on social media',
    },
    {
      id: 'twitter-cards',
      name: 'Twitter Cards',
      description: 'Twitter-specific metadata for shared content',
      impact: 'Enhances appearance of links shared on Twitter',
    },
    {
      id: 'internal-links',
      name: 'Internal Linking',
      description: 'Descriptive anchor text for internal links',
      impact:
        'Distributes page authority and helps search engines understand content relationships',
    },
    {
      id: 'url-structure',
      name: 'URL Structure',
      description: 'Clean, descriptive URLs with keywords when relevant',
      impact: 'Affects user experience and keyword relevance',
    },
    {
      id: 'mobile-friendly',
      name: 'Mobile Friendliness',
      description: 'Responsive design and appropriate viewport settings',
      impact: 'Critical for mobile search rankings',
    },
  ],
};

module.exports = SEO_REQUIREMENTS;
