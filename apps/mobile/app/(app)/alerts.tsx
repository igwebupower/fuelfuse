import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter, useFocusEffect } from 'expo-router';
import { AlertRule, SubscriptionInfo } from '@fuelfuse/shared';
import { apiClient, setAuthToken } from '../../lib/api';

export default function AlertsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  
  // State
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  // Load alerts and subscription status on mount and when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadAlerts();
      loadSubscriptionStatus();
    }, [])
  );

  const loadAlerts = async () => {
    try {
      setLoading(true);
      
      // Get auth token
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      // Fetch alert rules
      const response = await apiClient.get('/api/alerts');
      
      if (response.data.alertRules) {
        setAlertRules(response.data.alertRules);
      }
    } catch (error: any) {
      console.error('Load alerts error:', error);
      
      if (error.response?.status === 403) {
        // Pro feature - show upgrade prompt
        setAlertRules([]);
      } else if (error.response?.status !== 404) {
        Alert.alert('Error', 'Failed to load alerts. Please try again.');
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
    await loadSubscriptionStatus();
    setRefreshing(false);
  };

  const handleToggleAlert = async (alertId: string, currentEnabled: boolean) => {
    try {
      // Get auth token
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      // Update alert rule
      await apiClient.put(`/api/alerts/${alertId}`, {
        enabled: !currentEnabled,
      });

      // Update local state
      setAlertRules((prev) =>
        prev.map((rule) =>
          rule.id === alertId ? { ...rule, enabled: !currentEnabled } : rule
        )
      );
    } catch (error: any) {
      console.error('Toggle alert error:', error);
      Alert.alert('Error', 'Failed to update alert. Please try again.');
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    Alert.alert(
      'Delete Alert',
      'Are you sure you want to delete this alert?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Get auth token
              const token = await getToken();
              if (token) {
                setAuthToken(token);
              }

              // Delete alert rule
              await apiClient.delete(`/api/alerts/${alertId}`);

              // Update local state
              setAlertRules((prev) => prev.filter((rule) => rule.id !== alertId));
              
              Alert.alert('Success', 'Alert deleted successfully');
            } catch (error: any) {
              console.error('Delete alert error:', error);
              Alert.alert('Error', 'Failed to delete alert. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleCreateAlert = () => {
    if (subscriptionInfo?.tier !== 'pro') {
      // Show upgrade prompt
      Alert.alert(
        'Pro Feature',
        'Price alerts are a Pro feature. Upgrade to Pro to create unlimited alerts and get notified when fuel prices drop.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upgrade to Pro',
            onPress: () => router.push('/(app)/preferences'),
          },
        ]
      );
      return;
    }

    // Navigate to create alert screen
    router.push('/(app)/alert-form');
  };

  const handleEditAlert = (alertRule: AlertRule) => {
    // Navigate to edit alert screen with alert data
    router.push({
      pathname: '/(app)/alert-form',
      params: {
        alertId: alertRule.id,
        centerPostcode: alertRule.centerPostcode || '',
        lat: alertRule.lat?.toString() || '',
        lng: alertRule.lng?.toString() || '',
        radiusMiles: alertRule.radiusMiles.toString(),
        fuelType: alertRule.fuelType,
        thresholdPpl: alertRule.thresholdPpl.toString(),
        enabled: alertRule.enabled.toString(),
      },
    });
  };

  const formatLocation = (rule: AlertRule) => {
    if (rule.centerPostcode) {
      return rule.centerPostcode;
    }
    if (rule.lat && rule.lng) {
      return `${rule.lat.toFixed(4)}, ${rule.lng.toFixed(4)}`;
    }
    return 'Unknown';
  };

  if (loading || subscriptionLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading alerts...</Text>
      </View>
    );
  }

  // Show upgrade prompt for Free users
  if (subscriptionInfo?.tier === 'free') {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <Text style={styles.title}>Price Alerts</Text>
        <Text style={styles.subtitle}>Get notified when fuel prices drop</Text>

        <View style={styles.upgradeCard}>
          <Text style={styles.upgradeIcon}>⭐</Text>
          <Text style={styles.upgradeTitle}>Upgrade to Pro</Text>
          <Text style={styles.upgradeDescription}>
            Price alerts are a Pro feature. Upgrade to Pro to:
          </Text>
          <Text style={styles.upgradeFeature}>• Create unlimited price alerts</Text>
          <Text style={styles.upgradeFeature}>• Get notified when prices drop</Text>
          <Text style={styles.upgradeFeature}>• Set custom thresholds</Text>
          <Text style={styles.upgradeFeature}>• Extended search radius (up to 25 miles)</Text>

          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={() => router.push('/(app)/preferences')}
          >
            <Text style={styles.upgradeButtonText}>⭐ Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <Text style={styles.title}>Price Alerts</Text>
      <Text style={styles.subtitle}>Manage your fuel price alerts</Text>

      {/* Create Alert Button */}
      <TouchableOpacity style={styles.createButton} onPress={handleCreateAlert}>
        <Text style={styles.createButtonText}>+ Create New Alert</Text>
      </TouchableOpacity>

      {/* Alert Rules List */}
      {alertRules.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>🔔</Text>
          <Text style={styles.emptyStateTitle}>No Alerts Yet</Text>
          <Text style={styles.emptyStateDescription}>
            Create your first alert to get notified when fuel prices drop in your area.
          </Text>
        </View>
      ) : (
        <View style={styles.alertsList}>
          {alertRules.map((rule) => (
            <View key={rule.id} style={styles.alertCard}>
              <View style={styles.alertHeader}>
                <View style={styles.alertHeaderLeft}>
                  <Text style={styles.alertFuelType}>
                    {rule.fuelType === 'petrol' ? '⛽ Petrol' : '🚗 Diesel'}
                  </Text>
                  <View
                    style={[
                      styles.alertStatusBadge,
                      rule.enabled ? styles.alertStatusBadgeEnabled : styles.alertStatusBadgeDisabled,
                    ]}
                  >
                    <Text style={styles.alertStatusBadgeText}>
                      {rule.enabled ? 'Active' : 'Disabled'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.alertToggle}
                  onPress={() => handleToggleAlert(rule.id, rule.enabled)}
                >
                  <Text style={styles.alertToggleText}>
                    {rule.enabled ? '🔔' : '🔕'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.alertDetails}>
                <Text style={styles.alertDetailLabel}>Location:</Text>
                <Text style={styles.alertDetailValue}>{formatLocation(rule)}</Text>
              </View>

              <View style={styles.alertDetails}>
                <Text style={styles.alertDetailLabel}>Radius:</Text>
                <Text style={styles.alertDetailValue}>{rule.radiusMiles} miles</Text>
              </View>

              <View style={styles.alertDetails}>
                <Text style={styles.alertDetailLabel}>Threshold:</Text>
                <Text style={styles.alertDetailValue}>
                  {rule.thresholdPpl}p drop per litre
                </Text>
              </View>

              {rule.lastTriggeredAt && (
                <View style={styles.alertDetails}>
                  <Text style={styles.alertDetailLabel}>Last triggered:</Text>
                  <Text style={styles.alertDetailValue}>
                    {new Date(rule.lastTriggeredAt).toLocaleDateString()}
                  </Text>
                </View>
              )}

              <View style={styles.alertActions}>
                <TouchableOpacity
                  style={styles.alertActionButton}
                  onPress={() => handleEditAlert(rule)}
                >
                  <Text style={styles.alertActionButtonText}>✏️ Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.alertActionButton, styles.alertActionButtonDelete]}
                  onPress={() => handleDeleteAlert(rule.id)}
                >
                  <Text style={[styles.alertActionButtonText, styles.alertActionButtonDeleteText]}>
                    🗑️ Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.helpText}>
        Alerts are checked every hour. You'll receive a push notification when a price drop
        meets your threshold.
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
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  upgradeCard: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFD700',
    alignItems: 'center',
    marginTop: 20,
  },
  upgradeIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  upgradeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  upgradeDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  upgradeFeature: {
    fontSize: 15,
    color: '#333',
    marginBottom: 8,
    alignSelf: 'flex-start',
    width: '100%',
  },
  upgradeButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  alertsList: {
    gap: 16,
  },
  alertCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  alertFuelType: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  alertStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  alertStatusBadgeEnabled: {
    backgroundColor: '#34C759',
  },
  alertStatusBadgeDisabled: {
    backgroundColor: '#999',
  },
  alertStatusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  alertToggle: {
    padding: 8,
  },
  alertToggleText: {
    fontSize: 24,
  },
  alertDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  alertDetailLabel: {
    fontSize: 14,
    color: '#666',
  },
  alertDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  alertActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  alertActionButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  alertActionButtonDelete: {
    backgroundColor: '#FF3B30',
  },
  alertActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  alertActionButtonDeleteText: {
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  helpText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 30,
    marginBottom: 40,
    lineHeight: 20,
  },
});
