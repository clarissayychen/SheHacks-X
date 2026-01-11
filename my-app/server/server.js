const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { searchZara, searchZaraAndSave, searchAritziaAndSave } = require('./scraper');
const { connect, disconnect, getAritziaCollection } = require('./db/mongoClient');
const { findCottonProducts, searchProducts, getAllProducts, bulkUpsertProducts } = require('./db/repositories');
const { queryGemini, geminiEnhancedSearch } = require('./services/geminiService');
const productsRouter = require('./routes/products');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Mount products router
app.use('/api/products', productsRouter);

// Connect to MongoDB on startup
async function startServer() {
  try {
    await connect();
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    console.log('Server will continue without MongoDB connection');
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await disconnect();
  process.exit(0);
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'NoPoly API is running',
    endpoints: {
      search: '/api/search',
      gemini: '/api/gemini',
      products: '/api/products',
      scrape: '/api/scrape',
    }
  });
});

// Search endpoint (searches MongoDB first, falls back to scraping)
app.get('/api/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    console.log(`Searching for: ${query}`);
    
    // First try MongoDB
    let results = await findCottonProducts({ searchQuery: query });
    
    // If no results in MongoDB, scrape and save
    if (results.length === 0) {
      console.log('No results in MongoDB, scraping Zara...');
      const scraped = await searchZaraAndSave(query);
      results = scraped;
    }
    
    res.json({
      success: true,
      count: results.length,
      results: results
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to search products',
      message: error.message 
    });
  }
});

// Gemini query endpoint (user -> Gemini -> MongoDB -> Gemini -> user)
app.post('/api/gemini', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`Gemini query: ${query}`);
    
    // Query Gemini with MongoDB context
    const response = await queryGemini(query);
    
    res.json({
      success: true,
      answer: response.answer,
      products: response.products || [],
    });
  } catch (error) {
    console.error('Gemini query error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to query Gemini',
      message: error.message 
    });
  }
});

// Gemini-enhanced search endpoint
app.get('/api/gemini/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    console.log(`Gemini-enhanced search: ${query}`);
    
    const response = await geminiEnhancedSearch(query);
    
    res.json({
      success: true,
      products: response.products || [],
      explanation: response.explanation || null,
      count: response.products?.length || 0,
    });
  } catch (error) {
    console.error('Gemini-enhanced search error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to perform Gemini-enhanced search',
      message: error.message 
    });
  }
});

// Get products from MongoDB
app.get('/api/products', async (req, res) => {
  try {
    const { category, maxPrice, limit = 50 } = req.query;
    
    const filters = {};
    if (category) filters.category = category;
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice);
    
    const products = await findCottonProducts(filters);
    
    res.json({
      success: true,
      count: products.length,
      results: products.slice(0, parseInt(limit)),
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get products',
      message: error.message 
    });
  }
});

// Scrape endpoint (force scrape and save to MongoDB)
app.post('/api/scrape', async (req, res) => {
  try {
    const { query, category, gender, limit = 10 } = req.body;
    
    if (!query && !category) {
      return res.status(400).json({ error: 'Query or category is required' });
    }

    console.log(`Scraping Zara: ${query || `${category} (${gender})`}`);
    
    let products = [];
    
    // If category and gender specified, scrape specific category
    if (category && gender) {
      const { scrapeZaraCategory } = require('./scraper');
      products = await scrapeZaraCategory(category, gender, limit);
    } else if (query) {
      // Otherwise use general search
      products = await searchZaraAndSave(query, limit);
    }
    
    res.json({
      success: true,
      count: products.length,
      results: products,
      message: 'Products scraped and saved to MongoDB',
    });
  } catch (error) {
    console.error('Scrape error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to scrape products',
      message: error.message 
    });
  }
});

// Scrape all categories endpoint (matching Python example)
app.post('/api/scrape-all', async (req, res) => {
  try {
    // Get target counts from request body, or use config file, or use defaults
    let targetCounts = req.body.targetCounts || req.body;
    
    // Try to load from config file if no counts provided
    if (!targetCounts || Object.keys(targetCounts).length === 0) {
      try {
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(__dirname, '../config/scraping-config.json');
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          targetCounts = config.target_counts;
          console.log('📋 Loaded target counts from config file');
        }
      } catch (configError) {
        console.log('⚠️  Could not load config file, using defaults');
      }
    }
    
    console.log('🎯 Starting comprehensive Zara scraping with target counts:', targetCounts);
    
    const { scrapeAllZaraProducts } = require('./scraper');
    const products = await scrapeAllZaraProducts(targetCounts);
    
    // Save all to MongoDB
    if (products.length > 0) {
      const { bulkUpsertProducts } = require('./db/repositories');
      await bulkUpsertProducts(products);
      console.log(`💾 Saved ${products.length} products to MongoDB`);
    }
    
    res.json({
      success: true,
      count: products.length,
      results: products,
      targetCounts: targetCounts,
      message: `Scraped ${products.length} products from all Zara categories and saved to MongoDB`,
    });
  } catch (error) {
    console.error('Scrape all error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to scrape all categories',
      message: error.message 
    });
  }
});

// Get scraping configuration endpoint
app.get('/api/scrape-config', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, '../config/scraping-config.json');
    
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      res.json({
        success: true,
        config: config
      });
    } else {
      res.json({
        success: true,
        config: {
          target_counts: {
            'male_shirts': 5,
            'female_shirts': 5,
            'male_pants': 5,
            'female_pants': 5,
            'male_tshirts': 5,
            'female_tshirts': 5,
            'dresses': 10
          }
        },
        message: 'Using default config (config file not found)'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load config',
      message: error.message
    });
  }
});

// Helper function to get category variations (for querying)
function getCategoryVariations(normalizedCategory) {
  const variations = {
    'tops': ['tops', 'top', 'tshirts', 'tshirt', 't-shirt', 't-shirts', 'shirt', 'shirts', 'blouse', 'blouses'],
    'pants': ['pants', 'pant', 'jeans', 'jean', 'trousers', 'trouser'],
    'skirts': ['skirts', 'skirt'],
    'dresses': ['dresses', 'dress'],
  };
  
  return variations[normalizedCategory] || [normalizedCategory];
}

// Helper function to normalize category names
function normalizeCategory(categoryName) {
  if (!categoryName) return null;
  
  const lower = categoryName.toLowerCase();
  
  // Map variations to main categories
  // Tops: t-shirt, tshirt, tee, blouse, shirt, top, blouse
  if (lower.includes('t-shirt') || lower.includes('tshirt') || lower.includes('tee') || 
      lower.includes('blouse') || lower === 'shirt' || lower === 'shirts' || lower === 'top' || lower === 'tops') {
    return 'tops';
  }
  
  // Pants: pant, pants, jeans, jean, trouser, trousers
  if (lower.includes('pant') || lower.includes('jean') || lower.includes('trouser')) {
    return 'pants';
  }
  
  // Skirts: skirt, skirts
  if (lower.includes('skirt')) {
    return 'skirts';
  }
  
  // Dresses: dress, dresses
  if (lower.includes('dress')) {
    return 'dresses';
  }
  
  return lower; // Return as-is if no match
}

// Get curated products endpoint (from specific URLs, filtered for 90%+ cotton)
app.get('/api/curated', async (req, res) => {
  try {
    const { category, cottonOnly = 'false', search } = req.query;
    const collection = getAritziaCollection();
    
    // Build query - look for curated products (or all products if none marked as curated)
    const query = {};
    
    // Filter for cotton percentage (default: 90%+, allow 100% only option)
    // Note: cottonPercentage = 0 means couldn't extract, but might still be cotton
    if (cottonOnly === 'true') {
      // If explicitly requesting 100% only
      query.cottonPercentage = { $gte: 100, $lt: 101 };
    } else {
      // Default: 90%+ cotton OR 0% (couldn't extract - include curated items)
      // Use $or only if we need multiple conditions, otherwise simplify
      query.$or = [
        { cottonPercentage: { $gte: 90 } },
        // Include products with 0% cotton if they're in curated categories (might have extraction issues)
        {
          $and: [
            { cottonPercentage: { $in: [0, null] } },
            { $or: [
              { isCurated: true },
              { category: { $in: ['tops', 'pants', 'skirts', 'dresses'] } }
            ]}
          ]
        }
      ];
    }
    
    // Filter by category if provided (with normalization)
    let normalizedCategoryFilter = null;
    if (category && category !== 'all') {
      const normalizedCategory = normalizeCategory(category);
      if (normalizedCategory) {
        normalizedCategoryFilter = normalizedCategory;
        // Use $in to match both normalized category and variations
        const categoryVariations = getCategoryVariations(normalizedCategory);
        query.category = { $in: categoryVariations };
      }
    }
    
    // Text search if provided
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      
      // Check if search term is a category name
      const normalizedSearchCategory = normalizeCategory(searchTerm);
      if (normalizedSearchCategory) {
        // If searching for a category name, include category in search
        const categoryVariations = getCategoryVariations(normalizedSearchCategory);
        
        // If category filter is also set, combine them
        if (normalizedCategoryFilter) {
          // Both category filter and search category - they should match
          if (normalizedSearchCategory === normalizedCategoryFilter) {
            query.$or = [
              { name: new RegExp(searchTerm, 'i') },
              { composition_raw: new RegExp(searchTerm, 'i') },
            ];
          } else {
            // Different categories - search takes precedence for category matching
            query.$or = [
              { name: new RegExp(searchTerm, 'i') },
              { composition_raw: new RegExp(searchTerm, 'i') },
              { category: { $in: categoryVariations } },
            ];
          }
        } else {
          // No category filter, but search is for a category
          query.$or = [
            { name: new RegExp(searchTerm, 'i') },
            { composition_raw: new RegExp(searchTerm, 'i') },
            { category: { $in: categoryVariations } },
          ];
        }
      } else {
        // Regular text search - category filter (if any) still applies
        query.$or = [
          { name: new RegExp(searchTerm, 'i') },
          { composition_raw: new RegExp(searchTerm, 'i') },
        ];
      }
    }
    
    // Normalize categories for existing products in database
    const products = await collection.find(query).sort({ price: 1 }).toArray();
    
    // Apply category normalization to results (including products that matched by variation)
    const normalizedProducts = products.map(product => {
      if (product.category) {
        const normalized = normalizeCategory(product.category);
        if (normalized) {
          return { ...product, category: normalized };
        }
      }
      return product;
    });
    
    // Filter again if category was specified (in case normalization changed categories)
    let finalProducts = normalizedProducts;
    if (category && category !== 'all') {
      const normalizedCategory = normalizeCategory(category);
      if (normalizedCategory) {
        finalProducts = normalizedProducts.filter(p => 
          p.category && normalizeCategory(p.category) === normalizedCategory
        );
      }
    }
    
    res.json({
      success: true,
      count: finalProducts.length,
      results: finalProducts,
    });
  } catch (error) {
    console.error('Curated products error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get curated products',
      message: error.message 
    });
  }
});

// Scrape curated URLs endpoint
app.post('/api/curated/scrape', async (req, res) => {
  try {
    console.log('Scraping curated URLs...');
    const { scrapeCuratedUrls } = require('./scrape-curated-urls');
    const products = await scrapeCuratedUrls();
    
    // Save to MongoDB
    if (products.length > 0) {
      await bulkUpsertProducts(products);
      console.log(`💾 Saved ${products.length} products to MongoDB`);
    }
    
    // Filter for 100% cotton
    const cotton100Products = products.filter(p => p.cottonPercentage === 100);
    
    res.json({
      success: true,
      count: products.length,
      cotton100Count: cotton100Products.length,
      results: products,
      message: `Scraped ${products.length} products (${cotton100Products.length} are 100% cotton)`,
    });
  } catch (error) {
    console.error('Scrape curated URLs error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to scrape curated URLs',
      message: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`MongoDB URI: ${process.env.MONGO_URI || 'mongodb://localhost:27017'}`);
  console.log(`Gemini API: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '⚠️  Not configured'}`);
});