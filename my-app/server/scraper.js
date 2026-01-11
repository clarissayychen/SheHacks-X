const puppeteer = require('puppeteer');
const NodeCache = require('node-cache');
const { parseComposition, getCottonPercentage } = require('./scraper/compositionParser');
const ZaraScraper = require('./scraper/zaraScraper');

// Cache results for 1 hour
const cache = new NodeCache({ stdTTL: 3600 });

/**
 * Extract color from product name or description
 */
function extractColor(name, description) {
  const colors = ['black', 'white', 'blue', 'red', 'green', 'navy', 'grey', 'gray', 'beige', 'brown', 'pink', 'yellow'];
  const text = `${name} ${description}`.toLowerCase();
  
  for (const color of colors) {
    if (text.includes(color)) {
      return color.charAt(0).toUpperCase() + color.slice(1);
    }
  }
  return 'Various';
}

/**
 * Main search function - uses Zara scraper
 */
async function searchZara(query, limit = 10) {
  const cacheKey = `zara_search_${query.toLowerCase()}_${limit}`;
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('📦 Returning cached results');
    return cached;
  }

  try {
    console.log(`\n🚀 Starting Zara scraper for: "${query}"`);
    
    const scraper = new ZaraScraper();
    const products = await scraper.searchProducts(query, limit);
    
    // Add color extraction to products
    const productsWithColor = products.map(product => ({
      ...product,
      color: extractColor(product.name, product.materials)
    }));
    
    // Cache results
    if (productsWithColor.length > 0) {
      cache.set(cacheKey, productsWithColor);
    }
    
    console.log(`✅ Found ${productsWithColor.length} products from Zara`);
    return productsWithColor;
    
  } catch (error) {
    console.error('❌ Zara search error:', error);
    // Fallback to mock data if scraping fails
    console.log('⚠️  Falling back to mock data due to error');
    return getMockProducts(query);
  }
}

/**
 * Scrape specific category and gender (matching Python example structure)
 * @param {string} category - Category name (shirts, pants, dresses, tshirts, etc.)
 * @param {string} gender - Gender (male or female)
 * @param {number} count - Number of products to scrape
 * @returns {Array} Array of scraped products
 */
async function scrapeZaraCategory(category, gender, count = 10) {
  const scraper = new ZaraScraper();
  
  try {
    // Get product URLs from category (get more URLs in case some fail, like Python example)
    const productUrls = await scraper.getProductUrls(category, gender, count * 2);
    
    if (productUrls.length === 0) {
      console.log(`   ⚠️  No product URLs found for ${gender} ${category}`);
      return [];
    }
    
    console.log(`   📋 Found ${productUrls.length} product URLs, extracting details...`);
    
    const products = [];
    let productsFound = 0;
    
    // Scrape each product (like Python example)
    for (const url of productUrls) {
      if (productsFound >= count) {
        break;
      }
      
      try {
        const product = await scraper.extractProductInfo(url);
        
        if (product) {
          // Add color extraction
          product.color = extractColor(product.name, product.materials);
          
          // Only add products with valid data (like Python example would validate)
          if (product.name && product.name !== 'Unknown Product') {
            products.push(product);
            productsFound++;
            
            const cottonInfo = product.is_cotton_90 
              ? `${product.cottonPercentage}% cotton ✅` 
              : `${product.cottonPercentage}% cotton ⚠️`;
            
            console.log(`   ${productsFound}. ${product.name} - $${product.price} (${cottonInfo})`);
          }
        }
        
        // Add delay to be respectful (1-3 seconds, matching Python example)
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        
      } catch (error) {
        console.error(`   ❌ Error scraping ${url}:`, error.message);
        continue;
      }
    }
    
    console.log(`   ✅ Scraped ${products.length} products from ${gender} ${category}`);
    return products;
    
  } catch (error) {
    console.error(`   ❌ Error scraping category ${category}:`, error.message);
    return [];
  }
}

/**
 * Scrape products according to target counts (matching Python example structure)
 * @param {Object} targetCounts - Object with keys like 'male_shirts', 'female_shirts', etc.
 * @returns {Array} Array of all scraped products
 */
async function scrapeAllZaraProducts(targetCounts = {}) {
  // Default target counts (matching Python example)
  const defaultCounts = {
    'male_shirts': 5,
    'female_shirts': 5,
    'male_pants': 5,
    'female_pants': 5,
    'male_tshirts': 5,
    'female_tshirts': 5,
    'dresses': 10,
    'female_tops': 5,
    'female_skirts': 5,
    'male_jackets': 5,
    'female_jackets': 5
  };
  
  const counts = { ...defaultCounts, ...targetCounts };
  const allProducts = [];
  
  console.log('\n🎯 Starting Zara product scraper...');
  console.log('='.repeat(60));
  
  // Define scraping tasks (matching Python example structure)
  const scrapingTasks = [
    { category: 'shirts', gender: 'male', count: counts.male_shirts },
    { category: 'shirts', gender: 'female', count: counts.female_shirts },
    { category: 'pants', gender: 'male', count: counts.male_pants },
    { category: 'pants', gender: 'female', count: counts.female_pants },
    { category: 'tshirts', gender: 'male', count: counts.male_tshirts },
    { category: 'tshirts', gender: 'female', count: counts.female_tshirts },
    { category: 'dresses', gender: 'female', count: counts.dresses },
    { category: 'tops', gender: 'female', count: counts.female_tops },
    { category: 'skirts', gender: 'female', count: counts.female_skirts },
    { category: 'jackets', gender: 'male', count: counts.male_jackets },
    { category: 'jackets', gender: 'female', count: counts.female_jackets },
  ];
  
  // Filter out tasks with count 0 or undefined
  const activeTasks = scrapingTasks.filter(task => task.count && task.count > 0);
  
  console.log(`📋 Configured ${activeTasks.length} scraping tasks\n`);
  
  for (const task of activeTasks) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📦 Scraping ${task.count} ${task.gender} ${task.category}`);
    console.log(`${'='.repeat(60)}`);
    
    try {
      const products = await scrapeZaraCategory(task.category, task.gender, task.count);
      
      // Filter for 90%+ cotton only (like Python example would filter)
      const cottonProducts = products.filter(p => 
        p.is_cotton_90 || p.cottonPercentage >= 90
      );
      
      allProducts.push(...cottonProducts);
      
      console.log(`   ✅ Found ${cottonProducts.length} products with 90%+ cotton (target: ${task.count})`);
      
    } catch (error) {
      console.error(`   ❌ Error scraping ${task.gender} ${task.category}:`, error.message);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SCRAPING COMPLETED');
  console.log('='.repeat(60));
  console.log(`Total products with 90%+ cotton: ${allProducts.length}`);
  
  // Breakdown by category (like Python example)
  const categoryBreakdown = {};
  allProducts.forEach(p => {
    const key = `${p.gender || 'unknown'}_${p.category || 'unknown'}`;
    categoryBreakdown[key] = (categoryBreakdown[key] || 0) + 1;
  });
  
  if (Object.keys(categoryBreakdown).length > 0) {
    console.log('\nProduct summary by category:');
    Object.entries(categoryBreakdown)
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .forEach(([cat, count]) => {
        console.log(`  ${cat}: ${count} products`);
      });
  }
  
  return allProducts;
}

/**
 * Mock product data as fallback
 */
function getMockProducts(query) {
  const queryLower = query.toLowerCase();
  
  const allProducts = [
    {
      id: '1',
      name: 'Essential Cotton T-Shirt',
      brand: 'Zara',
      site: 'zara',
      price: 25.99,
      cottonPercentage: 100,
      materials: '100% Cotton',
      color: 'Black',
      image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400',
      url: 'https://www.zara.com/ca/en/product/essential-tshirt',
      category: 'tshirts',
      gender: 'male'
    },
    {
      id: '2',
      name: 'Premium Cotton Shirt',
      brand: 'Zara',
      site: 'zara',
      price: 39.99,
      cottonPercentage: 95,
      materials: '95% Cotton, 5% Elastane',
      color: 'White',
      image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400',
      url: 'https://www.zara.com/ca/en/product/premium-shirt',
      category: 'shirts',
      gender: 'female'
    },
    {
      id: '3',
      name: 'Cotton Midi Dress',
      brand: 'Zara',
      site: 'zara',
      price: 59.99,
      cottonPercentage: 92,
      materials: '92% Cotton, 8% Polyester',
      color: 'Blue',
      image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400',
      url: 'https://www.zara.com/ca/en/product/cotton-dress',
      category: 'dresses',
      gender: 'female'
    },
  ];
  
  return allProducts.filter(product => {
    const searchText = `${product.name} ${product.color} ${product.category} ${product.gender}`.toLowerCase();
    const queryWords = queryLower.split(' ');
    return queryWords.some(word => searchText.includes(word));
  });
}

/**
 * Search and save to MongoDB
 */
async function searchZaraAndSave(query) {
  try {
    const products = await searchZara(query);
    
    // Save to MongoDB if products found
    if (products.length > 0) {
      const { bulkUpsertProducts } = require('./db/repositories');
      await bulkUpsertProducts(products);
      console.log(`💾 Saved ${products.length} products to MongoDB`);
    }
    
    return products;
  } catch (error) {
    console.error('Error in searchZaraAndSave:', error);
    // Fallback to regular search without saving
    return await searchZara(query);
  }
}

/**
 * Legacy function name for compatibility
 */
async function searchAritzia(query) {
  console.log('⚠️  searchAritzia is deprecated, using searchZara instead');
  return await searchZara(query);
}

/**
 * Legacy function for compatibility
 */
async function searchAritziaAndSave(query) {
  console.log('⚠️  searchAritziaAndSave is deprecated, using searchZaraAndSave instead');
  return await searchZaraAndSave(query);
}

/**
 * Parse cotton percentage (legacy function for compatibility)
 */
function parseCottonPercentage(materialText) {
  return getCottonPercentage(materialText);
}

module.exports = {
  // New Zara functions
  searchZara,
  searchZaraAndSave,
  scrapeZaraCategory,
  scrapeAllZaraProducts,
  
  // Legacy compatibility
  searchAritzia,
  searchAritziaAndSave,
  parseCottonPercentage,
  
  // Exports
  ZaraScraper,
};
