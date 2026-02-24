import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'FuelFuse' }} />
      <Stack.Screen name="search" options={{ title: 'Search' }} />
      <Stack.Screen name="results" options={{ title: 'Results' }} />
      <Stack.Screen name="station-detail" options={{ title: 'Station Details' }} />
      <Stack.Screen name="preferences" options={{ title: 'Preferences' }} />
      <Stack.Screen name="alerts" options={{ title: 'Price Alerts' }} />
      <Stack.Screen name="alert-form" options={{ title: 'Alert' }} />
    </Stack>
  );
}
