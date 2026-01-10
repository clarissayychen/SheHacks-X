const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { searchAritzia } = require('./scraper');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Cotton Finder API is running' });
});

// Search endpoint
app.get('/api/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    console.log(`Searching for: ${query}`);
    const results = await searchAritzia(query);
    
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});