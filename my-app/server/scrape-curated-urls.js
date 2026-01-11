/**
 * Script to scrape specific curated Zara URLs
 * Filters for 100% cotton items and stores them in MongoDB
 */

const ZaraScraper = require('./scraper/zaraScraper');
const { bulkUpsertProducts } = require('./db/repositories');
const { connect, disconnect } = require('./db/mongoClient');

// Curated URLs organized by category
const CURATED_URLS = {
  tops: [
    'https://www.zara.com/ca/en/turtleneck-t-shirt-p02335643.html?v1=503419331',
    'https://www.zara.com/ca/en/plaid-cotton-shirt-with-tie-zw-collection-p01063020.html?v1=501969918&v2=2420369',
    'https://www.zara.com/ca/en/turtleneck-t-shirt-p02335643.html?v1=503418040',
    'https://www.zara.com/ca/en/basic-cotton-t-shirt-p03253320.html?v1=506473367',
    'https://www.zara.com/ca/en/supima--cotton-t-shirt-p00858613.html?v1=506773111',
    'https://www.zara.com/ca/en/basic-cotton-t-shirt-p03253320.html?v1=503040858',
    'https://www.zara.com/ca/en/striped-scarf-poplin-shirt-p02055226.html?v1=498757832',
    'https://www.zara.com/ca/en/striped-poplin-shirt-with-scarf-detail-p02225456.html?v1=509541261',
    'https://www.zara.com/ca/en/zw-collection-bow-shirt-p01063899.html?v1=502565742',
    'https://www.zara.com/ca/en/100-mercerised-cotton-short-sleeve-t-shirt-p06201543.html?v1=502649622',
  ],
  pants: [
    'https://www.zara.com/ca/en/soft-touch-palazzo-pants-p05039223.html?v1=503986848',
    'https://www.zara.com/ca/en/zw-collection-high-waist-wide-leg-jeans-p09632253.html?v1=506929665',
    'https://www.zara.com/ca/en/trf-high-waisted-cropped-flare-jeans-p04592217.html?v1=503416302',
    'https://www.zara.com/ca/en/z-10-high-waisted-belted-culotte-jeans-p01889152.html?v1=511322231',
    'https://www.zara.com/ca/en/sporty-interlock-joggers-p04729793.html?v1=468828239',
    'https://www.zara.com/ca/en/high-waisted-faux-denim-pants-p05359212.html?v1=498354611',
    'https://www.zara.com/ca/en/corduroy-pants-with-pockets-p01255573.html?v1=505070538',
    'https://www.zara.com/ca/en/regular-denim-shorts-p04806510.html?v1=479512336',
    'https://www.zara.com/ca/en/zw-collection-mid-rise-ankle-balloon-jeans-p09632045.html?v1=507995178',
    'https://www.zara.com/ca/en/plain-bike-shorts-p02335616.html?v1=479160808',
    'https://www.zara.com/ca/en/limited-edition-striped-flare-pants-p03778785.html?v1=460046229',
    'https://www.zara.com/ca/en/z-03-high-waisted-straight-long-length-jeans-p08228224.html?v1=495680440',
    'https://www.zara.com/ca/en/pocket-cargo-pants-p05575241.html?v1=470177109',
  ],
  skirts: [
    'https://www.zara.com/ca/en/zw-collection-denim-midi-skirt-p09632286.html?v1=500020725',
    'https://www.zara.com/ca/en/slim-jeans-p02005706.html?v1=458132048',
    'https://www.zara.com/ca/en/pleated-midi-skirt-p01255564.html?v1=502971342',
    'https://www.zara.com/ca/en/animal-print-fine-waled-corduroy-skirt-p09492754.html?v1=488164933',
    'https://www.zara.com/ca/en/zw-collection-floral-pleated-skirt-p08603069.html?v1=471481622',
    'https://www.zara.com/ca/en/printed-midi-skirt-zw-collection-p02183048.html?v1=459175337',
    'https://www.zara.com/ca/en/midi-skirt-with-scarf-detail-p05274508.html?v1=496854029',
    'https://www.zara.com/ca/en/asymmetric-midi-skirt-p06050350.html?v1=472163469',
    'https://www.zara.com/ca/en/box-pleat-technical-fabric-midi-skirt-p05210506.html?v1=495411128',
    'https://www.zara.com/ca/en/ripped-trf-denim-skirt-p04365090.html?v1=477870300',
  ],
  dresses: [
    'https://www.zara.com/ca/en/plaid-short-dress-p04764302.html?v1=496086979',
    'https://www.zara.com/ca/en/floral-print-dress-p06161094.html?v1=478915737',
    'https://www.zara.com/ca/en/100-cotton-long-pleated-dress-p06682530.html?v1=463247369',
    'https://www.zara.com/ca/en/contrast-pleated-long-dress-p06652530.html?v1=463278603',
    'https://www.zara.com/ca/en/strapless-dress-p06929184.html?v1=452744408&v2=2580270',
  ],
};

/**
 * Extract color from product name or description
 */
function extractColor(name, description) {
  const colors = ['black', 'white', 'blue', 'red', 'green', 'navy', 'grey', 'gray', 'beige', 'brown', 'pink', 'yellow', 'striped', 'floral', 'plaid', 'animal print'];
  const text = `${name} ${description}`.toLowerCase();
  
  for (const color of colors) {
    if (text.includes(color)) {
      return color.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  return 'Various';
}

/**
 * Scrape all curated URLs
 */
async function scrapeCuratedUrls() {
  console.log('🚀 Starting curated URL scraping...\n');
  console.log('='.repeat(60));
  
  const scraper = new ZaraScraper();
  const allProducts = [];
  
  // Use a single browser instance for efficiency
  let browser = null;
  let page = null;
  
  try {
    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Process each category
    for (const [category, urls] of Object.entries(CURATED_URLS)) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📦 Scraping ${urls.length} ${category}...`);
      console.log(`${'='.repeat(60)}`);
      
      for (let i = 0; i < urls.length; i++) {
        // Clean URL (remove query parameters for consistent storage)
        const cleanUrl = urls[i].split('?')[0].split('#')[0];
        console.log(`\n[${i + 1}/${urls.length}] Processing: ${cleanUrl}`);
        
        try {
          const product = await scraper.extractProductInfo(cleanUrl, page);
          
          if (product && product.name && product.name !== 'Unknown Product') {
            // Add color extraction
            product.color = extractColor(product.name, product.materials);
            
            // Normalize category based on product name and assigned category
            // This ensures t-shirts, blouses, shirts all map to "tops"
            const nameLower = product.name.toLowerCase();
            let normalizedCategory = category;
            
            // Normalize based on product name patterns
            if (nameLower.includes('t-shirt') || nameLower.includes('tshirt') || 
                nameLower.includes('tee') || nameLower.includes('blouse') || 
                nameLower.includes('shirt') || category === 'tops') {
              normalizedCategory = 'tops';
            } else if (nameLower.includes('pant') || nameLower.includes('jean') || 
                       nameLower.includes('trouser') || category === 'pants') {
              normalizedCategory = 'pants';
            } else if (nameLower.includes('skirt') || category === 'skirts') {
              normalizedCategory = 'skirts';
            } else if (nameLower.includes('dress') || category === 'dresses') {
              normalizedCategory = 'dresses';
            }
            
            product.category = normalizedCategory;
            
            // Mark as curated
            product.isCurated = true;
            
            allProducts.push(product);
            
            const cottonInfo = product.cottonPercentage >= 100 
              ? `${product.cottonPercentage}% cotton ✅ (100%)` 
              : product.cottonPercentage >= 90
              ? `${product.cottonPercentage}% cotton ✅ (90%+)`
              : `${product.cottonPercentage}% cotton ⚠️`;
            
            console.log(`   ✅ ${product.name}`);
            console.log(`      Price: $${product.price} | ${cottonInfo}`);
          } else {
            console.log(`   ⚠️  Could not extract product information`);
          }
          
          // Delay between requests (2-4 seconds)
          await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
          
        } catch (error) {
          console.error(`   ❌ Error scraping ${url}:`, error.message);
          continue;
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error during scraping:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SCRAPING COMPLETED');
  console.log('='.repeat(60));
  console.log(`Total products scraped: ${allProducts.length}`);
  
  // Filter for 100% cotton items
  const cotton100Products = allProducts.filter(p => p.cottonPercentage === 100);
  const cotton90PlusProducts = allProducts.filter(p => p.cottonPercentage >= 90);
  
  console.log(`\n📈 Cotton Statistics:`);
  console.log(`   100% cotton: ${cotton100Products.length} products`);
  console.log(`   90%+ cotton: ${cotton90PlusProducts.length} products`);
  
  // Breakdown by category
  const categoryBreakdown = {};
  allProducts.forEach(p => {
    const cat = p.category || 'unknown';
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
  });
  
  console.log('\n📋 Products by category:');
  Object.entries(categoryBreakdown)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count} products`);
    });
  
  return allProducts;
}

/**
 * Main execution
 */
async function main() {
  try {
    // Connect to MongoDB
    await connect();
    console.log('✅ Connected to MongoDB\n');
    
    // Scrape all curated URLs
    const products = await scrapeCuratedUrls();
    
    // Save all products to MongoDB
    if (products.length > 0) {
      console.log('\n💾 Saving products to MongoDB...');
      await bulkUpsertProducts(products);
      console.log(`✅ Saved ${products.length} products to MongoDB`);
    }
    
    console.log('\n🎉 Done!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { scrapeCuratedUrls, CURATED_URLS };