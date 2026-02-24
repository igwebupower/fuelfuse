import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiClient } from '../../lib/api';
import { StationDetail } from '@fuelfuse/shared';

export default function StationDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { stationId } = params;

  const [station, setStation] = useState<StationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stationId) {
      fetchStationDetail();
    }
  }, [stationId]);

  const fetchStationDetail = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(`/api/stations/${stationId}`);
      setStation(response.data);
    } catch (err: any) {
      console.error('Station detail error:', err);
      const errorMessage = err.response?.data?.error || 'Failed to load station details. Please try again.';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (pricePerLitre: number | null) => {
    if (pricePerLitre === null) {
      return 'N/A';
    }
    return `${(pricePerLitre / 100).toFixed(1)}p`;
  };

  const formatLastUpdated = (lastUpdated: Date) => {
    const date = new Date(lastUpdated);
    return date.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.loadingText}>Loading station details...</Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorIcon}>⚠️</Text>
      <Text style={styles.errorTitle}>Error</Text>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={fetchStationDetail}
      >
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAmenities = () => {
    if (!station?.amenities) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amenities</Text>
          <Text style={styles.unavailableText}>No amenity information available</Text>
        </View>
      );
    }

    const amenitiesObj = station.amenities as Record<string, any>;
    const amenityEntries = Object.entries(amenitiesObj);

    if (amenityEntries.length === 0) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amenities</Text>
          <Text style={styles.unavailableText}>No amenities listed</Text>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Amenities</Text>
        <View style={styles.amenitiesList}>
          {amenityEntries.map(([key, value]) => (
            <View key={key} style={styles.amenityItem}>
              <Text style={styles.amenityIcon}>✓</Text>
              <Text style={styles.amenityText}>
                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                {typeof value === 'boolean' ? '' : `: ${value}`}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderOpeningHours = () => {
    if (!station?.openingHours) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Opening Hours</Text>
          <Text style={styles.unavailableText}>No opening hours information available</Text>
        </View>
      );
    }

    const hoursObj = station.openingHours as Record<string, any>;
    const hoursEntries = Object.entries(hoursObj);

    if (hoursEntries.length === 0) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Opening Hours</Text>
          <Text style={styles.unavailableText}>No opening hours listed</Text>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Opening Hours</Text>
        <View style={styles.hoursList}>
          {hoursEntries.map(([day, hours]) => (
            <View key={day} style={styles.hoursItem}>
              <Text style={styles.dayText}>
                {day.charAt(0).toUpperCase() + day.slice(1)}
              </Text>
              <Text style={styles.hoursText}>
                {typeof hours === 'string' ? hours : JSON.stringify(hours)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return renderLoadingState();
  }

  if (error || !station) {
    return renderErrorState();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.stationName}>{station.name}</Text>
        <Text style={styles.stationBrand}>{station.brand}</Text>
      </View>

      {/* Address Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <View style={styles.addressContainer}>
          <Text style={styles.addressIcon}>📍</Text>
          <View style={styles.addressTextContainer}>
            <Text style={styles.addressText}>{station.address}</Text>
            <Text style={styles.postcodeText}>{station.postcode}</Text>
          </View>
        </View>
      </View>

      {/* Prices Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fuel Prices</Text>
        <View style={styles.pricesContainer}>
          <View style={styles.priceCard}>
            <Text style={styles.fuelTypeIcon}>⛽</Text>
            <Text style={styles.fuelTypeLabel}>Petrol</Text>
            <Text style={[
              styles.priceValue,
              station.petrolPrice === null && styles.priceUnavailable
            ]}>
              {formatPrice(station.petrolPrice)}
            </Text>
            <Text style={styles.priceUnit}>per litre</Text>
          </View>
          <View style={styles.priceCard}>
            <Text style={styles.fuelTypeIcon}>🚗</Text>
            <Text style={styles.fuelTypeLabel}>Diesel</Text>
            <Text style={[
              styles.priceValue,
              station.dieselPrice === null && styles.priceUnavailable
            ]}>
              {formatPrice(station.dieselPrice)}
            </Text>
            <Text style={styles.priceUnit}>per litre</Text>
          </View>
        </View>
        <Text style={styles.lastUpdatedText}>
          Last updated: {formatLastUpdated(station.lastUpdated)}
        </Text>
      </View>

      {/* Amenities Section */}
      {renderAmenities()}

      {/* Opening Hours Section */}
      {renderOpeningHours()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    paddingBottom: 32,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f5f5f5',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  errorText: {
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
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  stationName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  stationBrand: {
    fontSize: 18,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  addressTextContainer: {
    flex: 1,
  },
  addressText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
    lineHeight: 22,
  },
  postcodeText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  pricesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  priceCard: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  fuelTypeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  fuelTypeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  priceValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 4,
  },
  priceUnavailable: {
    color: '#999',
    fontSize: 20,
  },
  priceUnit: {
    fontSize: 12,
    color: '#999',
  },
  lastUpdatedText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  unavailableText: {
    fontSize: 15,
    color: '#999',
    fontStyle: 'italic',
  },
  amenitiesList: {
    gap: 12,
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amenityIcon: {
    fontSize: 16,
    color: '#34C759',
    marginRight: 12,
    fontWeight: 'bold',
  },
  amenityText: {
    fontSize: 15,
    color: '#333',
  },
  hoursList: {
    gap: 10,
  },
  hoursItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
    flex: 1,
  },
  hoursText: {
    fontSize: 15,
    color: '#666',
    flex: 2,
    textAlign: 'right',
  },
});
