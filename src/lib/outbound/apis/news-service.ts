/**
 * News API Service
 * Get recent company news and mentions
 * Uses Google News API and NewsAPI.org
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';

export interface NewsArticle {
  title: string;
  url: string;
  publishedDate: string;
  source: string;
  summary?: string;
  image?: string;
  author?: string;
}

/**
 * Get recent news about a company
 */
export async function getCompanyNews(
  companyName: string,
  organizationId: string,
  maxResults: number = 5
): Promise<NewsArticle[]> {
  try {
    const apiKey = await getNewsApiKey(organizationId);
    
    if (apiKey) {
      // Use NewsAPI.org if available
      return await getNewsFromNewsAPI(companyName, apiKey, maxResults);
    } else {
      // Fallback to Google News scraping
      return await getNewsFromGoogleNews(companyName, maxResults);
    }
  } catch (error) {
    console.error('[News] Error fetching news:', error);
    return [];
  }
}

/**
 * Get news from NewsAPI.org (requires API key)
 */
async function getNewsFromNewsAPI(
  companyName: string,
  apiKey: string,
  maxResults: number
): Promise<NewsArticle[]> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const response = await fetch(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(companyName)}&sortBy=publishedAt&pageSize=${maxResults}&from=${thirtyDaysAgo.toISOString().split('T')[0]}&language=en&apiKey=${apiKey}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`[NewsAPI] API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (!data.articles || data.articles.length === 0) {
      return [];
    }

    return data.articles.map((article: any) => ({
      title: article.title,
      url: article.url,
      publishedDate: article.publishedAt,
      source: article.source.name,
      summary: article.description,
      image: article.urlToImage,
      author: article.author,
    }));
  } catch (error) {
    console.error('[NewsAPI] Error:', error);
    return [];
  }
}

/**
 * Get news from Google News (fallback, no API key needed)
 */
async function getNewsFromGoogleNews(
  companyName: string,
  maxResults: number
): Promise<NewsArticle[]> {
  try {
    // Use Google News RSS feed
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(companyName)}&hl=en-US&gl=US&ceid=US:en`;
    
    const response = await fetch(rssUrl);
    
    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    
    // Parse RSS XML (simple parsing)
    const articles: NewsArticle[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const matches = xml.matchAll(itemRegex);
    
    for (const match of matches) {
      if (articles.length >= maxResults) break;
      
      const itemXml = match[1];
      
      const title = extractTag(itemXml, 'title');
      const link = extractTag(itemXml, 'link');
      const pubDate = extractTag(itemXml, 'pubDate');
      const source = extractTag(itemXml, 'source');
      
      if (title && link) {
        articles.push({
          title: cleanHtmlEntities(title),
          url: link,
          publishedDate: pubDate || new Date().toISOString(),
          source: source || 'Google News',
        });
      }
    }
    
    return articles;
  } catch (error) {
    console.error('[Google News] Error:', error);
    return [];
  }
}

/**
 * Extract XML tag value
 */
function extractTag(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Clean HTML entities
 */
function cleanHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .trim();
}

/**
 * Get NewsAPI.org API key
 */
async function getNewsApiKey(organizationId: string): Promise<string | null> {
  try {
    // Try environment variable first
    if (process.env.NEWS_API_KEY) {
      return process.env.NEWS_API_KEY;
    }

    // Try organization API keys
    const keys = await apiKeyService.getKeys(organizationId);
    return keys?.enrichment?.newsApiKey || null;
  } catch (error) {
    console.error('[News] Error getting API key:', error);
    return null;
  }
}

/**
 * Analyze news sentiment and themes
 */
export function analyzeNews(articles: NewsArticle[]): {
  recentMentions: number;
  topThemes: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
} {
  const recentMentions = articles.length;
  
  // Extract common themes from titles
  const themes: { [key: string]: number } = {};
  const positiveWords = ['growth', 'launch', 'expand', 'success', 'innovation', 'partnership', 'funding', 'award'];
  const negativeWords = ['lawsuit', 'decline', 'loss', 'controversy', 'layoff', 'shutdown', 'failure'];
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  articles.forEach(article => {
    const titleLower = article.title.toLowerCase();
    
    // Count sentiment words
    positiveWords.forEach(word => {
      if (titleLower.includes(word)) positiveCount++;
    });
    
    negativeWords.forEach(word => {
      if (titleLower.includes(word)) negativeCount++;
    });
    
    // Extract themes (simple keyword extraction)
    const words = titleLower.split(/\s+/);
    words.forEach(word => {
      if (word.length > 5) {
        themes[word] = (themes[word] || 0) + 1;
      }
    });
  });
  
  // Get top themes
  const topThemes = Object.entries(themes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([theme]) => theme);
  
  // Determine overall sentiment
  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (positiveCount > negativeCount + 1) {
    sentiment = 'positive';
  } else if (negativeCount > positiveCount + 1) {
    sentiment = 'negative';
  }
  
  return {
    recentMentions,
    topThemes,
    sentiment,
  };
}


