import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Linking,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import axios from 'axios';

// Import local product images - map product IDs to local assets
const localProductImages = {
  '6962f5712d7956c2f41afbd3': require('../assets/images/6962f5712d7956c2f41afbd3.png'),
  '6962f5712d7956c2f41afbd4': require('../assets/images/6962f5712d7956c2f41afbd4.png'),
  '6962f5712d7956c2f41afbd5': require('../assets/images/6962f5712d7956c2f41afbd5.png'),
  '6962f5712d7956c2f41afbd6': require('../assets/images/6962f5712d7956c2f41afbd6.png'),
  '6962f5712d7956c2f41afbd7': require('../assets/images/6962f5712d7956c2f41afbd7.png'),
  '6962f5712d7956c2f41afbd8': require('../assets/images/6962f5712d7956c2f41afbd8.png'),
  '6962f5712d7956c2f41afbd9': require('../assets/images/6962f5712d7956c2f41afbd9.png'),
  '6962f5712d7956c2f41afbda': require('../assets/images/6962f5712d7956c2f41afbda.png'),
  '6962f5712d7956c2f41afbdb': require('../assets/images/6962f5712d7956c2f41afbdb.png'),
  '6962f5722d7956c2f41afbdc': require('../assets/images/6962f5722d7956c2f41afbdc.png'),
  '6962f5722d7956c2f41afbdd': require('../assets/images/6962f5722d7956c2f41afbdd.png'),
  '6962f5722d7956c2f41afbde': require('../assets/images/6962f5722d7956c2f41afbde.png'),
  '6962f5722d7956c2f41afbe0': require('../assets/images/6962f5722d7956c2f41afbe0.png'),
  '6962f5722d7956c2f41afbe1': require('../assets/images/6962f5722d7956c2f41afbe1.png'),
  '6962f5722d7956c2f41afbe2': require('../assets/images/6962f5722d7956c2f41afbe2.png'),
  '6962f5722d7956c2f41afbe3': require('../assets/images/6962f5722d7956c2f41afbe3.png'),
  '6962f5732d7956c2f41afbe4': require('../assets/images/6962f5732d7956c2f41afbe4.png'),
  '6962f5732d7956c2f41afbe5': require('../assets/images/6962f5732d7956c2f41afbe5.png'),
  '6962f5732d7956c2f41afbe6': require('../assets/images/6962f5732d7956c2f41afbe6.png'),
  '6962f5732d7956c2f41afbe7': require('../assets/images/6962f5732d7956c2f41afbe7.png'),
  '6962f5732d7956c2f41afbe8': require('../assets/images/6962f5732d7956c2f41afbe8.png'),
  '6962f5732d7956c2f41afbe9': require('../assets/images/6962f5732d7956c2f41afbe9.png'),
  '6962f5732d7956c2f41afbea': require('../assets/images/6962f5732d7956c2f41afbea.png'),
  '6962f5732d7956c2f41afbeb': require('../assets/images/6962f5732d7956c2f41afbeb.png'),
  '6962f5732d7956c2f41afbec': require('../assets/images/6962f5732d7956c2f41afbec.png'),
  '6962f5742d7956c2f41afbed': require('../assets/images/6962f5742d7956c2f41afbed.png'),
  '6962f5742d7956c2f41afbee': require('../assets/images/6962f5742d7956c2f41afbee.png'),
  '6962f5742d7956c2f41afbef': require('../assets/images/6962f5742d7956c2f41afbef.png'),
  '6962f5742d7956c2f41afbf0': require('../assets/images/6962f5742d7956c2f41afbf0.png'),
  '6962f5742d7956c2f41afbf1': require('../assets/images/6962f5742d7956c2f41afbf1.png'),
  '6962f5742d7956c2f41afbf2': require('../assets/images/6962f5742d7956c2f41afbf2.png'),
  '6962f5742d7956c2f41afbf3': require('../assets/images/6962f5742d7956c2f41afbf3.png'),
  '6962f5752d7956c2f41afbf4': require('../assets/images/6962f5752d7956c2f41afbf4.png'),
  '6962f5752d7956c2f41afbf5': require('../assets/images/6962f5752d7956c2f41afbf5.png'),
};

/**
 * Get image source for a product
 * Returns local asset if available, otherwise returns remote URL
 */
const getProductImageSource = (product) => {
  // Get product ID (try _id first, then id, then generate from URL)
  const productId = product._id?.toString() || product.id?.toString() || 
    (product.url ? product.url.split('/').pop()?.split('.')[0] : null);
  
  // Check if we have a local image for this product ID
  if (productId && localProductImages[productId]) {
    return localProductImages[productId];
  }
  
  // Fallback to remote image
  const remoteImage = product.image || (product.images && product.images[0]) || 
    'https://via.placeholder.com/400';
  
  return { uri: remoteImage };
};

// Determine API URL based on platform
// For iOS Simulator: use localhost
// For physical devices: use your computer's local IP address
// To find your IP: run `ipconfig getifaddr en0` (macOS) or check your network settings

// Change this to your computer's local IP if testing on a physical device
// Your current IP appears to be: 172.30.47.99
const LOCAL_IP = '172.30.47.99'; // Update this if your IP changes

const getApiUrl = () => {
  // Check if we're in development mode (Expo)
  const isDev = __DEV__;
  
  // For iOS simulator, localhost works
  if (Platform.OS === 'ios' && isDev) {
    // Try localhost first (works for simulator)
    // If testing on physical iOS device, comment out the return below and use the IP
    return 'http://localhost:3000/api';
    // For physical iOS device, uncomment this:
    // return `http://${LOCAL_IP}:3000/api`;
  }
  
  // For Android emulator, use 10.0.2.2 (special IP for host machine)
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api';
  }
  
  // Fallback to localhost
  return 'http://localhost:3000/api';
};

const API_URL = getApiUrl();

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'tops', label: 'Tops' },
    { id: 'pants', label: 'Pants/Jeans' },
    { id: 'skirts', label: 'Skirts' },
    { id: 'dresses', label: 'Dresses' },
  ];

  const searchProducts = async () => {
    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const params = {
        cottonOnly: 'false', // Filter for 90%+ cotton (default)
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
      };
      
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const response = await axios.get(`${API_URL}/curated`, { params });

      setResults(response.data.results || []);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search products. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load products on category change
  useEffect(() => {
    if (selectedCategory !== 'all') {
      searchProducts();
    }
  }, [selectedCategory]);

  const resetToHome = () => {
    setSearchQuery('');
    setResults([]);
    setSearched(false);
    setError('');
  };

  const openProduct = (url) => {
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        {searched ? (
          <>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={resetToHome}
              activeOpacity={0.7}
            >
              <Text style={styles.backButtonIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.logo}>🌿 NoPoly</Text>
            <View style={styles.headerSpacer} />
          </>
        ) : (
          <>
            <Text style={styles.logo}>🌿 NoPoly</Text>
            <View style={styles.headerSpacer} />
          </>
        )}
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <Text style={styles.title}>Find Your Perfect</Text>
          <Text style={styles.titleAccent}>Cotton Essentials</Text>
        </View>

        {/* Category Filters */}
        <View style={styles.categoryContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryButton,
                  selectedCategory === cat.id && styles.categoryButtonActive
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Text style={[
                  styles.categoryButtonText,
                  selectedCategory === cat.id && styles.categoryButtonTextActive
                ]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search curated cotton items..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={searchProducts}
            returnKeyType="search"
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={searchProducts}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.searchButtonText}>🔍</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={styles.loadingText}>Searching for pure cotton items...</Text>
          </View>
        )}

        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Results Count */}
        {!loading && (searched || selectedCategory !== 'all') && results.length > 0 && (
          <View style={styles.resultsCount}>
            <Text style={styles.resultsCountText}>
              Found <Text style={styles.resultsCountBold}>{results.length}</Text> {selectedCategory !== 'all' ? categories.find(c => c.id === selectedCategory)?.label.toLowerCase() + ' ' : ''}90%+ cotton {results.length === 1 ? 'item' : 'items'}
            </Text>
          </View>
        )}

        {/* Results Grid */}
        {!loading && (searched || selectedCategory !== 'all') && results.length > 0 && (
          <View style={styles.resultsGrid}>
            {results.map((item, index) => (
              <View key={item._id || item.id || index} style={styles.productCard}>
                <View style={styles.imageContainer}>
                  <Image
                    source={getProductImageSource(item)}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                  <View style={styles.cottonBadge}>
                    <Text style={styles.cottonBadgeText}>
                      🌿 {item.cottonPercentage || 100}% Cotton
                    </Text>
                  </View>
                </View>

                <View style={styles.productInfo}>
                  <View style={styles.productHeader}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.productPrice}>${item.price || 'N/A'}</Text>
                  </View>

                  <Text style={styles.productDetails}>
                    {item.brand || 'Zara'} · {item.color || 'Various'}
                  </Text>
                  
                  <Text style={styles.productMaterials} numberOfLines={2}>
                    {item.composition_raw || item.materials || 'Material information not available'}
                  </Text>

                  <TouchableOpacity
                    style={styles.shopButton}
                    onPress={() => openProduct(item.url)}
                  >
                    <Text style={styles.shopButtonText}>🛍️ View on Zara</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* No Results */}
        {!loading && (searched || selectedCategory !== 'all') && results.length === 0 && (
          <View style={styles.noResults}>
            <Text style={styles.noResultsEmoji}>🛍️</Text>
            <Text style={styles.noResultsTitle}>No 90%+ cotton items found</Text>
            <Text style={styles.noResultsText}>
              {selectedCategory !== 'all' 
                ? `No 90%+ cotton ${categories.find(c => c.id === selectedCategory)?.label.toLowerCase()} found. Try a different category or search term.`
                : 'Try a different search term or check back later for new arrivals.'
              }
            </Text>
          </View>
        )}

        {/* Features (Initial State) */}
        {!searched && !loading && selectedCategory === 'all' && results.length === 0 && (
          <View style={styles.features}>
            <View style={styles.featureCard}>
              <Text style={styles.featureEmoji}>🌿</Text>
              <Text style={styles.featureTitle}>90%+ Pure Cotton</Text>
              <Text style={styles.featureText}>
                Curated collection of 90%+ cotton items
              </Text>
            </View>

            <View style={styles.featureCard}>
              <Text style={styles.featureEmoji}>🔍</Text>
              <Text style={styles.featureTitle}>Smart Search</Text>
              <Text style={styles.featureText}>
                Find exactly what you're looking for quickly
              </Text>
            </View>

            <View style={styles.featureCard}>
              <Text style={styles.featureEmoji}>🛍️</Text>
              <Text style={styles.featureTitle}>Direct Links</Text>
              <Text style={styles.featureText}>
                Shop directly from Zara with one click
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonIcon: {
    fontSize: 24,
    color: '#7C3AED',
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    fontFamily: 'CormorantGaramond-Bold',
    flex: 1,
    textAlign: 'center',
  },
  logoWithBack: {
    marginLeft: 40, // Add margin when back button is present
  },
  headerSpacer: {
    width: 40, // Spacer for symmetry (same width as back button)
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    fontFamily: 'CormorantGaramond-Bold',
  },
  titleAccent: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#7C3AED',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'CormorantGaramond-Bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    fontFamily: 'Inter-Regular',
  },
  categoryContainer: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  categoryScroll: {
    paddingRight: 20,
  },
  categoryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryButtonActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  categoryButtonTextActive: {
    color: '#7C3AED',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 30,
    fontSize: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    color: '#111827',
    fontFamily: 'Inter-Regular',
  },
  searchButton: {
    backgroundColor: '#7C3AED',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  searchButtonText: {
    fontSize: 20,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#6B7280',
    fontSize: 16,
  },
  errorContainer: {
    marginHorizontal: 20,
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 14,
  },
  resultsCount: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  resultsCountText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  resultsCountBold: {
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  resultsGrid: {
    paddingHorizontal: 20,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    position: 'relative',
    height: 300,
    backgroundColor: '#F3F4F6',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  cottonBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  cottonBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  productInfo: {
    padding: 16,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginRight: 12,
    fontFamily: 'CormorantGaramond-SemiBold',
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7C3AED',
    fontFamily: 'CormorantGaramond-Bold',
  },
  productDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
    fontFamily: 'Inter-Regular',
  },
  productMaterials: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
    fontFamily: 'Inter-Light',
  },
  shopButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noResults: {
    paddingVertical: 48,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  noResultsEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  noResultsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  features: {
    paddingHorizontal: 20,
    marginTop: 32,
  },
  featureCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  featureEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'CormorantGaramond-SemiBold',
  },
  featureText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
  },
});
