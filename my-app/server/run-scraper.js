#!/usr/bin/env node
/**
 * Zara Product Scraper - Main Runner
 * Scrapes Zara website to extract product information and organize it by category and gender.
 * 
 * Usage:
 *   node server/run-scraper.js
 *   node server/run-scraper.js --config custom-config.json
 */

require('dotenv').config();
const { scrapeAllZaraProducts } = require('./scraper');
const { bulkUpsertProducts } = require('./db/repositories');
const { connect, disconnect } = require('./db/mongoClient');
const fs = require('fs');
const path = require('path');

// Default target counts (matching Python example)
const DEFAULT_TARGET_COUNTS = {
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

async function main() {
  console.log('='.repeat(60));
  console.log('🌿 Zara Cotton Product Scraper');
  console.log('='.repeat(60));
  
  // Check for custom config file
  let targetCounts = DEFAULT_TARGET_COUNTS;
  const configArg = process.argv.find(arg => arg.startsWith('--config'));
  
  if (configArg) {
    const configPath = configArg.split('=')[1] || path.join(__dirname, '../config/scraping-config.json');
    try {
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        targetCounts = { ...DEFAULT_TARGET_COUNTS, ...config.target_counts };
        console.log(`✅ Loaded target counts from: ${configPath}\n`);
      } else {
        console.log(`⚠️  Config file not found: ${configPath}`);
        console.log(`   Using default target counts\n`);
      }
    } catch (error) {
      console.error(`❌ Error loading config: ${error.message}`);
      console.log(`   Using default target counts\n`);
    }
  } else {
    // Try to load from default config location
    const defaultConfigPath = path.join(__dirname, '../config/scraping-config.json');
    if (fs.existsSync(defaultConfigPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8'));
        targetCounts = { ...DEFAULT_TARGET_COUNTS, ...config.target_counts };
        console.log(`✅ Loaded target counts from config file\n`);
      } catch (error) {
        console.log(`⚠️  Error reading config, using defaults\n`);
      }
    } else {
      console.log(`📋 Using default target counts (no config file found)\n`);
    }
  }
  
  // Display target counts
  console.log('Target counts:');
  Object.entries(targetCounts)
    .filter(([_, count]) => count > 0)
    .forEach(([key, count]) => {
      console.log(`  ${key}: ${count}`);
    });
  console.log();
  
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await connect();
    console.log('✅ Connected to MongoDB\n');
    
    // Scrape products (matching Python example structure)
    const products = await scrapeAllZaraProducts(targetCounts);
    
    // Save to MongoDB
    if (products.length > 0) {
      console.log(`\n💾 Saving ${products.length} products to MongoDB...`);
      await bulkUpsertProducts(products);
      console.log(`✅ Saved ${products.length} products to MongoDB`);
    } else {
      console.log('\n⚠️  No products found to save');
    }
    
    // Save to JSON file (like Python example)
    const outputFile = 'zara_products.json';
    fs.writeFileSync(outputFile, JSON.stringify(products, null, 2), 'utf8');
    console.log(`✅ Saved ${products.length} products to ${outputFile}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Scraping completed successfully!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Error during scraping:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await disconnect();
    process.exit(0);
  }
}

// Run the scraper
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
