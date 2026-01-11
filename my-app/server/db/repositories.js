const { getAritziaCollection, getDb } = require('./mongoClient');

/**
 * Convert product object to MongoDB document
 */
function productToDict(product) {
  return {
    site: product.site || 'zara',
    url: product.url,
    name: product.name,
    price: product.price || null,
    currency: product.currency || 'CAD',
    category: product.category || null,
    gender: product.gender || null,
    composition_raw: product.materials || '',
    composition_parsed: product.composition_parsed || {},
    cottonPercentage: product.cottonPercentage || 0,
    is_cotton_90: product.is_cotton_90 !== undefined ? product.is_cotton_90 : (product.cottonPercentage >= 90),
    images: product.images && Array.isArray(product.images) ? product.images : (product.image ? [product.image] : []),
    image: product.image || (product.images && product.images[0]) || '',
    color: product.color || 'Various',
    brand: product.brand || 'Zara',
    sizes_available: product.sizes_available || [],
    // createdAt is handled in upsertProduct with $setOnInsert
    updatedAt: new Date(),
  };
}

/**
 * Upsert a single product (insert or update if URL exists)
 */
async function upsertProduct(product) {
  const collection = getAritziaCollection();
  const doc = productToDict(product);
  
  // Remove createdAt from doc since we use $setOnInsert for it
  const { createdAt, ...docWithoutCreatedAt } = doc;
  
  await collection.updateOne(
    { url: product.url },
    { 
      $set: { ...docWithoutCreatedAt, updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );
}

/**
 * Bulk upsert multiple products
 */
async function bulkUpsertProducts(products) {
  const collection = getAritziaCollection();
  
  for (const product of products) {
    await upsertProduct(product);
  }
  
  console.log(`✅ Upserted ${products.length} products to MongoDB`);
}

/**
 * Find cotton products (90%+ cotton) with optional filters
 */
async function findCottonProducts(filters = {}) {
  const collection = getAritziaCollection();
  const query = { is_cotton_90: true };
  
  if (filters.category) {
    query.category = new RegExp(filters.category, 'i');
  }
  
  if (filters.maxPrice !== undefined) {
    query.price = { $lte: filters.maxPrice };
  }
  
  if (filters.searchQuery) {
    query.$or = [
      { name: new RegExp(filters.searchQuery, 'i') },
      { composition_raw: new RegExp(filters.searchQuery, 'i') },
    ];
  }
  
  const cursor = collection.find(query).sort({ price: 1 });
  return await cursor.toArray();
}

/**
 * Search products using text search
 */
async function searchProducts(query) {
  const collection = getAritziaCollection();
  
  // Create text index if it doesn't exist (run once)
  try {
    await collection.createIndex({ name: 'text', composition_raw: 'text' });
  } catch (e) {
    // Index might already exist, that's okay
  }
  
  const results = await collection.find({
    $text: { $search: query },
    is_cotton_90: true,
  }).limit(50).toArray();
  
  return results;
}

/**
 * Get all products (for Gemini context)
 */
async function getAllProducts(limit = 100) {
  const collection = getAritziaCollection();
  return await collection.find({ is_cotton_90: true }).limit(limit).toArray();
}

module.exports = {
  upsertProduct,
  bulkUpsertProducts,
  findCottonProducts,
  searchProducts,
  getAllProducts,
};
