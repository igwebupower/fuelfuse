import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { FuelType } from '@fuelfuse/shared';

export default function SearchScreen() {
  const router = useRouter();
  
  // Form state
  const [postcode, setPostcode] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(5);
  const [fuelType, setFuelType] = useState<FuelType>('petrol');
  const [useLocation, setUseLocation] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Radius options
  const radiusOptions = [1, 2, 5, 10, 15, 20, 25];

  const handleLocationRequest = async () => {
    setLocationLoading(true);
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to use your current location for searching.'
        );
        setLocationLoading(false);
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setCurrentLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
      setUseLocation(true);
      setPostcode(''); // Clear postcode when using location
      
      Alert.alert('Success', 'Location acquired successfully!');
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get your location. Please try again.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSearch = () => {
    // Validate inputs
    if (!useLocation && !postcode.trim()) {
      Alert.alert('Validation Error', 'Please enter a postcode or use your current location.');
      return;
    }

    if (useLocation && !currentLocation) {
      Alert.alert('Validation Error', 'Please acquire your location first.');
      return;
    }

    // Navigate to results screen with search parameters
    const params: any = {
      radiusMiles: radiusMiles.toString(),
      fuelType,
    };

    if (useLocation && currentLocation) {
      params.lat = currentLocation.lat.toString();
      params.lng = currentLocation.lng.toString();
    } else {
      params.postcode = postcode.trim();
    }

    router.push({
      pathname: '/(app)/results',
      params,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Find Cheap Fuel</Text>
      <Text style={styles.subtitle}>Search for the best fuel prices near you</Text>

      {/* Location Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        
        <TouchableOpacity
          style={[styles.locationButton, useLocation && styles.locationButtonActive]}
          onPress={handleLocationRequest}
          disabled={locationLoading}
        >
          {locationLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.locationButtonText}>
                {currentLocation ? '📍 Location Acquired' : '📍 Use My Location'}
              </Text>
              {currentLocation && (
                <Text style={styles.locationCoords}>
                  {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                </Text>
              )}
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.orText}>OR</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter UK Postcode (e.g., SW1A 1AA)"
          value={postcode}
          onChangeText={(text) => {
            setPostcode(text);
            if (text.trim()) {
              setUseLocation(false);
              setCurrentLocation(null);
            }
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!useLocation}
        />
      </View>

      {/* Radius Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Search Radius</Text>
        <View style={styles.radiusContainer}>
          {radiusOptions.map((radius) => (
            <TouchableOpacity
              key={radius}
              style={[
                styles.radiusOption,
                radiusMiles === radius && styles.radiusOptionActive,
              ]}
              onPress={() => setRadiusMiles(radius)}
            >
              <Text
                style={[
                  styles.radiusOptionText,
                  radiusMiles === radius && styles.radiusOptionTextActive,
                ]}
              >
                {radius} mi
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Fuel Type Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fuel Type</Text>
        <View style={styles.fuelTypeContainer}>
          <TouchableOpacity
            style={[
              styles.fuelTypeOption,
              fuelType === 'petrol' && styles.fuelTypeOptionActive,
            ]}
            onPress={() => setFuelType('petrol')}
          >
            <Text
              style={[
                styles.fuelTypeOptionText,
                fuelType === 'petrol' && styles.fuelTypeOptionTextActive,
              ]}
            >
              ⛽ Petrol
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.fuelTypeOption,
              fuelType === 'diesel' && styles.fuelTypeOptionActive,
            ]}
            onPress={() => setFuelType('diesel')}
          >
            <Text
              style={[
                styles.fuelTypeOptionText,
                fuelType === 'diesel' && styles.fuelTypeOptionTextActive,
              ]}
            >
              🚗 Diesel
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Button */}
      <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
        <Text style={styles.searchButtonText}>Search</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  locationButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  locationButtonActive: {
    backgroundColor: '#34C759',
  },
  locationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  locationCoords: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    opacity: 0.9,
  },
  orText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginVertical: 12,
  },
  input: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  radiusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  radiusOption: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#ddd',
    minWidth: 70,
    alignItems: 'center',
  },
  radiusOptionActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  radiusOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  radiusOptionTextActive: {
    color: '#fff',
  },
  fuelTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  fuelTypeOption: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  fuelTypeOptionActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  fuelTypeOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  fuelTypeOptionTextActive: {
    color: '#fff',
  },
  searchButton: {
    backgroundColor: '#FF3B30',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
