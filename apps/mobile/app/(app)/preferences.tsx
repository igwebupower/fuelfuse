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
import { useAuth } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { FuelType, UserPreferences, SubscriptionInfo } from '@fuelfuse/shared';
import { apiClient, setAuthToken } from '../../lib/api';

export default function PreferencesScreen() {
  const { getToken } = useAuth();
  
  // Form state
  const [homePostcode, setHomePostcode] = useState('');
  const [defaultRadius, setDefaultRadius] = useState(5);
  const [defaultFuelType, setDefaultFuelType] = useState<FuelType>('petrol');
  
  // Subscription state
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [upgradingToPro, setUpgradingToPro] = useState(false);

  // Radius options
  const radiusOptions = [1, 2, 5, 10, 15, 20, 25];

  // Load preferences and subscription status on mount
  useEffect(() => {
    loadPreferences();
    loadSubscriptionStatus();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      
      // Get auth token
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      // Fetch preferences
      const response = await apiClient.get('/api/preferences');
      
      if (response.data.preferences) {
        const prefs = response.data.preferences;
        setHomePostcode(prefs.homePostcode || '');
        setDefaultRadius(prefs.defaultRadius || 5);
        setDefaultFuelType(prefs.defaultFuelType || 'petrol');
      }
    } catch (error: any) {
      console.error('Load preferences error:', error);
      
      // Don't show error for 404 or null preferences (first time user)
      if (error.response?.status !== 404) {
        Alert.alert('Error', 'Failed to load preferences. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSubscriptionStatus = async () => {
    try {
      setSubscriptionLoading(true);
      
      // Get auth token
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      // Fetch subscription status
      const response = await apiClient.get('/api/billing/status');
      
      if (response.data) {
        setSubscriptionInfo({
          tier: response.data.tier,
          status: response.data.status,
          periodEnd: response.data.periodEnd ? new Date(response.data.periodEnd) : undefined,
        });
      }
    } catch (error: any) {
      console.error('Load subscription status error:', error);
      
      // Set default to free tier on error
      setSubscriptionInfo({ tier: 'free' });
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Get auth token
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      // Prepare preferences data
      const preferences: UserPreferences = {
        homePostcode: homePostcode.trim() || null,
        defaultRadius,
        defaultFuelType,
      };

      // Save preferences
      const response = await apiClient.put('/api/preferences', preferences);
      
      if (response.status === 200) {
        setHasChanges(false);
        Alert.alert('Success', 'Preferences saved successfully!');
      }
    } catch (error: any) {
      console.error('Save preferences error:', error);
      
      if (error.response?.status === 400) {
        Alert.alert(
          'Validation Error',
          error.response.data.error || 'Invalid preferences data. Please check your inputs.'
        );
      } else {
        Alert.alert('Error', 'Failed to save preferences. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = () => {
    setHasChanges(true);
  };

  const handleUpgradeToPro = async () => {
    try {
      setUpgradingToPro(true);

      // Get auth token
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      // Create checkout session
      // Note: In a real app, you'd want to use deep linking for success/cancel URLs
      // For now, we'll use placeholder URLs that the web app can handle
      const response = await apiClient.post('/api/billing/create-checkout-session', {
        successUrl: 'https://fuelfuse.app/checkout/success',
        cancelUrl: 'https://fuelfuse.app/checkout/cancel',
      });

      if (response.data && response.data.url) {
        // Open Stripe checkout in in-app browser
        const result = await WebBrowser.openBrowserAsync(response.data.url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
          controlsColor: '#007AFF',
        });

        // Handle the result when user returns from checkout
        if (result.type === 'cancel') {
          Alert.alert('Checkout Cancelled', 'You can upgrade to Pro anytime from this screen.');
        } else if (result.type === 'dismiss') {
          // User dismissed the browser - refresh subscription status
          // They may have completed the checkout
          Alert.alert(
            'Checking Status',
            'Please wait while we verify your subscription...',
            [{ text: 'OK', onPress: () => loadSubscriptionStatus() }]
          );
        }
      } else {
        Alert.alert('Error', 'Failed to create checkout session. Please try again.');
      }
    } catch (error: any) {
      console.error('Upgrade to Pro error:', error);

      if (error.response?.status === 400) {
        const errorMessage = error.response.data.error || 'Unable to create checkout session.';
        
        if (errorMessage.includes('already subscribed')) {
          Alert.alert(
            'Already Subscribed',
            'You are already subscribed to Pro tier. Refreshing your subscription status...',
            [{ text: 'OK', onPress: () => loadSubscriptionStatus() }]
          );
        } else {
          Alert.alert('Error', errorMessage);
        }
      } else if (error.response?.status === 401) {
        Alert.alert('Authentication Error', 'Please sign in again to upgrade.');
      } else {
        Alert.alert('Error', 'Failed to start checkout. Please try again.');
      }
    } finally {
      setUpgradingToPro(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading preferences...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Preferences</Text>
      <Text style={styles.subtitle}>Set your default search preferences</Text>

      {/* Subscription Status Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>
        {subscriptionLoading ? (
          <View style={styles.subscriptionCard}>
            <ActivityIndicator size="small" color="#007AFF" />
          </View>
        ) : (
          <View style={styles.subscriptionCard}>
            <View style={styles.subscriptionHeader}>
              <Text style={styles.subscriptionTier}>
                {subscriptionInfo?.tier === 'pro' ? '⭐ Pro Tier' : '🆓 Free Tier'}
              </Text>
              {subscriptionInfo?.tier === 'pro' && subscriptionInfo.status && (
                <View style={[
                  styles.statusBadge,
                  subscriptionInfo.status === 'active' && styles.statusBadgeActive,
                  subscriptionInfo.status === 'trialing' && styles.statusBadgeTrialing,
                ]}>
                  <Text style={styles.statusBadgeText}>
                    {subscriptionInfo.status.charAt(0).toUpperCase() + subscriptionInfo.status.slice(1)}
                  </Text>
                </View>
              )}
            </View>
            
            {subscriptionInfo?.tier === 'pro' ? (
              <View>
                <Text style={styles.subscriptionDescription}>
                  You have access to all premium features including:
                </Text>
                <Text style={styles.subscriptionFeature}>• Unlimited price alerts</Text>
                <Text style={styles.subscriptionFeature}>• Extended search radius (up to 25 miles)</Text>
                <Text style={styles.subscriptionFeature}>• Priority support</Text>
                {subscriptionInfo.periodEnd && (
                  <Text style={styles.subscriptionPeriod}>
                    Renews on {new Date(subscriptionInfo.periodEnd).toLocaleDateString()}
                  </Text>
                )}
              </View>
            ) : (
              <View>
                <Text style={styles.subscriptionDescription}>
                  Upgrade to Pro to unlock premium features:
                </Text>
                <Text style={styles.subscriptionFeature}>• Unlimited price alerts</Text>
                <Text style={styles.subscriptionFeature}>• Extended search radius (up to 25 miles)</Text>
                <Text style={styles.subscriptionFeature}>• Priority support</Text>
                
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={() => {
                    Alert.alert(
                      'Upgrade to Pro',
                      'This will open the Stripe checkout page.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { 
                          text: 'Continue', 
                          onPress: handleUpgradeToPro
                        },
                      ]
                    );
                  }}
                  disabled={upgradingToPro}
                >
                  {upgradingToPro ? (
                    <ActivityIndicator color="#333" />
                  ) : (
                    <Text style={styles.upgradeButtonText}>⭐ Upgrade to Pro</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Home Postcode Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Home Postcode</Text>
        <Text style={styles.sectionDescription}>
          Your default location for fuel searches
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Enter UK Postcode (e.g., SW1A 1AA)"
          value={homePostcode}
          onChangeText={(text) => {
            setHomePostcode(text);
            handleInputChange();
          }}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </View>

      {/* Default Radius Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Default Search Radius</Text>
        <Text style={styles.sectionDescription}>
          How far to search from your location
        </Text>
        <View style={styles.radiusContainer}>
          {radiusOptions.map((radius) => (
            <TouchableOpacity
              key={radius}
              style={[
                styles.radiusOption,
                defaultRadius === radius && styles.radiusOptionActive,
              ]}
              onPress={() => {
                setDefaultRadius(radius);
                handleInputChange();
              }}
            >
              <Text
                style={[
                  styles.radiusOptionText,
                  defaultRadius === radius && styles.radiusOptionTextActive,
                ]}
              >
                {radius} mi
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Default Fuel Type Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Default Fuel Type</Text>
        <Text style={styles.sectionDescription}>
          Your preferred fuel type for searches
        </Text>
        <View style={styles.fuelTypeContainer}>
          <TouchableOpacity
            style={[
              styles.fuelTypeOption,
              defaultFuelType === 'petrol' && styles.fuelTypeOptionActive,
            ]}
            onPress={() => {
              setDefaultFuelType('petrol');
              handleInputChange();
            }}
          >
            <Text
              style={[
                styles.fuelTypeOptionText,
                defaultFuelType === 'petrol' && styles.fuelTypeOptionTextActive,
              ]}
            >
              ⛽ Petrol
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.fuelTypeOption,
              defaultFuelType === 'diesel' && styles.fuelTypeOptionActive,
            ]}
            onPress={() => {
              setDefaultFuelType('diesel');
              handleInputChange();
            }}
          >
            <Text
              style={[
                styles.fuelTypeOptionText,
                defaultFuelType === 'diesel' && styles.fuelTypeOptionTextActive,
              ]}
            >
              🚗 Diesel
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[
          styles.saveButton,
          (!hasChanges || saving) && styles.saveButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={!hasChanges || saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>
            {hasChanges ? 'Save Preferences' : 'No Changes'}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.helpText}>
        These preferences will be used as defaults when you search for fuel.
        You can always change them during a search.
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
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
  saveButton: {
    backgroundColor: '#34C759',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  helpText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 20,
  },
  subscriptionCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subscriptionTier: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  statusBadgeActive: {
    backgroundColor: '#34C759',
  },
  statusBadgeTrialing: {
    backgroundColor: '#007AFF',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  subscriptionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  subscriptionFeature: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
    lineHeight: 20,
  },
  subscriptionPeriod: {
    fontSize: 13,
    color: '#999',
    marginTop: 12,
    fontStyle: 'italic',
  },
  upgradeButton: {
    backgroundColor: '#FFD700',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
});
