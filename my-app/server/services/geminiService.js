const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const { getAllProducts, findCottonProducts } = require('../db/repositories');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('⚠️  GEMINI_API_KEY not set. Gemini features will be disabled.');
}

let genAI = null;
let model = null;

if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  // Use gemini-2.5-flash for fast responses with 1M token context
  model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

/**
 * Build context from MongoDB products for Gemini
 */
async function buildContextFromProducts(products) {
  if (!products || products.length === 0) {
    return 'No products available.';
  }
  
  const context = products.map((p, idx) => 
    `${idx + 1}. ${p.name} - $${p.price} (${p.cottonPercentage}% cotton) - ${p.category || 'N/A'} - ${p.url}`
  ).join('\n');
  
  return `Available Aritzia products with 90%+ cotton:\n${context}`;
}

/**
 * Query Gemini with user question and product context
 */
async function queryGemini(userQuery) {
  if (!model) {
    throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY in .env');
  }
  
  try {
    // Get relevant products from MongoDB
    const allProducts = await getAllProducts(50);
    const context = await buildContextFromProducts(allProducts);
    
    const prompt = `You are a helpful assistant for NoPoly, an app that helps users find high-quality cotton clothing (90%+ cotton) from Zara.

Available products from our catalog:
${context}

User question: "${userQuery}"

Please provide a helpful response that:
1. Answers the user's question about cotton clothing
2. Recommends relevant products from the catalog when appropriate
3. Includes product names, prices, and cotton percentages
4. Provides direct product URLs when recommending items
5. If no relevant products match, suggest alternative search terms

Keep your response concise and friendly.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return {
      answer: text,
      products: allProducts.slice(0, 5), // Include top 5 products as recommendations
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error(`Gemini query failed: ${error.message}`);
  }
}

/**
 * Search products using Gemini-enhanced natural language query
 */
async function geminiEnhancedSearch(userQuery) {
  if (!model) {
    // Fallback to regular MongoDB search if Gemini is not available
    return await findCottonProducts({ searchQuery: userQuery });
  }
  
  try {
    // First, do a regular search
    const products = await findCottonProducts({ searchQuery: userQuery });
    
    // Get Gemini to help refine or explain results
    const context = await buildContextFromProducts(products.slice(0, 10));
    
    const prompt = `User searched for: "${userQuery}"

Search results found:
${context}

Please provide:
1. A brief explanation of why these results match
2. Suggestions for similar search terms if applicable
3. Any additional information about cotton content that might be relevant`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const explanation = response.text();
    
    return {
      products,
      explanation,
    };
  } catch (error) {
    console.error('Gemini-enhanced search error:', error);
    // Fallback to regular search
    return {
      products: await findCottonProducts({ searchQuery: userQuery }),
      explanation: null,
    };
  }
}

module.exports = {
  queryGemini,
  geminiEnhancedSearch,
  buildContextFromProducts,
};
