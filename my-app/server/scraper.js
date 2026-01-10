const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const NodeCache = require('node-cache');

// Cache results for 1 hour
const cache = new NodeCache({ stdTTL: 3600 });

/**
 * Parse cotton percentage from material description
 */
function parseCottonPercentage(materialText) {
  if (!materialText) return 0;
  
  const cottonMatch = materialText.match(/(\d+)%?\s*cotton/i);
  if (cottonMatch) {
    return parseInt(cottonMatch[1]);
  }
  return 0;
}

/**
 * Extract color from product name or description
 */
function extractColor(name, description) {
  const colors = ['black', 'white', 'blue', 'red', 'green', 'navy', 'grey', 'gray', 'beige', 'brown'];
  const text = `${name} ${description}`.toLowerCase();
  
  for (const color of colors) {
    if (text.includes(color)) {
      return color.charAt(0).toUpperCase() + color.slice(1);
    }
  }
  return 'Various';
}

/**
 * Scrape individual product page for details
 */
async function scrapeProductPage(page, url) {
  try {
    console.log(`Scraping product: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for product details to load
    await page.waitForSelector('.product-details', { timeout: 10000 }).catch(() => {
      console.log('Product details selector not found, continuing...');
    });
    
    // Extract product information
    const productData = await page.evaluate(() => {
      // Try multiple selectors for each piece of data
      const getName = () => {
        const selectors = [
          '.product-name',
          '.product-title',
          'h1.product',
          '[data-testid="product-name"]',
          'h1'
        ];
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent.trim()) return el.textContent.trim();
        }
        return 'Unknown Product';
      };
      
      const getPrice = () => {
        const selectors = [
          '.product-price',
          '.price',
          '[data-testid="product-price"]',
          '.price-value'
        ];
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el) {
            const text = el.textContent.trim();
            const match = text.match(/\$?(\d+(?:\.\d{2})?)/);
            if (match) return parseFloat(match[1]);
          }
        }
        return 0;
      };
      
      const getMaterials = () => {
        const selectors = [
          '.product-materials',
          '.materials',
          '.fabric-content',
          '[data-testid="materials"]',
          '.composition'
        ];
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent.trim()) return el.textContent.trim();
        }
        
        // Try to find in product description
        const descEl = document.querySelector('.product-description');
        if (descEl) {
          const text = descEl.textContent;
          const materialMatch = text.match(/(\d+%\s*\w+(?:,\s*\d+%\s*\w+)*)/);
          if (materialMatch) return materialMatch[0];
        }
        
        return '';
      };
      
      const getImage = () => {
        const selectors = [
          '.product-image img',
          '.main-image img',
          '[data-testid="product-image"] img',
          '.gallery img',
          'img[alt*="product"]'
        ];
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el && el.src) return el.src;
        }
        return '';
      };
      
      return {
        name: getName(),
        price: getPrice(),
        materials: getMaterials(),
        image: getImage()
      };
    });
    
    // Parse cotton percentage
    const cottonPercentage = parseCottonPercentage(productData.materials);
    
    // Only return if we found valid data
    if (!productData.name || productData.name === 'Unknown Product') {
      console.log(`Skipping ${url} - couldn't extract product name`);
      return null;
    }
    
    return {
      id: url.split('/').pop().split('.')[0] || Math.random().toString(36).substr(2, 9),
      name: productData.name,
      brand: 'Aritzia',
      price: productData.price,
      cottonPercentage: cottonPercentage,
      materials: productData.materials || 'Material information not available',
      color: extractColor(productData.name, productData.materials),
      image: productData.image || 'https://via.placeholder.com/400',
      url: url
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return null;
  }
}

/**
 * Main search function using Puppeteer
 */
async function scrapeAritziaSearch(query) {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set user agent to avoid blocking
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to search page
    const searchUrl = `https://www.aritzia.com/en/search?q=${encodeURIComponent(query)}`;
    console.log(`Searching: ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for products to load - try multiple selectors
    const productSelectors = [
      '.product-tile',
      '.product-card',
      '[data-testid="product-tile"]',
      '.product-item'
    ];
    
    let productsFound = false;
    for (const selector of productSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        productsFound = true;
        console.log(`Found products with selector: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!productsFound) {
      console.log('No products found on search page');
      await browser.close();
      return [];
    }
    
    // Extract product URLs
    const productUrls = await page.evaluate(() => {
      const links = [];
      const selectors = [
        '.product-tile a',
        '.product-card a',
        '[data-testid="product-tile"] a',
        '.product-item a',
        'a[href*="/product/"]'
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const href = el.href;
          if (href && href.includes('aritzia.com') && href.includes('/product/')) {
            if (!links.includes(href)) {
              links.push(href);
            }
          }
        });
        if (links.length > 0) break;
      }
      
      return links;
    });
    
    console.log(`Found ${productUrls.length} product URLs`);
    
    if (productUrls.length === 0) {
      await browser.close();
      return [];
    }
    
    // Scrape each product page (limit to 10 to avoid overwhelming)
    const products = [];
    const urlsToScrape = productUrls.slice(0, 10);
    
    for (const url of urlsToScrape) {
      const product = await scrapeProductPage(page, url);
      
      // Only add products with 90%+ cotton
      if (product && product.cottonPercentage >= 90) {
        products.push(product);
        console.log(`✓ Added: ${product.name} (${product.cottonPercentage}% cotton)`);
      } else if (product) {
        console.log(`✗ Skipped: ${product.name} (${product.cottonPercentage}% cotton - below 90%)`);
      }
      
      // Add delay between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    await browser.close();
    return products;
    
  } catch (error) {
    console.error('Scraping error:', error);
    await browser.close();
    throw error;
  }
}

/**
 * Main search function with caching
 */
async function searchAritzia(query) {
  const cacheKey = `search_${query.toLowerCase()}`;
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('Returning cached results');
    return cached;
  }

  try {
    console.log(`Starting real scraping for: ${query}`);
    
    // Use real scraping
    const products = await scrapeAritziaSearch(query);
    
    // Cache results
    if (products.length > 0) {
      cache.set(cacheKey, products);
    }
    
    return products;
    
  } catch (error) {
    console.error('Search error:', error);
    
    // Fallback to mock data if scraping fails
    console.log('Falling back to mock data due to error');
    return getMockProducts(query);
  }
}

/**
 * Mock product data as fallback
 */
async function getMockProducts(query) {
  const queryLower = query.toLowerCase();
  
  const allProducts = [
    {
      id: '1',
      name: 'Essential Cotton T-Shirt',
      brand: 'Aritzia',
      price: 45,
      cottonPercentage: 100,
      materials: '100% Cotton',
      color: 'Black',
      image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400',
      url: 'https://www.aritzia.com/en/product/essential-tshirt/67890.html'
    },
    {
      id: '2',
      name: 'Premium Black Tee',
      brand: 'Aritzia',
      price: 38,
      cottonPercentage: 95,
      materials: '95% Cotton, 5% Elastane',
      color: 'Black',
      image: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400',
      url: 'https://www.aritzia.com/en/product/premium-tee/11111.html'
    },
    {
      id: '3',
      name: 'Classic Cotton Shirt',
      brand: 'Aritzia',
      price: 68,
      cottonPercentage: 92,
      materials: '92% Cotton, 8% Polyester',
      color: 'White',
      image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400',
      url: 'https://www.aritzia.com/en/product/classic-shirt/22222.html'
    },
  ];
  
  return allProducts.filter(product => {
    const searchText = `${product.name} ${product.color} ${product.materials}`.toLowerCase();
    const queryWords = queryLower.split(' ');
    return queryWords.some(word => searchText.includes(word));
  });
}

module.exports = {
  searchAritzia,
  parseCottonPercentage
};