import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  const handleSearchPress = () => {
    router.push('/(app)/search');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to FuelFuse</Text>
      <Text style={styles.subtitle}>Find the cheapest fuel near you</Text>
      
      {user && (
        <Text style={styles.email}>Signed in as: {user.primaryEmailAddress?.emailAddress}</Text>
      )}
      
      <TouchableOpacity style={styles.primaryButton} onPress={handleSearchPress}>
        <Text style={styles.primaryButtonText}>🔍 Search for Fuel</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.secondaryButton} 
        onPress={() => router.push('/(app)/alerts')}
      >
        <Text style={styles.secondaryButtonText}>🔔 Price Alerts</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.secondaryButton} 
        onPress={() => router.push('/(app)/preferences')}
      >
        <Text style={styles.secondaryButtonText}>⚙️ Preferences</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  email: {
    fontSize: 14,
    color: '#333',
    marginBottom: 30,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 250,
    marginBottom: 15,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 250,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 200,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
