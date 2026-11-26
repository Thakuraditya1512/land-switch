import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
let mapsPromise;

function loadGoogleMaps() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Maps requires a browser.'));
  if (window.google && window.google.maps) return Promise.resolve(window.google.maps);
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.onload = () => {
      if (window.google && window.google.maps) resolve(window.google.maps);
      else reject(new Error('Google Maps did not initialize.'));
    };
    script.onerror = () => {
      mapsPromise = null;
      reject(new Error('Google Maps could not load. Check the API key and Maps JavaScript API settings.'));
    };
    document.head.appendChild(script);
  });

  return mapsPromise;
}

function getCoordinates(plot) {
  if (plot.latitude === null || plot.latitude === undefined || plot.latitude === ''
    || plot.longitude === null || plot.longitude === undefined || plot.longitude === '') return null;
  const latitude = Number(plot.latitude);
  const longitude = Number(plot.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { lat: latitude, lng: longitude };
}

export default function VentureMap({ plots, selectedPlot, onSelectPlot }) {
  const mapElement = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');

  const mappedPlots = useMemo(
    () => plots.map(plot => ({ plot, position: getCoordinates(plot) })).filter(item => item.position),
    [plots]
  );

  useEffect(() => {
    if (!apiKey || !mapElement.current) return undefined;
    let active = true;

    loadGoogleMaps()
      .then(maps => {
        if (!active || !mapElement.current) return;
        map.current = new maps.Map(mapElement.current, {
          center: { lat: 20.5937, lng: 78.9629 },
          zoom: 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy'
        });
        setMapReady(true);
      })
      .catch(error => {
        if (active) setMapError(error.message);
      });

    return () => {
      active = false;
      markers.current.forEach(marker => marker.setMap(null));
      markers.current = [];
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !map.current || !window.google || !window.google.maps) return;

    markers.current.forEach(marker => marker.setMap(null));
    markers.current = mappedPlots.map(({ plot, position }) => {
      const marker = new window.google.maps.Marker({
        map: map.current,
        position,
        title: plot.title,
        icon: {
          path: 'M12 2C7.6 2 4 5.6 4 10.1c0 6 8 13.9 8 13.9s8-7.9 8-13.9C20 5.6 16.4 2 12 2zm0 11.1a3 3 0 1 1 0-6 3 3 0 0 1 0 6z',
          fillColor: '#2563EB',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
          anchor: new window.google.maps.Point(12, 24),
          scaledSize: new window.google.maps.Size(28, 28)
        }
      });
      marker.addListener('click', () => {
        map.current.panTo(position);
        map.current.setZoom(16);
        onSelectPlot(plot);
      });
      return marker;
    });

    if (selectedPlot) {
      const selectedPosition = getCoordinates(selectedPlot);
      if (selectedPosition) {
        map.current.panTo(selectedPosition);
        map.current.setZoom(16);
        return;
      }
    }

    if (mappedPlots.length === 1) {
      map.current.setCenter(mappedPlots[0].position);
      map.current.setZoom(14);
    } else if (mappedPlots.length > 1) {
      const bounds = new window.google.maps.LatLngBounds();
      mappedPlots.forEach(({ position }) => bounds.extend(position));
      map.current.fitBounds(bounds, 48);
    }
  }, [mapReady, mappedPlots, selectedPlot, onSelectPlot]);

  return (
    <View style={styles.root}>
      <View ref={mapElement} style={styles.map} />
      {!apiKey ? (
        <View style={styles.message}>
          <Text style={styles.messageTitle}>Google Maps key needed</Text>
          <Text style={styles.messageText}>Add a restricted Maps JavaScript API key to enable the interactive map.</Text>
        </View>
      ) : null}
      {apiKey && !mappedPlots.length ? (
        <View style={styles.message}>
          <Text style={styles.messageTitle}>Add venture coordinates</Text>
          <Text style={styles.messageText}>Enter latitude and longitude for a plot to place its blue pin on the map.</Text>
        </View>
      ) : null}
      {mapError ? (
        <View style={styles.error}>
          <Text style={styles.messageTitle}>Map unavailable</Text>
          <Text style={styles.messageText}>{mapError}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 390, position: 'relative', backgroundColor: '#E4E8DB' },
  map: { width: '100%', height: '100%', minHeight: 390 },
  message: {
    position: 'absolute', alignSelf: 'center', left: 18, right: 18, bottom: 18,
    padding: 14, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.94)'
  },
  messageTitle: { color: '#25372D', fontSize: 12, fontWeight: '900' },
  messageText: { color: '#6E7B70', fontSize: 11, lineHeight: 16, marginTop: 4 },
  error: {
    position: 'absolute', left: 18, right: 18, top: 18, padding: 14,
    borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.96)'
  }
});
