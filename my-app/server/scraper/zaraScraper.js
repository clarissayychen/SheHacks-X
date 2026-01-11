const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { parseComposition, getCottonPercentage } = require('./compositionParser');

/**
 * Zara Product Scraper
 * Scrapes Zara website to extract product information for all clothing categories
 */
class ZaraScraper {
  constructor() {
    this.baseUrl = 'https://www.zara.com';
    this.categoryMappings = {
      'shirts': {
        'male': 'https://www.zara.com/ca/en/man-shirts-l737.html?v1=2431994&regionGroupId=124',
        'female': 'https://www.zara.com/ca/en/woman-shirts-l1217.html?v1=2420369&regionGroupId=124'
      },
      'pants': {
        'male': 'https://www.zara.com/ca/en/man-trousers-l838.html?v1=2432096&regionGroupId=124',
        'female': 'https://www.zara.com/ca/en/woman-trousers-l1335.html?v1=2420795&regionGroupId=124'
      },
      'dresses': {
        'female': 'https://www.zara.com/ca/en/woman-dresses-l1066.html?v1=2420896&regionGroupId=124'
      },
      'tshirts': {
        'male': 'https://www.zara.com/ca/en/man/t-shirts-l835.html?v1=2432058',
        'female': 'https://www.zara.com/ca/en/woman/t-shirts-l1063.html?v1=2420542'
      },
      'tops': {
        'female': 'https://www.zara.com/ca/en/woman-tops-l1141.html'
      },
      'skirts': {
        'female': 'https://www.zara.com/ca/en/woman-skirts-l1200.html'
      },
      'jackets': {
        'male': 'https://www.zara.com/ca/en/man-jackets-l828.html',
        'female': 'https://www.zara.com/ca/en/woman-jackets-l1058.html'
      }
    };
  }

  /**
   * Get product URLs from a category page (can use existing browser/page)
   */
  async getProductUrls(category, gender, limit = 20, page = null) {
    const urls = [];

    if (!this.categoryMappings[category]) {
      console.error(`Unknown category: ${category}`);
      return urls;
    }

    if (!this.categoryMappings[category][gender]) {
      console.error(`Gender ${gender} not available for category ${category}`);
      return urls;
    }

    const categoryUrl = this.categoryMappings[category][gender];
    let shouldCloseBrowser = false;
    let browser = null;

    try {
      console.log(`📂 Fetching products from: ${categoryUrl}`);
      
      // Use provided page or create new browser
      if (!page) {
        browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process'
          ]
        });
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Set extra headers to appear more like a real browser
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        });
        shouldCloseBrowser = true;
      }

      // Try multiple navigation strategies
      console.log('   🌐 Navigating to category page...');
      let navigationSuccess = false;
      
      try {
        // Strategy 1: Try with load event (less strict than networkidle)
        await page.goto(categoryUrl, { 
          waitUntil: 'load', 
          timeout: 90000  // Increased to 90 seconds
        });
        navigationSuccess = true;
        console.log('   ✅ Page loaded (using load event)');
      } catch (error) {
        console.log('   ⚠️  Load event timeout, trying domcontentloaded...');
        try {
          // Strategy 2: Try with domcontentloaded (even less strict)
          await page.goto(categoryUrl, { 
            waitUntil: 'domcontentloaded', 
            timeout: 90000 
          });
          navigationSuccess = true;
          console.log('   ✅ Page loaded (using domcontentloaded)');
        } catch (error2) {
          console.log('   ⚠️  domcontentloaded timeout, using basic navigation...');
          // Strategy 3: Just navigate and wait manually
          await page.goto(categoryUrl, { 
            waitUntil: 'commit', 
            timeout: 90000 
          });
          navigationSuccess = true;
          console.log('   ✅ Page navigated (using commit)');
        }
      }
      
      // Wait for dynamic content (Zara loads products dynamically)
      console.log('   ⏳ Waiting for products to load (10 seconds)...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Try to wait for product elements to appear
      console.log('   🔍 Checking for product elements...');
      try {
        // Wait for any product links or product cards to appear
        await page.waitForSelector('a[href*="/p"]', { timeout: 15000 }).catch(() => {
          console.log('   ⚠️  Product links selector not found, continuing anyway...');
        });
      } catch (selectorError) {
        console.log('   ℹ️  No specific product selector found, will extract all links...');
      }

      // Scroll to load lazy content
      console.log('   📜 Scrolling to load all products...');
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 300;
          const maxScroll = 6000;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= scrollHeight || totalHeight >= maxScroll) {
              clearInterval(timer);
              resolve();
            }
          }, 200);
        });
      });

      await new Promise(resolve => setTimeout(resolve, 5000));

      // Extract product URLs using multiple patterns (like Python example)
      const baseUrl = this.baseUrl;
      const productUrls = await page.evaluate((baseUrl) => {
        const links = new Set();

        // Pattern 1: Look for product links in various Zara formats
        // Zara product URLs can be: /ca/en/woman/product/p123456.html
        // or /ca/en/woman/product/p123456.html?v1=123
        const allLinks = document.querySelectorAll('a[href]');
        console.log(`Total links found on page: ${allLinks.length}`);
        
        allLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href) {
            // Match Zara product URL patterns (comprehensive):
            // - /p123456.html, p123456.html (with or without leading slash)
            // - /ca/en/woman/product-name/p123456.html
            // - /product/p123456.html
            // - Any URL containing /p[digits].html pattern
            const isProductUrl = 
              href.match(/\/p\d+\.html/i) ||           // /p123456.html
              href.match(/p\d+\.html/i) ||             // p123456.html (relative)
              (href.includes('/p') && href.includes('.html')) ||  // Contains /p and .html
              href.match(/\/ca\/en\/[^/]+\/[^/]+\/p\d+\.html/i) || // Full path: /ca/en/gender/category/p123.html
              href.match(/\/product\/[^/]+\/p\d+\.html/i) ||       // Product path: /product/name/p123.html
              (href.includes('/ca/en/') && href.includes('/p') && href.match(/\d+\.html/)); // Generic: has /ca/en/ and /p[digits].html
            
            if (isProductUrl) {
              let fullUrl = href;
              
              // Convert relative URLs to absolute
              if (href.startsWith('/')) {
                fullUrl = baseUrl + href;
              } else if (!href.startsWith('http')) {
                fullUrl = `${baseUrl}/${href}`;
              }
              
              // Clean and validate URL
              if (fullUrl.includes('zara.com')) {
                const cleanUrl = fullUrl.split('?')[0].split('#')[0];
                
                // Validate it's actually a product URL (has product ID pattern)
                // Zara products always have /p[digits].html somewhere in the URL
                if (cleanUrl.match(/p\d+\.html/i)) {
                  links.add(cleanUrl);
                }
              }
            }
          }
        });

        // Pattern 2: Product cards with data attributes (like Python example)
        const productCards = document.querySelectorAll('a[data-qa-action="product-card"]');
        console.log(`Product cards with data-qa-action found: ${productCards.length}`);
        productCards.forEach(card => {
          const href = card.getAttribute('href');
          if (href) {
            let fullUrl = href;
            if (href.startsWith('/')) {
              fullUrl = baseUrl + href;
            } else if (!href.startsWith('http')) {
              fullUrl = `${baseUrl}/${href}`;
            }
            if (fullUrl.includes('zara.com') && (fullUrl.includes('/p') || fullUrl.match(/p\d+\.html/i))) {
              links.add(fullUrl.split('?')[0].split('#')[0]);
            }
          }
        });

        // Pattern 3: Links within product-related containers
        const productContainers = document.querySelectorAll('[class*="product"], [class*="Product"], article[class*="item"]');
        console.log(`Product containers found: ${productContainers.length}`);
        productContainers.forEach(container => {
          const containerLinks = container.querySelectorAll('a[href]');
          containerLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href && (href.includes('/p') || href.match(/p\d+\.html/i))) {
              let fullUrl = href;
              if (href.startsWith('/')) {
                fullUrl = baseUrl + href;
              } else if (!href.startsWith('http')) {
                fullUrl = `${baseUrl}/${href}`;
              }
              if (fullUrl.includes('zara.com')) {
                links.add(fullUrl.split('?')[0].split('#')[0]);
              }
            }
          });
        });

        // Pattern 4: Links with product IDs in path (more specific)
        const productIdLinks = document.querySelectorAll('a[href*="/ca/en/woman"], a[href*="/ca/en/man"]');
        console.log(`Gender-specific links found: ${productIdLinks.length}`);
        productIdLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href && (href.match(/p\d+\.html/i) || href.includes('/product/'))) {
            let fullUrl = href;
            if (href.startsWith('/')) {
              fullUrl = baseUrl + href;
            }
            links.add(fullUrl.split('?')[0].split('#')[0]);
          }
        });

        console.log(`Total unique product URLs extracted: ${links.size}`);
        // Log first few URLs for debugging
        if (links.size > 0) {
          const sampleUrls = Array.from(links).slice(0, 3);
          console.log('Sample URLs:', sampleUrls);
        }
        return Array.from(links);
      }, baseUrl);

      console.log(`   ✅ Found ${productUrls.length} product URLs for ${gender} ${category}`);
      return productUrls.slice(0, limit);
    } catch (error) {
      console.error(`   ❌ Error fetching product URLs: ${error.message}`);
      console.error(`   Error details:`, error);
      
      // Try to get screenshot for debugging if page exists
      if (page && browser) {
        try {
          await page.screenshot({ path: `zara-error-${Date.now()}.png` });
          console.log('   📸 Screenshot saved for debugging');
        } catch (screenshotError) {
          // Ignore screenshot errors
        }
      }
      
      return urls;
    } finally {
      if (shouldCloseBrowser && browser) {
        await browser.close();
      }
    }
  }

  /**
   * Extract product information from a product page (can use existing browser/page)
   */
  async extractProductInfo(url, page = null) {
    let shouldCloseBrowser = false;
    let browser = null;

    try {
      console.log(`   🔍 Scraping product: ${url}`);

      // Use provided page or create new browser
      if (!page) {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        shouldCloseBrowser = true;
      }
        
      // Try multiple navigation strategies for product page
      try {
        await page.goto(url, { 
          waitUntil: 'load', 
          timeout: 90000 
        });
      } catch (error) {
        try {
          await page.goto(url, { 
            waitUntil: 'domcontentloaded', 
            timeout: 90000 
          });
        } catch (error2) {
          await page.goto(url, { 
            waitUntil: 'commit', 
            timeout: 90000 
          });
        }
      }
      await new Promise(resolve => setTimeout(resolve, 5000));

      const productData = await page.evaluate(() => {
          // Extract product name
          const getName = () => {
            const selectors = [
              'h1.product-detail-info__header-name',
              'h1.product-detail-card-info__header-name',
              'h1[data-qa-action="product-detail-name"]',
              '.product-detail-info__header-name',
              '.product-detail-card-info__header-name',
              'h1'
            ];
            for (const selector of selectors) {
              const el = document.querySelector(selector);
              if (el && el.textContent && el.textContent.trim().length > 0) {
                return el.textContent.trim();
              }
            }
            return 'Unknown Product';
          };

          // Extract price
          const getPrice = () => {
            const selectors = [
              'span.price-current__amount',
              '.price-current__amount',
              '[data-qa-action="product-detail-price"]',
              '.product-detail-info__price-current',
              '.product-detail-card-info__price-current',
              '[class*="price"]'
            ];
            
            // Also search in all text
            const bodyText = document.body.textContent || '';
            const pricePatterns = [
              /\$(\d+(?:\.\d{2})?)/,
              /CAD\s*\$?(\d+(?:\.\d{2})?)/,
              /(\d+(?:\.\d{2})?)\s*CAD/,
            ];

            for (const selector of selectors) {
              const elements = document.querySelectorAll(selector);
              for (const el of elements) {
                const text = el.textContent?.trim() || '';
                const match = text.match(/\$?(\d+(?:\.\d{2})?)/);
                if (match) {
                  const price = parseFloat(match[1]);
                  if (price > 0 && price < 10000) return price;
                }
              }
            }

            // Fallback: search entire body
            for (const pattern of pricePatterns) {
              const match = bodyText.match(pattern);
              if (match) {
                const price = parseFloat(match[1]);
                if (price > 0 && price < 10000) return price;
              }
            }
            return 0;
          };

          // Extract description/materials
          const getMaterials = () => {
            const selectors = [
              'div.product-detail-description',
              '.product-detail-description',
              '.product-detail-info__description',
              '.product-detail-card-info__description',
              '[data-qa-action="product-detail-description"]',
              '[class*="description"]',
              '[class*="composition"]',
              '[class*="materials"]'
            ];

            for (const selector of selectors) {
              const elements = document.querySelectorAll(selector);
              for (const el of elements) {
                const text = el.textContent?.trim() || '';
                // Look for material patterns
                if (text.match(/\d+%\s*\w+/i)) {
                  return text;
                }
              }
            }

            // Search entire page for material info
            const allText = document.body.textContent || '';
            const materialPatterns = [
              /(\d+%\s*(?:cotton|elastane|polyester|nylon|viscose|spandex|lycra|modal|rayon|silk|wool|cashmere)(?:\s*,\s*\d+%\s*\w+)*)/gi,
              /Composition[:\s]*([^.\n]{20,200})/i,
              /Materials?[:\s]*([^.\n]{20,200})/i,
            ];

            for (const pattern of materialPatterns) {
              const match = allText.match(pattern);
              if (match && match[0]) {
                return match[0].trim();
              }
            }

            return '';
          };

          // Extract images
          const getImages = () => {
            const images = [];
            const selectors = [
              'ul.product-detail-view__extra-images img',
              '.product-detail-view__extra-images img',
              '.product-detail-view__secondary-content img',
              '.product-detail-view__main-content img',
              '[data-qa-action="product-detail-image"] img',
              '.product-detail-info__image img',
              '.product-detail-card-info__image img',
              'img[src*="static.zara.net"]'
            ];

            for (const selector of selectors) {
              const elements = document.querySelectorAll(selector);
              for (const img of elements) {
                let src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
                if (src && !src.includes('placeholder') && !src.includes('data:image')) {
                  // Convert to high resolution
                  if (src.includes('static.zara.net')) {
                    src = src.split('?')[0] + '?w=1920';
                  }
                  if (src.startsWith('http')) {
                    images.push(src);
                  } else if (src.startsWith('//')) {
                    images.push('https:' + src);
                  } else if (src.startsWith('/')) {
                    images.push('https://www.zara.com' + src);
                  }
                }
              }
              if (images.length > 0) break;
            }

            // Fallback: find all Zara product images
            if (images.length === 0) {
              const allImgs = document.querySelectorAll('img[src*="static.zara.net"]');
              allImgs.forEach(img => {
                let src = img.getAttribute('src');
                if (src && 'product' in src.toLowerCase() && !src.includes('logo')) {
                  src = src.split('?')[0] + '?w=1920';
                  if (src.startsWith('http')) images.push(src);
                }
              });
            }

            return images;
          };

          // Extract sizes
          const getSizes = () => {
            const sizes = [];
            const selectors = [
              'button.product-detail-size-selector__size-list-item',
              '.product-detail-size-selector__size-list-item',
              '[data-qa-action="product-detail-size"]',
              '.product-detail-info__size-selector button',
              '.product-detail-card-info__size-selector button',
              'button[class*="size"]'
            ];

            for (const selector of selectors) {
              const elements = document.querySelectorAll(selector);
              for (const el of elements) {
                const text = el.textContent?.trim() || '';
                if (text && text.length <= 5 && /^(XS|S|M|L|XL|XXL|\d+)$/i.test(text)) {
                  if (!sizes.includes(text)) {
                    sizes.push(text);
                  }
                }
              }
              if (sizes.length > 0) break;
            }
            return sizes;
          };

          return {
            name: getName(),
            price: getPrice(),
            materials: getMaterials(),
            images: getImages(),
            sizes: getSizes()
          };
      });

      // Determine category and gender from URL
      const category = this.determineCategory(url, productData.name, productData.materials);
      const gender = this.determineGender(url);

      // Parse composition
      const compositionText = productData.materials || '';
      const cottonPercentage = getCottonPercentage(compositionText);
      const { composition: compositionParsed, isCotton90 } = parseComposition(compositionText);

      if (!productData.name || productData.name === 'Unknown Product') {
        console.log(`   ⚠️  Skipping ${url} - couldn't extract product name`);
        return null;
      }

      return {
        id: url.match(/p(\d+)/)?.[1] || Math.random().toString(36).substr(2, 9),
        name: productData.name,
        site: 'zara',
        brand: 'Zara',
        price: productData.price,
        currency: 'CAD',
        cottonPercentage: cottonPercentage,
        materials: compositionText || 'Material information not available',
        composition_parsed: compositionParsed,
        is_cotton_90: isCotton90,
        images: productData.images || [],
        image: productData.images[0] || '',
        sizes_available: productData.sizes || [],
        category: category,
        gender: gender,
        url: url,
      };

    } catch (error) {
      console.error(`   ❌ Error extracting product info from ${url}: ${error.message}`);
      return null;
    } finally {
      if (shouldCloseBrowser && browser) {
        await browser.close();
      }
    }
  }

  /**
   * Determine category from URL, name, and description
   */
  determineCategory(url, name, desc) {
    const urlLower = (url || '').toLowerCase();
    const nameLower = (name || '').toLowerCase();
    const descLower = (desc || '').toLowerCase();
    const combined = `${urlLower} ${nameLower} ${descLower}`;

    if (combined.includes('dress')) return 'dresses';
    if (combined.includes('shirt') || combined.includes('shirt')) return 'shirts';
    if (combined.includes('trouser') || combined.includes('pant') || combined.includes('jean')) return 'pants';
    if (combined.includes('tshirt') || combined.includes('t-shirt') || combined.includes('tee')) return 'tshirts';
    if (combined.includes('top') && !combined.includes('tshirt')) return 'tops';
    if (combined.includes('skirt')) return 'skirts';
    if (combined.includes('jacket')) return 'jackets';

    // Fallback to URL path
    if (urlLower.includes('/dresses')) return 'dresses';
    if (urlLower.includes('/shirts')) return 'shirts';
    if (urlLower.includes('/trousers') || urlLower.includes('/pants')) return 'pants';
    if (urlLower.includes('/t-shirts') || urlLower.includes('/tshirts')) return 'tshirts';
    if (urlLower.includes('/tops')) return 'tops';
    if (urlLower.includes('/skirts')) return 'skirts';
    if (urlLower.includes('/jackets')) return 'jackets';

    return 'unknown';
  }

  /**
   * Determine gender from URL
   */
  determineGender(url) {
    const urlLower = (url || '').toLowerCase();
    if (urlLower.includes('/man') || urlLower.includes('/men')) return 'male';
    if (urlLower.includes('/woman') || urlLower.includes('/women')) return 'female';
    return 'unknown';
  }

  /**
   * Search products using Zara search URL format
   * Example: https://www.zara.com/ca/en/search?searchTerm=cotton&section=WOMAN
   */
  async searchZaraProducts(searchTerm, section = 'WOMAN', limit = 20, page = null) {
    const searchUrl = `${this.baseUrl}/ca/en/search?searchTerm=${encodeURIComponent(searchTerm)}&section=${section}`;
    let shouldCloseBrowser = false;
    let browser = null;

    try {
      console.log(`🔍 Searching Zara: "${searchTerm}" for ${section}`);
      console.log(`   URL: ${searchUrl}`);

      // Use provided page or create new browser
      if (!page) {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        shouldCloseBrowser = true;
      }

      // Try multiple navigation strategies for search page
      console.log('   🌐 Navigating to search page...');
      try {
        await page.goto(searchUrl, { 
          waitUntil: 'load', 
          timeout: 90000  // Increased to 90 seconds
        });
        console.log('   ✅ Search page loaded (using load event)');
      } catch (error) {
        console.log('   ⚠️  Load event timeout, trying domcontentloaded...');
        try {
          await page.goto(searchUrl, { 
            waitUntil: 'domcontentloaded', 
            timeout: 90000 
          });
          console.log('   ✅ Search page loaded (using domcontentloaded)');
        } catch (error2) {
          console.log('   ⚠️  domcontentloaded timeout, using basic navigation...');
          await page.goto(searchUrl, { 
            waitUntil: 'commit', 
            timeout: 90000 
          });
          console.log('   ✅ Search page navigated (using commit)');
        }
      }
      
      // Wait for dynamic content (Zara search results load dynamically)
      console.log('   ⏳ Waiting for search results to load (10 seconds)...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Try to wait for product elements
      try {
        await page.waitForSelector('a[href*="/p"]', { timeout: 15000 }).catch(() => {
          console.log('   ⚠️  Product links selector not found, continuing anyway...');
        });
      } catch (selectorError) {
        console.log('   ℹ️  No specific product selector found, will extract all links...');
      }

      // Scroll to load lazy content
      console.log('   📜 Scrolling to load all products...');
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 300;
          const maxScroll = 8000;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= scrollHeight || totalHeight >= maxScroll) {
              clearInterval(timer);
              resolve();
            }
          }, 200);
        });
      });

      await new Promise(resolve => setTimeout(resolve, 5000));

      // Extract product URLs from search results
      const baseUrl = this.baseUrl;
      const productUrls = await page.evaluate((baseUrl) => {
        const links = new Set();

        // Pattern 1: Direct product links with p[number].html format
        const allLinks = document.querySelectorAll('a[href]');
        console.log(`Total links found on search page: ${allLinks.length}`);
        
        allLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href) {
            // Zara product URLs: /ca/en/man/product/p123456.html or p123456.html
            if (href.match(/\/p\d+\.html/i) || href.match(/p\d+\.html/i) || (href.includes('/p') && href.includes('.html'))) {
              let fullUrl = href;
              if (href.startsWith('/')) {
                fullUrl = baseUrl + href;
              } else if (!href.startsWith('http')) {
                fullUrl = `${baseUrl}/${href}`;
              }
              
              if (fullUrl.includes('zara.com') && (fullUrl.includes('/p') || fullUrl.match(/p\d+\.html/i))) {
                const cleanUrl = fullUrl.split('?')[0].split('#')[0];
                links.add(cleanUrl);
              }
            }
          }
        });

        // Pattern 2: Product cards with data attributes
        const productCards = document.querySelectorAll('a[data-qa-action="product-card"]');
        console.log(`Product cards found: ${productCards.length}`);
        productCards.forEach(card => {
          const href = card.getAttribute('href');
          if (href) {
            let fullUrl = href;
            if (href.startsWith('/')) {
              fullUrl = baseUrl + href;
            } else if (!href.startsWith('http')) {
              fullUrl = `${baseUrl}/${href}`;
            }
            if (fullUrl.includes('zara.com') && (fullUrl.includes('/p') || fullUrl.match(/p\d+\.html/i))) {
              links.add(fullUrl.split('?')[0].split('#')[0]);
            }
          }
        });

        // Pattern 3: Links with product IDs in path
        const productIdLinks = document.querySelectorAll('a[href*="/ca/en/"][href*="/p"]');
        productIdLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href && href.match(/p\d+\.html/i)) {
            let fullUrl = href;
            if (href.startsWith('/')) {
              fullUrl = baseUrl + href;
            }
            links.add(fullUrl.split('?')[0].split('#')[0]);
          }
        });

        console.log(`Total unique product URLs from search: ${links.size}`);
        return Array.from(links);
      }, baseUrl);

      console.log(`   ✅ Found ${productUrls.length} product URLs from search results`);
      return productUrls.slice(0, limit);

    } catch (error) {
      console.error(`   ❌ Error searching Zara products: ${error.message}`);
      return [];
    } finally {
      if (shouldCloseBrowser && browser) {
        await browser.close();
      }
    }
  }

  /**
   * Search products by query - intelligently maps to categories or uses search URL
   */
  async searchProducts(query, limit = 10) {
    const queryLower = query.toLowerCase().trim();
    const products = [];

    // If searching for "cotton", use the search URL directly (better results)
    if (queryLower.includes('cotton') || queryLower === 'cotton') {
      console.log(`🌿 Detected cotton search, using Zara search URL...`);
      
      let browser = null;
      let page = null;

      try {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });

        // Search both WOMAN and MAN sections
        const sections = ['WOMAN', 'MAN'];
        
        for (const section of sections) {
          if (products.length >= limit) break;
          
          console.log(`\n📋 Searching ${section} section for cotton products...`);
          const urls = await this.searchZaraProducts('cotton', section, limit * 2, page);
          
          console.log(`   📋 Found ${urls.length} URLs, extracting details...`);
          for (const url of urls.slice(0, Math.ceil(limit / sections.length))) {
            if (products.length >= limit) break;
            
            const product = await this.extractProductInfo(url, page);
            if (product && (product.is_cotton_90 || product.cottonPercentage >= 90)) {
              products.push(product);
              console.log(`      ✅ ${product.name} (${product.cottonPercentage}% cotton) - $${product.price}`);
            } else if (product) {
              console.log(`      ⚠️  ${product.name} (${product.cottonPercentage}% cotton - below 90%)`);
            }
            
            // Delay between requests (2-4 seconds)
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
          }
        }

        console.log(`\n✅ Total cotton products found: ${products.length}`);
        return products.slice(0, limit);

      } catch (error) {
        console.error(`❌ Error in cotton search: ${error.message}`);
        return products;
      } finally {
        if (browser) {
          await browser.close();
        }
      }
    }

    // For other queries, use category mapping approach
    // IMPORTANT: Order matters! More specific terms must come first
    // We check exact match first, then contains to avoid "t-shirt" matching "shirt"
    let matchedCategory = null;
    let matchedGenders = ['female']; // Default to female

    // Check for exact matches first (more specific)
    if (queryLower === 't-shirt' || queryLower === 'tshirt' || queryLower === 'tee' || queryLower === 'tees') {
      matchedCategory = 'tshirts';
      matchedGenders = ['male', 'female'];
      console.log(`   ✅ Matched "${query}" (exact) → category: tshirts`);
    } else if (queryLower.includes('t-shirt') || queryLower.includes('tshirt') || queryLower.includes(' tee')) {
      matchedCategory = 'tshirts';
      matchedGenders = ['male', 'female'];
      console.log(`   ✅ Matched "${query}" → category: tshirts`);
    } else if (queryLower.includes('shirt') && !queryLower.includes('t-shirt')) {
      matchedCategory = 'shirts';
      matchedGenders = ['male', 'female'];
      console.log(`   ✅ Matched "${query}" → category: shirts`);
    } else if (queryLower.includes('dress')) {
      matchedCategory = 'dresses';
      matchedGenders = ['female'];
      console.log(`   ✅ Matched "${query}" → category: dresses`);
    } else if (queryLower.includes('trouser') || queryLower.includes('pant')) {
      matchedCategory = 'pants';
      matchedGenders = ['male', 'female'];
      console.log(`   ✅ Matched "${query}" → category: pants`);
    } else if (queryLower.includes('top') && !queryLower.includes('t-shirt')) {
      matchedCategory = 'tops';
      matchedGenders = ['female'];
      console.log(`   ✅ Matched "${query}" → category: tops`);
    } else if (queryLower.includes('skirt')) {
      matchedCategory = 'skirts';
      matchedGenders = ['female'];
      console.log(`   ✅ Matched "${query}" → category: skirts`);
    } else if (queryLower.includes('jacket')) {
      matchedCategory = 'jackets';
      matchedGenders = ['male', 'female'];
      console.log(`   ✅ Matched "${query}" → category: jackets`);
    }

    // If no match, try all categories
    if (!matchedCategory) {
      console.log(`No specific category match for "${query}", searching all categories`);
      matchedCategory = null;
      matchedGenders = ['female', 'male'];
    }

    // Reuse browser instance for efficiency
    let browser = null;
    let page = null;

    try {
      // Create browser once and reuse
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      // Scrape products
      if (matchedCategory) {
        console.log(`✅ Matched "${query}" to category: ${matchedCategory} (${matchedGenders.join(', ')})`);
        
        for (const gender of matchedGenders) {
          if (this.categoryMappings[matchedCategory]?.[gender]) {
            console.log(`   🔍 Searching ${gender} ${matchedCategory}...`);
            const urls = await this.getProductUrls(matchedCategory, gender, limit * 2, page);
            
            console.log(`   📋 Found ${urls.length} URLs, extracting details...`);
            for (const url of urls.slice(0, Math.ceil(limit / matchedGenders.length))) {
              if (products.length >= limit) break;
              
              const product = await this.extractProductInfo(url, page);
              if (product && (product.is_cotton_90 || product.cottonPercentage >= 90)) {
                products.push(product);
                console.log(`      ✅ ${product.name} (${product.cottonPercentage}% cotton) - $${product.price}`);
              } else if (product) {
                console.log(`      ⚠️  ${product.name} (${product.cottonPercentage}% cotton - below 90%)`);
              }
              
              // Delay between requests (2-4 seconds)
              await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
            }
          }
        }
      } else {
        // Search top 3 categories if no specific match
        console.log(`   ℹ️  No specific category match, searching top categories...`);
        const allCategories = Object.keys(this.categoryMappings).slice(0, 3);
        const perCategory = Math.ceil(limit / 3);
        
        for (const category of allCategories) {
          if (products.length >= limit) break;
          
          const genders = Object.keys(this.categoryMappings[category]);
          for (const gender of genders) {
            if (products.length >= limit) break;
            
            const urls = await this.getProductUrls(category, gender, perCategory, page);
            for (const url of urls.slice(0, Math.ceil(perCategory / genders.length))) {
              if (products.length >= limit) break;
              
              const product = await this.extractProductInfo(url, page);
              if (product && (product.is_cotton_90 || product.cottonPercentage >= 90)) {
                products.push(product);
                console.log(`      ✅ ${product.name} (${product.cottonPercentage}% cotton)`);
              }
              
              await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
            }
          }
        }
      }

      console.log(`\n✅ Total products found: ${products.length}`);
      return products.slice(0, limit);

    } catch (error) {
      console.error(`❌ Error in searchProducts: ${error.message}`);
      return products;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

module.exports = ZaraScraper;
