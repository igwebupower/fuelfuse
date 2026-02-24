import { useState, useEffect } from 'react';
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
import { useAuth } from '@clerk/clerk-expo';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FuelType } from '@fuelfuse/shared';
import { apiClient, setAuthToken } from '../../lib/api';

export default function AlertFormScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Determine if editing or creating
  const isEditing = !!params.alertId;
  
  // Form state
  const [postcode, setPostcode] = useState(params.centerPostcode as string || '');
  const [radiusMiles, setRadiusMiles] = useState(
    params.radiusMiles ? parseInt(params.radiusMiles as string) : 5
  );
  const [fuelType, setFuelType] = useState<FuelType>(
    (params.fuelType as FuelType) || 'petrol'
  );
  const [thresholdPpl, setThresholdPpl] = useState(
    params.thresholdPpl ? parseInt(params.thresholdPpl as string) : 2
  );
  const [useLocation, setUseLocation] = useState(
    !!(params.lat && params.lng)
  );
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(
    params.lat && params.lng
      ? {
          lat: parseFloat(params.lat as string),
          lng: parseFloat(params.lng as string),
        }
      : null
  );
  
  // UI state
  const [locationLoading, setLocationLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Radius options
  const radiusOptions = [1, 2, 5, 10, 15, 20, 25];
  
  // Threshold options (in pence per litre)
  const thresholdOptions = [1, 2, 3, 5, 10];

  const handleLocationRequest = async () => {
    setLocationLoading(true);
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to use your current location for alerts.'
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

  const handleSave = async () => {
    // Validate inputs
    if (!useLocation && !postcode.trim()) {
      Alert.alert('Validation Error', 'Please enter a postcode or use your current location.');
      return;
    }

    if (useLocation && !currentLocation) {
      Alert.alert('Validation Error', 'Please acquire your location first.');
      return;
    }

    try {
      setSaving(true);

      // Get auth token
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      // Prepare alert rule data
      const alertData: any = {
        radiusMiles,
        fuelType,
        triggerType: 'price_drop',
        thresholdPpl,
        enabled: true,
      };

      if (useLocation && currentLocation) {
        alertData.lat = currentLocation.lat;
        alertData.lng = currentLocation.lng;
      } else {
        alertData.centerPostcode = postcode.trim();
      }

      // Create or update alert rule
      if (isEditing) {
        await apiClient.put(`/api/alerts/${params.alertId}`, alertData);
        Alert.alert('Success', 'Alert updated successfully!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        await apiClient.post('/api/alerts', alertData);
        Alert.alert('Success', 'Alert created successfully!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      console.error('Save alert error:', error);
      
      if (error.response?.status === 400) {
        Alert.alert(
          'Validation Error',
          error.response.data.error || 'Invalid alert data. Please check your inputs.'
        );
      } else if (error.response?.status === 403) {
        Alert.alert(
          'Pro Feature Required',
          error.response.data.error || 'Price alerts are a Pro feature. Please upgrade to Pro.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Upgrade',
              onPress: () => {
                router.back();
                router.push('/(app)/preferences');
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to save alert. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>
        {isEditing ? 'Edit Alert' : 'Create Alert'}
      </Text>
      <Text style={styles.subtitle}>
        Get notified when fuel prices drop in your area
      </Text>

      {/* Location Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <Text style={styles.sectionDescription}>
          Where should we monitor fuel prices?
        </Text>
        
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
        <Text style={styles.sectionDescription}>
          How far from the location to monitor
        </Text>
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
        <Text style={styles.sectionDescription}>
          Which fuel type to monitor
        </Text>
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

      {/* Threshold Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Price Drop Threshold</Text>
        <Text style={styles.sectionDescription}>
          Notify me when price drops by at least
        </Text>
        <View style={styles.thresholdContainer}>
          {thresholdOptions.map((threshold) => (
            <TouchableOpacity
              key={threshold}
              style={[
                styles.thresholdOption,
                thresholdPpl === threshold && styles.thresholdOptionActive,
              ]}
              onPress={() => setThresholdPpl(threshold)}
            >
              <Text
                style={[
                  styles.thresholdOptionText,
                  thresholdPpl === threshold && styles.thresholdOptionTextActive,
                ]}
              >
                {threshold}p
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>
            {isEditing ? 'Update Alert' : 'Create Alert'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Cancel Button */}
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => router.back()}
        disabled={saving}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>

      <Text style={styles.helpText}>
        Alerts are checked every hour. You'll receive up to 2 notifications per day
        to avoid spam.
      </Text>
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
    marginBottom: 6,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
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
  thresholdContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  thresholdOption: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#ddd',
    minWidth: 70,
    alignItems: 'center',
  },
  thresholdOptionActive: {
    backgroundColor: '#FF9500',
    borderColor: '#FF9500',
  },
  thresholdOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  thresholdOptionTextActive: {
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#34C759',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 20,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 20,
  },
});
