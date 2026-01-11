# NoPoly - Zara Product Search App

A React Native mobile application that helps users find high-quality cotton clothing (90%+ cotton) from Zara. The app features a curated catalog of products, intelligent search functionality, and AI-powered recommendations using Google's Gemini API.

## 📱 Purpose

NoPoly is designed to help users easily discover and browse Zara clothing items that contain 90% or more cotton. The app provides:

- **Curated Product Catalog**: Pre-scraped collection of Zara products organized by category (Tops, Pants, Skirts, Dresses)
- **Intelligent Search**: Filter and search products by category, price, and cotton percentage
- **AI-Powered Recommendations**: Integration with Google Gemini API for natural language queries and product suggestions
- **Local Image Assets**: Optimized product images stored locally for fast loading
- **Category Normalization**: Smart categorization that groups similar items (e.g., t-shirts, blouses, shirts → tops)

## 🛠️ Tech Stack

### Frontend
- **React Native** (v0.81.5) - Cross-platform mobile framework
- **Expo** (~54.0.31) - Development platform and tooling
- **Expo Router** (~6.0.21) - File-based routing
- **Axios** (^1.13.2) - HTTP client for API requests
- **React Native Safe Area Context** - Safe area handling
- **React Native Gesture Handler** - Touch handling

### Backend
- **Node.js** - Runtime environment
- **Express.js** (^4.18.2) - Web server framework
- **MongoDB** (^6.3.0) - NoSQL database for product storage
- **MongoDB Atlas** - Cloud-hosted database (production)
- **Puppeteer** (^24.34.0) - Web scraping library
- **Cheerio** (^1.0.0-rc.12) - HTML parsing

### AI/ML
- **Google Gemini API** (@google/generative-ai ^0.2.1) - AI-powered search and recommendations
- **Gemini 2.5 Flash** model - Fast response times with large context window

### Development Tools
- **ESLint** - Code linting
- **dotenv** (^16.3.1) - Environment variable management
- **CORS** (^2.8.5) - Cross-origin resource sharing

## 🏗️ Architecture

```
┌─────────────────┐
│  React Native   │
│   Mobile App    │
│  (Expo/RN)      │
└────────┬────────┘
         │ HTTP/REST API
         ↓
┌─────────────────┐
│  Express Server │
│   (Node.js)     │
└─────┬─────┬─────┘
      │     │
      ↓     ↓
┌─────────┐ ┌──────────────┐
│ MongoDB │ │ Gemini API   │
│  Atlas  │ │ (Google AI)  │
└─────────┘ └──────────────┘
      ↑
      │
┌─────────────┐
│   Puppeteer │
│   Scraper   │
│   (Zara)    │
└─────────────┘
```

## 📦 Project Structure

```
my-app/
├── app/                    # React Native app (Expo Router)
│   ├── _layout.js         # Root layout
│   └── index.js           # Main screen component
├── assets/
│   └── images/            # Local product images (mapped by MongoDB ID)
├── server/                # Backend server
│   ├── server.js          # Express server & API routes
│   ├── routes/
│   │   └── products.js    # Product API endpoints
│   ├── scraper/           # Web scraping modules
│   │   ├── zaraScraper.js # Zara-specific scraper
│   │   └── compositionParser.js # Material composition parser
│   ├── services/
│   │   └── geminiService.js # Gemini API integration
│   ├── db/                # Database layer
│   │   ├── mongoClient.js # MongoDB connection
│   │   └── repositories.js # Data access layer
│   ├── scrape-curated-urls.js # Script to scrape curated URLs
│   └── run-scraper.js     # General scraper runner
├── config/                # Configuration files
│   ├── scraping-config.json
│   └── settings.yaml
├── .env                   # Environment variables (not in git)
└── package.json           # Dependencies & scripts
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- MongoDB Atlas account (or local MongoDB)
- Google Gemini API key
- Expo CLI (installed globally via `npm install -g expo-cli`)

### Installation

1. **Clone the repository** (if applicable)
   ```bash
   cd my-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:
   ```env
   # MongoDB Configuration
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/cotton_finder?retryWrites=true&w=majority
   MONGO_DB=cotton_finder
   MONGO_COLLECTION_ARITZIA=aritzia_products

   # Gemini API
   GEMINI_API_KEY=your_gemini_api_key_here

   # Server
   PORT=3000
   ```

   **Getting your MongoDB Atlas URI:**
   - Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a database user and get your connection string
   - Replace `username`, `password`, and `cluster` in the URI

   **Getting your Gemini API Key:**
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy and paste it into `.env`

4. **Start the backend server**
   ```bash
   npm run server
   ```
   The server should start on `http://localhost:3000`

5. **Populate the database** (optional, if you want to scrape products)

   To scrape curated Zara URLs:
   ```bash
   npm run scrape:curated
   ```

   This will:
   - Scrape product information from predefined Zara URLs
   - Extract material composition (cotton percentage)
   - Normalize categories (tops, pants, skirts, dresses)
   - Save products to MongoDB

6. **Start the mobile app**

   In a new terminal:
   ```bash
   npm start
   # or
   npx expo start
   ```

   Then:
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app on physical device

## 📡 API Endpoints

### Product Search
```
GET /api/products/search?q=cotton&category=tops&minCotton=90&limit=20
```
- **q**: Search query (searches in name, category, materials)
- **category**: Filter by category (tops, pants, skirts, dresses)
- **minCotton**: Minimum cotton percentage (default: 90)
- **limit**: Maximum results (default: 50)

### Get All Categories
```
GET /api/products/categories
```
Returns all distinct product categories.

### Get Single Product
```
GET /api/products/:id
```
Retrieves a single product by MongoDB `_id` or URL.

### Gemini Query (AI Recommendations)
```
POST /api/gemini
Content-Type: application/json

{
  "query": "What cotton t-shirts do you have under $50?"
}
```
Returns AI-generated response with product recommendations.

### Gemini-Enhanced Search
```
GET /api/gemini/search?query=cotton%20dress
```
Natural language search with AI-enhanced results and explanations.

## 🔍 How MongoDB is Used

MongoDB serves as the primary data store for all product information:

1. **Product Storage**: All scraped Zara products are stored in the `aritzia_products` collection
2. **Data Structure**: Each product document contains:
   - Basic info (name, price, URL, category)
   - Material composition (raw and parsed)
   - Cotton percentage (0-100)
   - Images (array of URLs)
   - Metadata (brand, sizes, colors, timestamps)

3. **Querying**: The app queries MongoDB for:
   - Filtered searches by category, price, cotton percentage
   - Text search across product names and descriptions
   - Category normalization and grouping

4. **Upsert Operations**: Products are updated or inserted based on URL (prevents duplicates)

## 🤖 How Gemini AI is Used

Google Gemini API enhances the app with intelligent features:

1. **Natural Language Queries**: Users can ask questions in plain English
   - Example: "Show me affordable cotton tops"
   - Gemini interprets the query and searches MongoDB

2. **Context-Aware Responses**: Gemini receives product data from MongoDB as context
   - Builds a prompt with relevant products
   - Generates personalized recommendations
   - Includes product URLs, prices, and cotton percentages

3. **Enhanced Search**: Provides explanations for search results
   - Explains why products match the query
   - Suggests alternative search terms
   - Offers additional information about cotton content

4. **Workflow**:
   ```
   User Query → Express API → Gemini Service
                                    ↓
                            Fetch products from MongoDB
                                    ↓
                            Build context with product data
                                    ↓
                            Send to Gemini with prompt
                                    ↓
                            Return AI response + products
   ```

## 🖼️ Local Image Assets

The app uses local image assets for fast loading and offline support:

- Product images are stored in `assets/images/` with MongoDB `_id` as filename (e.g., `6962f5712d7956c2f41afbd3.png`)
- Images are mapped in `app/index.js` using a `localProductImages` object
- The `getProductImageSource()` function checks for local images first, then falls back to remote URLs
- To add new images: Add the PNG file with the product's MongoDB `_id` as the filename

## 📝 Available Scripts

- `npm start` - Start Expo development server
- `npm run server` - Start Express backend server
- `npm run scrape:curated` - Scrape curated Zara URLs and save to MongoDB
- `npm run scrape` - Run general scraper
- `npm run lint` - Run ESLint

## 🔧 Configuration

### Category Normalization

The app automatically normalizes category names:
- **Tops**: t-shirt, tshirt, tee, blouse, shirt, shirts, top, tops
- **Pants**: pant, pants, jeans, jean, trousers, trouser
- **Skirts**: skirt, skirts
- **Dresses**: dress, dresses

### Cotton Percentage Filtering

- Default minimum: 90% cotton
- Products with 0% cotton are included if they're in curated categories (handles scraper extraction issues)
- Filter can be adjusted via API query parameter `minCotton`

## 🐛 Troubleshooting

### Server Connection Issues

If the mobile app can't connect to the backend:

1. **iOS Simulator**: Use `http://localhost:3000`
2. **Android Emulator**: Use `http://10.0.2.2:3000`
3. **Physical Device**: Update `LOCAL_IP` in `app/index.js` to your computer's local IP address

### MongoDB Connection

- Ensure your MongoDB Atlas cluster is running
- Check that your IP is whitelisted in MongoDB Atlas network access
- Verify credentials in `.env` file

### Gemini API Errors

- Verify your API key is correct in `.env`
- Check your API quota/limits
- Ensure the Gemini API is enabled in your Google Cloud project

## 📄 License

[Add your license here]

## 👥 Contributors

[Add contributors here]

---

**Note**: This app is designed for educational/demonstration purposes. Ensure compliance with Zara's terms of service and robots.txt when scraping.
