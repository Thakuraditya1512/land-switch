import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Constants from 'expo-constants';

const useGoogleMapsOnIos = Constants.expoConfig?.extra?.googleMapsIosEnabled === true;

function getCoordinates(plot) {
  if (plot.latitude === null || plot.latitude === undefined || plot.latitude === ''
    || plot.longitude === null || plot.longitude === undefined || plot.longitude === '') return null;
  const latitude = Number(plot.latitude);
  const longitude = Number(plot.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

export default function VentureMap({ plots, selectedPlot, onSelectPlot }) {
  const map = useRef(null);
  const mappedPlots = useMemo(
    () => plots.map(plot => ({ plot, coordinate: getCoordinates(plot) })).filter(item => item.coordinate),
    [plots]
  );

  const initialRegion = useMemo(() => {
    if (!mappedPlots.length) {
      return { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 18, longitudeDelta: 18 };
    }
    const latitude = mappedPlots.reduce((sum, item) => sum + item.coordinate.latitude, 0) / mappedPlots.length;
    const longitude = mappedPlots.reduce((sum, item) => sum + item.coordinate.longitude, 0) / mappedPlots.length;
    return {
      latitude,
      longitude,
      latitudeDelta: mappedPlots.length === 1 ? 0.025 : 2,
      longitudeDelta: mappedPlots.length === 1 ? 0.025 : 2
    };
  }, [mappedPlots]);

  const focusOnProperty = coordinate => {
    map.current?.animateCamera({
      center: coordinate,
      zoom: 19,
      pitch: 55,
      heading: 30
    }, { duration: 900 });
  };

  useEffect(() => {
    const coordinate = selectedPlot && getCoordinates(selectedPlot);
    if (!coordinate || !map.current) return;
    focusOnProperty(coordinate);
  }, [selectedPlot]);

  const useGoogleProvider = Platform.OS === 'android' || useGoogleMapsOnIos;

  return (
    <View style={styles.root}>
      <MapView
        ref={map}
        style={styles.map}
        initialRegion={initialRegion}
        provider={useGoogleProvider ? PROVIDER_GOOGLE : undefined}
        mapType="satellite"
        showsBuildings
        pitchEnabled
        rotateEnabled
        showsUserLocation={false}
        toolbarEnabled
      >
        {mappedPlots.map(({ plot, coordinate }) => (
          <Marker
            key={plot.id}
            coordinate={coordinate}
            title={plot.title}
            description={plot.location}
            pinColor="#2563EB"
            onPress={() => {
              focusOnProperty(coordinate);
              onSelectPlot(plot);
            }}
          />
        ))}
      </MapView>
      {!mappedPlots.length ? (
        <View pointerEvents="none" style={styles.message}>
          <Text style={styles.messageTitle}>Add venture coordinates</Text>
          <Text style={styles.messageText}>Enter latitude and longitude for a plot to place its blue pin on the map.</Text>
        </View>
      ) : null}
      {Platform.OS === 'ios' && !useGoogleMapsOnIos ? (
        <View pointerEvents="none" style={styles.providerNote}>
          <Text style={styles.providerNoteText}>Apple Maps preview · add an iOS Maps key for Google Maps</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 390, position: 'relative' },
  map: { width: '100%', height: '100%', minHeight: 390 },
  message: {
    position: 'absolute', left: 18, right: 18, bottom: 18,
    padding: 14, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.94)'
  },
  messageTitle: { color: '#25372D', fontSize: 12, fontWeight: '900' },
  messageText: { color: '#6E7B70', fontSize: 11, lineHeight: 16, marginTop: 4 },
  providerNote: { position: 'absolute', top: 10, left: 10, right: 10, alignItems: 'center' },
  providerNoteText: { color: '#42564A', backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 9 }
});
