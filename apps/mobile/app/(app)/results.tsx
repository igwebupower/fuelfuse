import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiClient } from '../../lib/api';
import { StationResult } from '@fuelfuse/shared';

export default function ResultsScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  
  const [stations, setStations] = useState<StationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build query parameters
      const queryParams: any = {
        radiusMiles: params.radiusMiles,
        fuelType: params.fuelType,
      };

      if (params.postcode) {
        queryParams.postcode = params.postcode;
      } else if (params.lat && params.lng) {
        queryParams.lat = params.lat;
        queryParams.lng = params.lng;
      }

      // Call search API
      const response = await apiClient.get('/api/search/cheapest', {
        params: queryParams,
      });

      setStations(response.data.results || response.data);
    } catch (err: any) {
      console.error('Search error:', err);
      const errorMessage = err.response?.data?.error || 'Failed to fetch results. Please try again.';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (pricePerLitre: number) => {
    return `${(pricePerLitre / 100).toFixed(1)}p`;
  };

  const formatDistance = (distanceMiles: number) => {
    return `${distanceMiles.toFixed(1)} mi`;
  };

  const formatLastUpdated = (lastUpdated: Date) => {
    const date = new Date(lastUpdated);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleStationPress = (stationId: string) => {
    router.push({
      pathname: '/(app)/station-detail',
      params: { stationId },
    });
  };

  const renderStationItem = ({ item }: { item: StationResult }) => (
    <TouchableOpacity
      style={styles.stationCard}
      onPress={() => handleStationPress(item.stationId)}
      activeOpacity={0.7}
    >
      <View style={styles.stationHeader}>
        <View style={styles.stationInfo}>
          <Text style={styles.stationName}>{item.name}</Text>
          <Text style={styles.stationBrand}>{item.brand}</Text>
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.price}>{formatPrice(item.pricePerLitre)}</Text>
          <Text style={styles.priceLabel}>per litre</Text>
        </View>
      </View>
      
      <View style={styles.stationDetails}>
        <Text style={styles.address}>{item.address}</Text>
        <Text style={styles.postcode}>{item.postcode}</Text>
      </View>
      
      <View style={styles.stationFooter}>
        <View style={styles.footerItem}>
          <Text style={styles.footerIcon}>📍</Text>
          <Text style={styles.footerText}>{formatDistance(item.distanceMiles)}</Text>
        </View>
        <View style={styles.footerItem}>
          <Text style={styles.footerIcon}>🕐</Text>
          <Text style={styles.footerText}>Updated {formatLastUpdated(item.lastUpdated)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🔍</Text>
      <Text style={styles.emptyTitle}>No Results Found</Text>
      <Text style={styles.emptyText}>
        No fuel stations found within your search radius. Try increasing the radius or searching a different location.
      </Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={() => router.back()}
      >
        <Text style={styles.retryButtonText}>New Search</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.loadingText}>Searching for fuel stations...</Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>⚠️</Text>
      <Text style={styles.emptyTitle}>Error</Text>
      <Text style={styles.emptyText}>{error}</Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={fetchResults}
      >
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return renderLoadingState();
  }

  if (error && stations.length === 0) {
    return renderErrorState();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {stations.length} {stations.length === 1 ? 'Station' : 'Stations'} Found
        </Text>
        <Text style={styles.subtitle}>
          Sorted by price • {params.fuelType === 'petrol' ? '⛽ Petrol' : '🚗 Diesel'}
        </Text>
      </View>
      
      <FlatList
        data={stations}
        renderItem={renderStationItem}
        keyExtractor={(item) => item.stationId}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  listContent: {
    padding: 16,
  },
  stationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stationInfo: {
    flex: 1,
    marginRight: 12,
  },
  stationName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  stationBrand: {
    fontSize: 14,
    color: '#666',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF3B30',
  },
  priceLabel: {
    fontSize: 12,
    color: '#999',
  },
  stationDetails: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  address: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  postcode: {
    fontSize: 14,
    color: '#999',
  },
  stationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  footerText: {
    fontSize: 13,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
