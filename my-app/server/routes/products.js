const express = require('express');
const router = express.Router();
const { getAritziaCollection } = require('../db/mongoClient');

/**
 * Helper function to normalize category names (same as in server.js)
 */
function normalizeCategory(categoryName) {
  if (!categoryName) return null;
  
  const lower = categoryName.toLowerCase();
  
  // Map variations to main categories
  if (lower.includes('t-shirt') || lower.includes('tshirt') || lower.includes('tee') || 
      lower.includes('blouse') || lower === 'shirt' || lower === 'shirts' || lower === 'top' || lower === 'tops') {
    return 'tops';
  }
  
  if (lower.includes('pant') || lower.includes('jean') || lower.includes('trouser')) {
    return 'pants';
  }
  
  if (lower.includes('skirt')) {
    return 'skirts';
  }
  
  if (lower.includes('dress')) {
    return 'dresses';
  }
  
  return lower;
}

/**
 * Helper function to get category variations (for querying)
 */
function getCategoryVariations(normalizedCategory) {
  const variations = {
    'tops': ['tops', 'top', 'tshirts', 'tshirt', 't-shirt', 't-shirts', 'shirt', 'shirts', 'blouse', 'blouses'],
    'pants': ['pants', 'pant', 'jeans', 'jean', 'trousers', 'trouser'],
    'skirts': ['skirts', 'skirt'],
    'dresses': ['dresses', 'dress'],
  };
  
  return variations[normalizedCategory] || [normalizedCategory];
}

/**
 * GET /api/products/search
 * Search products by query and filter by category
 * 
 * Query params:
 *   - q: search query (searches in name, category, materials)
 *   - category: filter by category (tops, pants, skirts, dresses)
 *   - minCotton: minimum cotton percentage (default: 90)
 *   - limit: max results (default: 50)
 */
router.get('/search', async (req, res) => {
  try {
    const { 
      q = '', 
      category = '', 
      minCotton = 90, 
      limit = 50 
    } = req.query;

    const collection = getAritziaCollection();
    
    // Build base query for cotton percentage
    const query = {};
    
    // Filter for cotton percentage (include 0% if curated, for extraction issues)
    const minCottonNum = parseInt(minCotton);
    if (minCottonNum >= 90) {
      query.$or = [
        { cottonPercentage: { $gte: minCottonNum } },
        // Include products with 0% cotton if they're in curated categories
        {
          $and: [
            { cottonPercentage: { $in: [0, null] } },
            { category: { $in: ['tops', 'pants', 'skirts', 'dresses'] } }
          ]
        }
      ];
    } else {
      query.cottonPercentage = { $gte: minCottonNum };
    }

    // Add category filter if specified (with normalization)
    let normalizedCategoryFilter = null;
    if (category && category !== 'all' && category !== '') {
      const normalizedCategory = normalizeCategory(category);
      if (normalizedCategory) {
        normalizedCategoryFilter = normalizedCategory;
        // Use $in to match category variations
        const categoryVariations = getCategoryVariations(normalizedCategory);
        query.category = { $in: categoryVariations };
      }
    }

    // Add search filter if query provided
    if (q && q.trim() !== '') {
      const searchTerm = q.trim().toLowerCase();
      const searchRegex = new RegExp(searchTerm, 'i');
      
      // Check if search term is a category name
      const normalizedSearchCategory = normalizeCategory(searchTerm);
      if (normalizedSearchCategory && normalizedSearchCategory !== searchTerm) {
        // Search term is a category - include category in search
        const categoryVariations = getCategoryVariations(normalizedSearchCategory);
        
        // Combine category filter with search
        if (normalizedCategoryFilter) {
          // Both category filter and search - if they match, just search name/desc
          if (normalizedSearchCategory === normalizedCategoryFilter) {
            query.$and = query.$and || [];
            query.$and.push({
              $or: [
                { name: searchRegex },
                { composition_raw: searchRegex },
                { color: searchRegex }
              ]
            });
          } else {
            // Different categories - search includes category
            query.$and = query.$and || [];
            query.$and.push({
              $or: [
                { name: searchRegex },
                { composition_raw: searchRegex },
                { color: searchRegex },
                { category: { $in: categoryVariations } }
              ]
            });
          }
        } else {
          // No category filter, but search is for a category
          query.$and = query.$and || [];
          query.$and.push({
            $or: [
              { name: searchRegex },
              { composition_raw: searchRegex },
              { color: searchRegex },
              { category: { $in: categoryVariations } }
            ]
          });
        }
      } else {
        // Regular text search
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { name: searchRegex },
            { composition_raw: searchRegex },
            { color: searchRegex }
          ]
        });
      }
    }

    console.log('Search query:', JSON.stringify(query, null, 2));

    // Execute query
    let products = await collection
      .find(query)
      .sort({ price: 1 })
      .limit(parseInt(limit))
      .toArray();

    // Normalize categories in results
    products = products.map(product => {
      if (product.category) {
        const normalized = normalizeCategory(product.category);
        if (normalized) {
          product.category = normalized;
        }
      }
      return product;
    });

    // Filter again by normalized category if category filter was provided
    if (normalizedCategoryFilter) {
      products = products.filter(p => 
        p.category && normalizeCategory(p.category) === normalizedCategoryFilter
      );
    }

    console.log(`Found ${products.length} products`);

    // Return results with proper image handling
    res.json({
      success: true,
      count: products.length,
      products: products.map(p => ({
        id: p._id?.toString() || p.id || p.url,
        name: p.name,
        brand: p.brand || 'Zara',
        site: p.site || 'zara',
        price: p.price || 0,
        currency: p.currency || 'CAD',
        cottonPercentage: p.cottonPercentage || 0,
        materials: p.composition_raw || p.materials || '',
        color: p.color || 'Various',
        // Image handling: try image field first, then images array, then fallback
        image: p.image || (Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : '') || '',
        images: Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []),
        url: p.url,
        category: p.category,
        gender: p.gender || 'female',
        sizes_available: p.sizes_available || []
      }))
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/products/categories
 * Get all unique categories
 */
router.get('/categories', async (req, res) => {
  try {
    const collection = getAritziaCollection();
    const categories = await collection.distinct('category');
    
    res.json({
      success: true,
      categories: categories.filter(c => c) // Remove null/undefined
    });

  } catch (error) {
    console.error('Categories error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/products/:id
 * Get single product by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const collection = getAritziaCollection();
    const product = await collection.findOne({ 
      $or: [
        { _id: req.params.id },
        { id: req.params.id },
        { url: req.params.id }
      ]
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      product: {
        id: product._id?.toString() || product.id || product.url,
        name: product.name,
        brand: product.brand || 'Zara',
        site: product.site || 'zara',
        price: product.price || 0,
        currency: product.currency || 'CAD',
        cottonPercentage: product.cottonPercentage || 0,
        materials: product.composition_raw || product.materials || '',
        color: product.color || 'Various',
        image: product.image || (Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : '') || '',
        images: Array.isArray(product.images) ? product.images : (product.image ? [product.image] : []),
        url: product.url,
        category: product.category,
        gender: product.gender || 'female',
        sizes_available: product.sizes_available || []
      }
    });

  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
