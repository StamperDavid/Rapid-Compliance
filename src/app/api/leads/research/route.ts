/**
 * Lead Research API
 * Handles natural language queries for lead generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { enrichCompany } from '@/lib/enrichment/enrichment-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, organizationId } = body;
    
    if (!query || !organizationId) {
      return NextResponse.json(
        { success: false, error: 'Missing query or organizationId' },
        { status: 400 }
      );
    }
    
    console.log('[Lead Research] Query:', query);
    
    // Parse the natural language query
    const parsedQuery = await parseSearchQuery(query);
    
    console.log('[Lead Research] Parsed:', parsedQuery);
    
    // For now, we'll do a simple implementation
    // In the future, this can use AI to understand complex queries
    const leads: any[] = [];
    let totalCost = 0;
    
    // If they provided a company name or domain, enrich it
    if (parsedQuery.companyNames && parsedQuery.companyNames.length > 0) {
      for (const companyName of parsedQuery.companyNames.slice(0, 10)) {
        const result = await enrichCompany(
          {
            companyName,
            industry: parsedQuery.industry,
            includeNews: true,
            includeJobs: true,
            includeSocial: true,
          },
          organizationId
        );
        
        if (result.success && result.data) {
          leads.push({
            name: result.data.name,
            website: result.data.website,
            domain: result.data.domain,
            industry: result.data.industry,
            size: result.data.employeeRange || result.data.size,
            description: result.data.description,
            confidence: result.data.confidence,
          });
          
          totalCost += result.cost.totalCostUSD;
        }
      }
    } else {
      // If no specific companies mentioned, return a helpful message
      return NextResponse.json({
        success: true,
        message: `I understand you're looking for companies${parsedQuery.industry ? ` in the ${parsedQuery.industry} industry` : ''}${parsedQuery.location ? ` in ${parsedQuery.location}` : ''}.\n\nTo get started, try:\n• Providing specific company names to research\n• Uploading a list of domains\n• Or describe a company you like and I'll find similar ones`,
        leads: [],
        cost: 0,
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `Found ${leads.length} companies. Total cost: $${totalCost.toFixed(4)} (would have cost $${(leads.length * 0.75).toFixed(2)} with Clearbit)`,
      leads,
      cost: totalCost,
      savings: (leads.length * 0.75) - totalCost,
    });
  } catch (error: any) {
    console.error('[Lead Research] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Parse natural language search query
 * This is a simple version - can be enhanced with AI
 */
async function parseSearchQuery(query: string): Promise<{
  companyNames?: string[];
  industry?: string;
  location?: string;
  size?: string;
  techStack?: string[];
}> {
  const lowerQuery = query.toLowerCase();
  
  // Extract industry
  let industry: string | undefined;
  const industries = ['saas', 'software', 'ecommerce', 'e-commerce', 'fintech', 'finance', 'healthcare', 'manufacturing', 'consulting', 'marketing'];
  for (const ind of industries) {
    if (lowerQuery.includes(ind)) {
      industry = ind;
      break;
    }
  }
  
  // Extract location
  let location: string | undefined;
  const states = ['texas', 'california', 'new york', 'florida', 'illinois', 'ohio', 'georgia', 'north carolina'];
  const cities = ['austin', 'san francisco', 'new york', 'miami', 'chicago', 'atlanta', 'boston'];
  
  for (const state of states) {
    if (lowerQuery.includes(state)) {
      location = state;
      break;
    }
  }
  
  if (!location) {
    for (const city of cities) {
      if (lowerQuery.includes(city)) {
        location = city;
        break;
      }
    }
  }
  
  // Extract company names (look for "like X.com" or "similar to X")
  const likeMatch = lowerQuery.match(/like\s+([\w.-]+\.\w+)/);
  const similarMatch = lowerQuery.match(/similar to\s+([\w.-]+\.\w+)/);
  
  let companyNames: string[] | undefined;
  
  if (likeMatch) {
    companyNames = [likeMatch[1]];
  } else if (similarMatch) {
    companyNames = [similarMatch[1]];
  }
  
  // Extract tech stack
  let techStack: string[] | undefined;
  const techs = ['shopify', 'stripe', 'wordpress', 'react', 'vue', 'angular', 'salesforce', 'hubspot'];
  const foundTechs = techs.filter(tech => lowerQuery.includes(tech));
  if (foundTechs.length > 0) {
    techStack = foundTechs;
  }
  
  return {
    companyNames,
    industry,
    location,
    techStack,
  };
}
