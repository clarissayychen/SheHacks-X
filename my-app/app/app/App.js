import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';

// Update this to your computer's local IP when testing on physical device
// Example: const API_URL = 'http://192.168.1.100:3000/api';
const API_URL = 'http://localhost:3000/api';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const searchProducts = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const response = await axios.get(`${API_URL}/search`, {
        params: { query: searchQuery }
      });

      setResults(response.data.results || []);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search products. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openProduct = (url) => {
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>🌿 PureCotton</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>90-100% Cotton Only</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <Text style={styles.title}>Find Your Perfect</Text>
          <Text style={styles.titleAccent}>Cotton Essentials</Text>
          <Text style={styles.subtitle}>
            Search Aritzia's collection for high-quality cotton clothing.
            We filter for 90%+ cotton content.
          </Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for cotton essentials..."
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
        {!loading && searched && results.length > 0 && (
          <View style={styles.resultsCount}>
            <Text style={styles.resultsCountText}>
              Found <Text style={styles.resultsCountBold}>{results.length}</Text> high-quality cotton items
            </Text>
          </View>
        )}

        {/* Results Grid */}
        {!loading && searched && results.length > 0 && (
          <View style={styles.resultsGrid}>
            {results.map((item) => (
              <View key={item.id} style={styles.productCard}>
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: item.image }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                  <View style={styles.cottonBadge}>
                    <Text style={styles.cottonBadgeText}>
                      🌿 {item.cottonPercentage}% Cotton
                    </Text>
                  </View>
                </View>

                <View style={styles.productInfo}>
                  <View style={styles.productHeader}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.productPrice}>${item.price}</Text>
                  </View>

                  <Text style={styles.productDetails}>
                    {item.brand} · {item.color}
                  </Text>
                  
                  <Text style={styles.productMaterials} numberOfLines={1}>
                    {item.materials}
                  </Text>

                  <TouchableOpacity
                    style={styles.shopButton}
                    onPress={() => openProduct(item.url)}
                  >
                    <Text style={styles.shopButtonText}>🛍️ View on Aritzia</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* No Results */}
        {!loading && searched && results.length === 0 && (
          <View style={styles.noResults}>
            <Text style={styles.noResultsEmoji}>🛍️</Text>
            <Text style={styles.noResultsTitle}>No items found</Text>
            <Text style={styles.noResultsText}>
              Try a different search term or check back later for new arrivals.
            </Text>
          </View>
        )}

        {/* Features (Initial State) */}
        {!searched && !loading && (
          <View style={styles.features}>
            <View style={styles.featureCard}>
              <Text style={styles.featureEmoji}>🌿</Text>
              <Text style={styles.featureTitle}>Pure Cotton Only</Text>
              <Text style={styles.featureText}>
                Automatically filters for 90-100% cotton content
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
                Shop directly from Aritzia with one click
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
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  badge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: '#7C3AED',
    fontSize: 12,
    fontWeight: '600',
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
  },
  titleAccent: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#7C3AED',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
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
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  productDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  productMaterials: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
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
  },
  featureText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});