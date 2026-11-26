import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Alert,
  Linking,
  PanResponder,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { isSupabaseConfigured, supabase } from './src/supabase';
import VentureMap from './src/VentureMap';

const statusFilters = ['All listings', 'Available', 'Reserved', 'Sold', 'Rented'];
const propertyTypeOptions = [
  { value: 'all', label: 'All types' },
  { value: 'plot', label: 'Plots' },
  { value: 'apartment', label: 'Flats' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'building', label: 'Buildings' }
];
const listingTypeOptions = [
  { value: 'all', label: 'Sale or rent' },
  { value: 'sale', label: 'For sale' },
  { value: 'rent', label: 'For rent' }
];
const rentPeriodOptions = [
  { value: 'month', label: 'Per month' },
  { value: 'year', label: 'Per year' }
];
const formatMoney = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const propertyTypeLabel = type => ({
  plot: 'Plot',
  apartment: 'Flat / apartment',
  commercial: 'Commercial',
  building: 'Building'
}[type] || 'Property');
const formatListingPrice = plot => {
  const price = formatMoney(plot.price);
  if (plot.listing_type !== 'rent') return price;
  return `${price} / ${plot.rent_period === 'year' ? 'year' : 'month'}`;
};
const formatArea = plot => plot.area_sqft !== null && plot.area_sqft !== undefined
  ? `${Number(plot.area_sqft).toLocaleString('en-IN')} sq ft`
  : `${Number(plot.area_sqyd || 0).toLocaleString('en-IN')} sq yd`;
const hasCoordinates = plot => plot
  && plot.latitude !== null && plot.latitude !== undefined && plot.latitude !== ''
  && plot.longitude !== null && plot.longitude !== undefined && plot.longitude !== ''
  && Number.isFinite(Number(plot.latitude)) && Number.isFinite(Number(plot.longitude))
  && Number(plot.latitude) >= -90 && Number(plot.latitude) <= 90
  && Number(plot.longitude) >= -180 && Number(plot.longitude) <= 180;

function ActionButton({ label, onPress, secondary = false, compact = false, disabled = false }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={disabled ? 1 : 0.82}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        secondary && styles.secondaryButton,
        compact && styles.compactButton,
        disabled && styles.disabledButton
      ]}
    >
      <Text style={[styles.actionButtonText, secondary && styles.secondaryButtonText]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholderTextColor="#8B938B"
        style={[styles.input, multiline && styles.multilineInput]}
      />
    </View>
  );
}

function OptionGroup({ label, options, value, onChange }) {
  return (
    <View style={styles.optionGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map(option => (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: value === option.value }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.optionChip, value === option.value && styles.activeOptionChip]}
          >
            <Text style={[styles.optionText, value === option.value && styles.activeOptionText]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.detailRowValue}>{value}</Text>
    </View>
  );
}

function VenturePhoto({ url, label }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View style={styles.photoLoadError}>
        <Text style={styles.photoLoadErrorText}>Image unavailable</Text>
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={label}
      source={{ uri: url }}
      style={styles.venturePhoto}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

function PlotCard({ plot, selected, onPress }) {
  const raised = Number(plot.committed || 0);
  const progress = Math.min(100, Math.round((raised / Math.max(1, Number(plot.price || 0))) * 100));
  const statusStyle = plot.status === 'Available' ? styles.availableStatus : styles.otherStatus;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.plotCard, selected && styles.selectedPlotCard]}
    >
      <View style={styles.plotCardTop}>
        <View style={styles.plotGlyph}><Text style={styles.plotGlyphText}>L</Text></View>
        <View style={styles.plotHeading}>
          <Text style={styles.plotName} numberOfLines={1}>{plot.title}</Text>
          <Text style={styles.plotLocation} numberOfLines={1}>{plot.location}</Text>
          <Text style={styles.plotTypeLine} numberOfLines={1}>
            {propertyTypeLabel(plot.property_type)} · {plot.listing_type === 'rent' ? 'For rent' : 'For sale'}
          </Text>
        </View>
        <Text style={[styles.statusPill, statusStyle]}>{plot.status || 'Available'}</Text>
      </View>

      <View style={styles.plotFacts}>
        <View>
          <Text style={styles.plotPrice}>{formatListingPrice(plot)}</Text>
          <Text style={styles.factLabel}>{plot.listing_type === 'rent' ? 'Rent' : 'Asking price'}</Text>
        </View>
        <View>
          <Text style={styles.plotPrice}>{formatArea(plot)}</Text>
          <Text style={styles.factLabel}>Area</Text>
        </View>
        <View>
          <Text style={styles.plotPrice}>{Number(plot.interests || 0)}</Text>
          <Text style={styles.factLabel}>Interested</Text>
        </View>
      </View>

      <View style={styles.progressLabelRow}>
        <Text style={styles.factLabel}>Declared interest</Text>
        <Text style={styles.progressLabel}>{progress}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <View style={styles.progressFoot}>
        <Text style={styles.factLabel}>{formatMoney(raised)} proposed</Text>
        <Text style={styles.factLabel}>{formatMoney(Math.max(0, Number(plot.price || 0) - raised))} remaining</Text>
      </View>
    </TouchableOpacity>
  );
}

function AreaMap({ plots, selectedPlot, onSelectPlot }) {
  const mapPlots = selectedPlot ? [selectedPlot] : plots.slice(0, 1);

  return (
    <View style={styles.mapCard}>
      <View style={styles.mapHeader}>
        <View>
          <Text style={styles.mapTitle}>Property location</Text>
          <Text style={styles.mapSubtitle}>A single property pin, focused in satellite view</Text>
        </View>
        <View style={styles.mapCount}>
          <Text style={styles.mapCountText}>{mapPlots.length} {mapPlots.length === 1 ? 'pin' : 'pins'}</Text>
        </View>
      </View>

      <View style={styles.mapCanvas}>
        <VentureMap plots={mapPlots} selectedPlot={selectedPlot} onSelectPlot={onSelectPlot} />
      </View>
    </View>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const isWide = width >= 960;
  const [plots, setPlots] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All listings');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('all');
  const [listingTypeFilter, setListingTypeFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [listingMode, setListingMode] = useState(false);
  const [editingPlot, setEditingPlot] = useState(null);
  const [savingListing, setSavingListing] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newArea, setNewArea] = useState('');
  const [newAreaUnit, setNewAreaUnit] = useState('sqyd');
  const [newPropertyType, setNewPropertyType] = useState('plot');
  const [newListingType, setNewListingType] = useState('sale');
  const [newRentPeriod, setNewRentPeriod] = useState('month');
  const [newStatus, setNewStatus] = useState('Available');
  const [newFloorNumber, setNewFloorNumber] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newDeveloper, setNewDeveloper] = useState('');
  const [newApproval, setNewApproval] = useState('');
  const [newAcreage, setNewAcreage] = useState('');
  const [newPricePerSqyd, setNewPricePerSqyd] = useState('');
  const [newLatitude, setNewLatitude] = useState('');
  const [newLongitude, setNewLongitude] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPhotoUrls, setNewPhotoUrls] = useState([]);
  const pageScrollRef = useRef(null);

  async function loadPlots() {
    if (!isSupabaseConfigured || !supabase) return;
    setLoading(true);
    setLoadError('');

    const { data, error } = await supabase
      .from('plots')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      const message = error.code === 'PGRST205'
        ? 'Supabase cannot find public.plots. Run schema.sql for a new database, or the latest venture-map-migration.sql for an existing table.'
        : error.message;
      setLoadError(`Could not load plots: ${message}`);
      setLoading(false);
      return;
    }

    const { data: interests, error: interestsError } = await supabase
      .from('plot_interests')
      .select('plot_id, proposed_amount')
      .eq('status', 'interested');

    if (interestsError) {
      setLoadError(`Plots loaded, but interest totals could not be loaded: ${interestsError.message}`);
      setLoading(false);
      return;
    }

    const mapped = (data || []).map(plot => {
      const entries = (interests || []).filter(item => item.plot_id === plot.id);
      return {
        ...plot,
        interests: entries.length,
        committed: entries.reduce((sum, item) => sum + Number(item.proposed_amount || 0), 0)
      };
    });

    setPlots(mapped);
    setLoading(false);
  }

  useEffect(() => {
    loadPlots();
  }, []);

  function resetListingForm() {
    setEditingPlot(null);
    setNewTitle('');
    setNewLocation('');
    setNewPrice('');
    setNewArea('');
    setNewAreaUnit('sqyd');
    setNewPropertyType('plot');
    setNewListingType('sale');
    setNewRentPeriod('month');
    setNewStatus('Available');
    setNewFloorNumber('');
    setNewContactPhone('');
    setNewDeveloper('');
    setNewApproval('');
    setNewAcreage('');
    setNewPricePerSqyd('');
    setNewLatitude('');
    setNewLongitude('');
    setNewDescription('');
    setNewPhotoUrls([]);
  }

  function startNewListing() {
    resetListingForm();
    setListingMode(true);
    setSelected(null);
  }

  function startEditingPlot(plot) {
    setEditingPlot(plot);
    setNewTitle(plot.title || '');
    setNewLocation(plot.location || '');
    setNewPrice(String(plot.price || ''));
    const propertyType = plot.property_type || 'plot';
    const usesSquareFeet = propertyType !== 'plot';
    setNewAreaUnit(usesSquareFeet ? 'sqft' : 'sqyd');
    setNewArea(String(usesSquareFeet
      ? plot.area_sqft ?? (plot.area_sqyd ? Number(plot.area_sqyd) * 9 : '')
      : plot.area_sqyd || ''));
    setNewPropertyType(propertyType);
    setNewListingType(plot.listing_type || 'sale');
    setNewRentPeriod(plot.rent_period || 'month');
    const savedStatus = plot.status || 'Available';
    setNewStatus((plot.listing_type || 'sale') === 'rent' && savedStatus === 'Sold'
      || (plot.listing_type || 'sale') === 'sale' && savedStatus === 'Rented'
      ? 'Available'
      : savedStatus);
    setNewFloorNumber(plot.floor_number === null || plot.floor_number === undefined ? '' : String(plot.floor_number));
    setNewContactPhone(plot.contact_phone || '');
    setNewDeveloper(plot.developer_name || '');
    setNewApproval(plot.approval_details || '');
    setNewAcreage(plot.acreage ? String(plot.acreage) : '');
    setNewPricePerSqyd(plot.price_per_sqyd ? String(plot.price_per_sqyd) : '');
    setNewLatitude(plot.latitude === null || plot.latitude === undefined ? '' : String(plot.latitude));
    setNewLongitude(plot.longitude === null || plot.longitude === undefined ? '' : String(plot.longitude));
    setNewDescription(plot.description || '');
    setNewPhotoUrls(Array.isArray(plot.photo_urls) ? plot.photo_urls : []);
    setListingMode(true);
    setSelected(null);
    setSheetExpanded(false);
    if (pageScrollRef.current) pageScrollRef.current.scrollTo({ y: 0, animated: true });
  }

  const filteredPlots = useMemo(() => {
    const search = query.trim().toLowerCase();
    return plots.filter(plot => {
      const propertyTypeTerms = plot.property_type === 'apartment' ? 'flat apartment' : propertyTypeLabel(plot.property_type);
      const listingTypeTerms = plot.listing_type === 'rent' ? 'rent rental lease' : 'sale buy purchase';
      const matchesSearch = !search
        || `${plot.title} ${plot.location} ${propertyTypeTerms} ${listingTypeTerms} ${plot.status || 'Available'}`.toLowerCase().includes(search);
      const matchesStatus = statusFilter === 'All listings' || (plot.status || 'Available') === statusFilter;
      const matchesPropertyType = propertyTypeFilter === 'all' || (plot.property_type || 'plot') === propertyTypeFilter;
      const matchesListingType = listingTypeFilter === 'all' || (plot.listing_type || 'sale') === listingTypeFilter;
      return matchesSearch && matchesStatus && matchesPropertyType && matchesListingType;
    });
  }, [plots, query, statusFilter, propertyTypeFilter, listingTypeFilter]);

  const totalInterest = useMemo(
    () => plots.reduce((sum, plot) => sum + Number(plot.committed || 0), 0),
    [plots]
  );
  const selectedPhotos = selected && Array.isArray(selected.photo_urls) ? selected.photo_urls : [];

  async function submitInterest() {
    if (!selected || !name.trim() || !amount || Number(amount) <= 0) {
      Alert.alert('Complete the form', 'Enter your name and a valid proposed amount.');
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      Alert.alert('Preview mode', 'Connect Supabase to save investor interest.');
      return;
    }

    const { error } = await supabase.from('plot_interests').insert({
      plot_id: selected.id,
      investor_name: name.trim(),
      phone: phone.trim() || null,
      proposed_amount: Number(amount),
      status: 'interested'
    });

    if (error) {
      Alert.alert('Could not submit', error.message);
      return;
    }

    Alert.alert('Interest submitted', 'Your proposed amount has been recorded.');
    setAmount('');
    setName('');
    setPhone('');
    setSelected(null);
    loadPlots();
  }

  async function callContact() {
    if (!selected || !selected.contact_phone) return;
    try {
      await Linking.openURL(`tel:${selected.contact_phone}`);
    } catch (error) {
      Alert.alert('Could not start call', error.message);
    }
  }

  async function openInGoogleMaps() {
    if (!selected || !hasCoordinates(selected)) {
      Alert.alert('Location not available', 'Add valid latitude and longitude to this plot first.');
      return;
    }

    const query = `${Number(selected.latitude)},${Number(selected.longitude)}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Could not open Google Maps', error.message);
    }
  }

  async function uploadPhotoAssets(assets) {
    if (!assets.length) return;
    if (!isSupabaseConfigured || !supabase) {
      Alert.alert('Connect database', 'Connect Supabase before uploading property photos.');
      return;
    }
    if (newPhotoUrls.length + assets.length > 8) {
      Alert.alert('Photo limit reached', 'A property can have up to 8 photos. Remove a photo before adding more.');
      return;
    }

    setUploadingPhotos(true);
    let uploadedCount = 0;
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxPhotoBytes = 10 * 1024 * 1024;
    try {
      for (let index = 0; index < assets.length; index += 1) {
        const asset = assets[index];
        const contentType = asset.mimeType || 'image/jpeg';
        if (!allowedMimeTypes.includes(contentType)) {
          throw new Error('Choose a JPEG, PNG, or WebP image.');
        }
        if (asset.fileSize && asset.fileSize > maxPhotoBytes) {
          throw new Error('Each photo must be smaller than 10 MB.');
        }

        const response = await fetch(asset.uri);
        if (!response.ok) throw new Error('The selected photo could not be read.');
        const fileData = await response.arrayBuffer();
        if (fileData.byteLength > maxPhotoBytes) {
          throw new Error('Each photo must be smaller than 10 MB.');
        }

        const extension = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1];
        const filePath = `properties/${Date.now()}-${index}-${Math.random().toString(36).slice(2)}.${extension}`;
        const { data, error } = await supabase.storage
          .from('venture-photos')
          .upload(filePath, fileData, { contentType, upsert: false });
        if (error) throw error;

        const { data: publicData } = supabase.storage
          .from('venture-photos')
          .getPublicUrl(data.path);
        setNewPhotoUrls(current => [...current, publicData.publicUrl]);
        uploadedCount += 1;
      }

      if (uploadedCount) {
        Alert.alert('Photos uploaded', `${uploadedCount} photo${uploadedCount === 1 ? '' : 's'} added to this listing.`);
      }
    } catch (error) {
      Alert.alert('Photo upload failed', error.message || 'Check the image and Supabase Storage settings.');
    } finally {
      setUploadingPhotos(false);
    }
  }

  async function choosePhotosFromGallery() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo access needed', 'Allow photo library access to choose property photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: Math.max(1, 8 - newPhotoUrls.length),
        quality: 0.85,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible
      });
      if (!result.canceled) await uploadPhotoAssets(result.assets || []);
    } catch (error) {
      Alert.alert('Could not open photo library', error.message);
    }
  }

  async function takePropertyPhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera access needed', 'Allow camera access to take a property photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible
      });
      if (!result.canceled) await uploadPhotoAssets(result.assets || []);
    } catch (error) {
      Alert.alert('Could not open camera', error.message);
    }
  }

  async function addPlot() {
    if (!newTitle.trim() || !newLocation.trim() || !newPrice || !newArea) {
      Alert.alert('Missing details', 'Complete the property name, location, price, and area.');
      return;
    }
    const price = Number(newPrice);
    const area = Number(newArea);
    const latitude = newLatitude.trim() ? Number(newLatitude) : null;
    const longitude = newLongitude.trim() ? Number(newLongitude) : null;
    const floorNumber = newFloorNumber.trim() ? Number(newFloorNumber) : null;
    const acreage = newAcreage.trim() ? Number(newAcreage) : null;
    const pricePerSqyd = newPricePerSqyd.trim() ? Number(newPricePerSqyd) : null;
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(area) || area <= 0) {
      Alert.alert('Invalid details', 'Price and property area must be positive numbers.');
      return;
    }
    if ((floorNumber !== null && (!Number.isInteger(floorNumber) || floorNumber < 0))
      || (acreage !== null && (!Number.isFinite(acreage) || acreage <= 0))
      || (pricePerSqyd !== null && (!Number.isFinite(pricePerSqyd) || pricePerSqyd <= 0))) {
      Alert.alert('Invalid details', 'Floor must be a whole non-negative number; acreage and price per sq yd must be positive.');
      return;
    }
    if ((latitude === null) !== (longitude === null)
      || (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90))
      || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
      Alert.alert('Invalid location', 'Enter both a valid latitude and longitude, or leave both blank.');
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      Alert.alert('Connect database', 'Set up Supabase first to save properties.');
      return;
    }

    const listing = {
      title: newTitle.trim(),
      location: newLocation.trim(),
      price,
      area_sqyd: newAreaUnit === 'sqft' ? area / 9 : area,
      area_sqft: newAreaUnit === 'sqft' ? area : null,
      property_type: newPropertyType,
      listing_type: newListingType,
      rent_period: newListingType === 'rent' ? newRentPeriod : null,
      floor_number: newPropertyType === 'apartment' || newPropertyType === 'building' ? floorNumber : null,
      contact_phone: newContactPhone.trim() || null,
      status: newStatus,
      developer_name: newDeveloper.trim() || null,
      approval_details: newApproval.trim() || null,
      price_per_sqyd: newPropertyType === 'plot' && newListingType === 'sale' ? pricePerSqyd : null,
      acreage: newPropertyType === 'plot' && newListingType === 'sale' ? acreage : null,
      latitude,
      longitude,
      description: newDescription.trim(),
      photo_urls: newPhotoUrls
    };

    const wasEditing = Boolean(editingPlot);
    setSavingListing(true);
    try {
      const request = wasEditing
        ? supabase.from('plots').update(listing).eq('id', editingPlot.id)
        : supabase.from('plots').insert(listing);
      const { error } = await request;
      if (error) {
        Alert.alert(wasEditing ? 'Could not update property' : 'Could not add property', error.message);
        return;
      }

      resetListingForm();
      if (!wasEditing) setListingMode(false);
      setSelected(null);
      Alert.alert(wasEditing ? 'Property updated' : 'Property listed', wasEditing
        ? 'Your property changes have been saved.'
        : 'Your property is now listed.');
      await loadPlots();
    } catch (error) {
      Alert.alert(wasEditing ? 'Could not update property' : 'Could not add property', error.message);
    } finally {
      setSavingListing(false);
    }
  }

  const closeDetails = () => {
    setSelected(null);
    setSheetExpanded(false);
  };
  const openDetails = plot => {
    setSelected(plot);
    setSheetExpanded(false);
  };
  const detailPanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8,
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy < -45) setSheetExpanded(true);
      else if (gesture.dy > 60) {
        if (sheetExpanded) setSheetExpanded(false);
        else setSelected(null);
      }
    }
  }), [sheetExpanded]);

  return (
    <SafeAreaView style={styles.safe}>
      <ExpoStatusBar style="dark" />
      <ScrollView ref={pageScrollRef} contentContainerStyle={styles.page}>
        <View style={styles.pageInner}>
          <View style={styles.header}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => { setListingMode(false); setSelected(null); }}
              style={styles.brandLockup}
            >
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>S</Text>
                <View style={styles.brandMarkAccent} />
              </View>
              <View>
                <Text style={styles.brandName}>switch<Text style={styles.brandAccent}>LAND.IN</Text></Text>
                <Text style={styles.brandTagline}>Property, clearly found.</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.headerActions}>
              {isWide ? <Text style={styles.headerLink}>Explore</Text> : null}
              <ActionButton
                label={listingMode ? 'Back to properties' : 'List a property'}
                onPress={() => {
                  if (listingMode) {
                    resetListingForm();
                    setListingMode(false);
                  } else {
                    startNewListing();
                  }
                }}
                compact={!isWide}
              />
            </View>
          </View>

          <View style={[styles.hero, !isWide && styles.heroMobile]}>
            <View style={[styles.heroCopy, !isWide && styles.heroCopyMobile]}>
              <Text style={styles.eyebrow}>SWITCHLAND.IN · PROPERTY, MADE CLEAR</Text>
              <Text style={[styles.heroTitle, !isWide && styles.heroTitleMobile]}>Find a place for{'\n'}what comes next.</Text>
              <Text style={styles.heroDescription}>
                Discover property with clear details, precise locations, and a simpler way to explore.
              </Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatNumber}>{plots.length}</Text>
                  <Text style={styles.heroStatLabel}>Listed properties</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatNumber}>{formatMoney(totalInterest)}</Text>
                  <Text style={styles.heroStatLabel}>Proposed interest</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatNumber}>India</Text>
                  <Text style={styles.heroStatLabel}>Starting local</Text>
                </View>
              </View>
            </View>
            <View style={[styles.heroArtwork, !isWide && styles.heroArtworkMobile]}>
              <View style={styles.artworkSun} />
              <View style={[styles.artworkLine, styles.artworkLineOne]} />
              <View style={[styles.artworkLine, styles.artworkLineTwo]} />
              <View style={[styles.artworkLine, styles.artworkLineThree]} />
              <View style={[styles.artworkPlot, styles.artworkPlotOne]} />
              <View style={[styles.artworkPlot, styles.artworkPlotTwo]} />
              <View style={[styles.artworkPlot, styles.artworkPlotThree]} />
              <View style={styles.artworkBadge}>
                <Text style={styles.artworkBadgeTitle}>A better view</Text>
                <Text style={styles.artworkBadgeText}>of what you can own</Text>
              </View>
            </View>
          </View>

          {!isSupabaseConfigured && (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>Database not connected</Text>
              <Text style={styles.noticeText}>Connect Supabase to load plot listings and save investor interest.</Text>
            </View>
          )}

          {loadError ? (
            <View style={styles.errorNotice}>
              <Text style={styles.errorText}>{loadError}</Text>
              <TouchableOpacity onPress={loadPlots}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
            </View>
          ) : null}

          {listingMode ? (
            <View style={styles.listingForm}>
              <Text style={styles.eyebrow}>GROW WITH SWITCHLAND.IN</Text>
              <Text style={styles.formTitle}>{editingPlot ? 'Edit property' : 'List a property'}</Text>
              <Text style={styles.formDescription}>Choose a property type, sale or rental terms, and add its precise location.</Text>
              <View style={styles.formFields}>
                <OptionGroup
                  label="Property type"
                  options={propertyTypeOptions.filter(option => option.value !== 'all')}
                  value={newPropertyType}
                  onChange={value => {
                    setNewPropertyType(value);
                    const nextUnit = value === 'plot' ? 'sqyd' : 'sqft';
                    if (nextUnit !== newAreaUnit && newArea) setNewArea('');
                    setNewAreaUnit(nextUnit);
                  }}
                />
                <OptionGroup
                  label="Listing purpose"
                  options={listingTypeOptions.filter(option => option.value !== 'all')}
                  value={newListingType}
                  onChange={value => {
                    setNewListingType(value);
                    setNewStatus('Available');
                  }}
                />
                {newListingType === 'rent' ? (
                  <OptionGroup
                    label="Rent period"
                    options={rentPeriodOptions}
                    value={newRentPeriod}
                    onChange={setNewRentPeriod}
                  />
                ) : null}
                <OptionGroup
                  label="Availability"
                  options={newListingType === 'rent'
                    ? [{ value: 'Available', label: 'Available' }, { value: 'Reserved', label: 'Reserved' }, { value: 'Rented', label: 'Rented' }]
                    : [{ value: 'Available', label: 'Available' }, { value: 'Reserved', label: 'Reserved' }, { value: 'Sold', label: 'Sold' }]}
                  value={newStatus}
                  onChange={setNewStatus}
                />
                <Field label="Property or project name" value={newTitle} onChangeText={setNewTitle} placeholder="e.g. Green Valley" />
                <Field label="Area or locality" value={newLocation} onChangeText={setNewLocation} placeholder="e.g. Mokila, Hyderabad" />
                <Field
                  label={newListingType === 'rent'
                    ? `Rent (₹ per ${newRentPeriod})`
                    : 'Asking price (₹)'}
                  value={newPrice}
                  onChangeText={setNewPrice}
                  placeholder={newListingType === 'rent' ? 'e.g. 25000' : 'e.g. 8500000'}
                  keyboardType="numeric"
                />
                <Field
                  label={`Property area (${newAreaUnit === 'sqft' ? 'sq ft' : 'sq yd'})`}
                  value={newArea}
                  onChangeText={setNewArea}
                  placeholder={newAreaUnit === 'sqft' ? 'e.g. 950' : 'e.g. 300'}
                  keyboardType="decimal-pad"
                />
                {newPropertyType === 'apartment' || newPropertyType === 'building' ? (
                  <Field label="Floor (optional)" value={newFloorNumber} onChangeText={setNewFloorNumber} placeholder="e.g. 4" keyboardType="numeric" />
                ) : null}
                <Field label="Contact phone (optional)" value={newContactPhone} onChangeText={setNewContactPhone} placeholder="Phone number" keyboardType="phone-pad" />
                <Field label="Developer (optional)" value={newDeveloper} onChangeText={setNewDeveloper} placeholder="Developer or venture group" />
                <Field label="Approvals or registration (optional)" value={newApproval} onChangeText={setNewApproval} placeholder="Approval information" />
                {newPropertyType === 'plot' && newListingType === 'sale' ? (
                  <>
                    <Field label="Acreage (optional)" value={newAcreage} onChangeText={setNewAcreage} placeholder="e.g. 12.5" keyboardType="decimal-pad" />
                    <Field label="Price per sq yd (optional)" value={newPricePerSqyd} onChangeText={setNewPricePerSqyd} placeholder="e.g. 25000" keyboardType="numeric" />
                  </>
                ) : null}
                <Field label="Latitude (decimal degrees)" value={newLatitude} onChangeText={setNewLatitude} placeholder="e.g. 17.3850" keyboardType="decimal-pad" />
                <Field label="Longitude (decimal degrees)" value={newLongitude} onChangeText={setNewLongitude} placeholder="e.g. 78.4867" keyboardType="decimal-pad" />
                <Field label="Full description" value={newDescription} onChangeText={setNewDescription} placeholder="Describe access, facilities and key details." multiline />
                <View style={styles.photoUploadGroup}>
                  <Text style={styles.fieldLabel}>Property photos</Text>
                  <Text style={styles.photoUploadHint}>Choose up to 8 JPEG, PNG, or WebP photos (10 MB max each).</Text>
                  <View style={styles.photoActionRow}>
                    <ActionButton label="Choose from gallery" onPress={choosePhotosFromGallery} secondary compact disabled={uploadingPhotos} />
                    <ActionButton label="Take a photo" onPress={takePropertyPhoto} secondary compact disabled={uploadingPhotos} />
                  </View>
                  {uploadingPhotos ? (
                    <View style={styles.photoUploading}>
                      <ActivityIndicator color="#173F39" />
                      <Text style={styles.loadingText}>Uploading photos...</Text>
                    </View>
                  ) : null}
                  {newPhotoUrls.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.uploadedPhotoRow}>
                      {newPhotoUrls.map((url, index) => (
                        <View key={`${url}-${index}`} style={styles.uploadedPhotoItem}>
                          <Image source={{ uri: url }} style={styles.uploadedPhotoPreview} resizeMode="cover" />
                          <TouchableOpacity onPress={() => setNewPhotoUrls(current => current.filter((_, photoIndex) => photoIndex !== index))}>
                            <Text style={styles.removePhotoText}>Remove</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  ) : null}
                </View>
              </View>
              <ActionButton
                label={savingListing ? 'Saving...' : editingPlot ? 'Save changes' : 'Publish property'}
                onPress={addPlot}
                disabled={savingListing || uploadingPhotos}
              />
              <Text style={styles.helperText}>Run the latest Supabase migration first. Enter both coordinates to place the property pin. Camera access requires permission.</Text>
              <View style={styles.manageListings}>
                <View style={styles.manageListingsHeading}>
                  <View>
                    <Text style={styles.sectionEyebrow}>LISTED PROPERTY MANAGEMENT</Text>
                    <Text style={styles.manageListingsTitle}>Edit a listed property</Text>
                  </View>
                  <Text style={styles.resultCount}>{plots.length} listed</Text>
                </View>
                {loading ? (
                  <View style={styles.loadingState}>
                    <ActivityIndicator color="#24634D" />
                    <Text style={styles.loadingText}>Loading listed properties...</Text>
                  </View>
                ) : plots.length ? (
                  plots.map(plot => (
                    <View key={plot.id} style={styles.manageListingRow}>
                      <View style={styles.manageListingDetails}>
                        <Text style={styles.manageListingName} numberOfLines={1}>{plot.title}</Text>
                        <Text style={styles.manageListingLocation} numberOfLines={1}>{plot.location}</Text>
                        <Text style={styles.manageListingMeta}>
                          {propertyTypeLabel(plot.property_type)} · {plot.listing_type === 'rent' ? 'For rent' : 'For sale'} · {plot.status || 'Available'}
                        </Text>
                      </View>
                      <ActionButton
                        label="Edit"
                        onPress={() => startEditingPlot(plot)}
                        secondary
                        compact
                      />
                    </View>
                  ))
                ) : (
                  <Text style={styles.manageListingsEmpty}>No properties have been listed yet.</Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.discovery}>
              <View style={styles.discoveryHeading}>
                <View>
                  <Text style={styles.sectionEyebrow}>THE LAND DIRECTORY</Text>
                  <Text style={styles.sectionTitle}>Explore opportunities</Text>
                </View>
                <Text style={styles.resultCount}>{filteredPlots.length} results</Text>
              </View>

              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>⌕</Text>
                <TextInput
                  accessibilityLabel="Search by plot or locality"
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search by property, area or sale / rent"
                  placeholderTextColor="#818981"
                  style={styles.searchInput}
                />
                {query ? (
                  <TouchableOpacity accessibilityLabel="Clear search" onPress={() => setQuery('')}>
                    <Text style={styles.clearSearch}>Clear</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <OptionGroup label="Property type" options={propertyTypeOptions} value={propertyTypeFilter} onChange={setPropertyTypeFilter} />
              <OptionGroup label="Sale or rent" options={listingTypeOptions} value={listingTypeFilter} onChange={setListingTypeFilter} />
              <OptionGroup
                label="Availability"
                options={statusFilters.map(filter => ({ value: filter, label: filter }))}
                value={statusFilter}
                onChange={setStatusFilter}
              />

              <View style={[styles.discoveryColumns, isWide && styles.discoveryColumnsWide]}>
                <View style={[styles.listColumn, isWide && styles.listColumnWide]}>
                  {loading ? (
                    <View style={styles.loadingState}>
                      <ActivityIndicator color="#24634D" />
                      <Text style={styles.loadingText}>Loading live listings...</Text>
                    </View>
                  ) : filteredPlots.length ? (
                    filteredPlots.map(plot => (
                      <PlotCard
                        key={plot.id}
                        plot={plot}
                        selected={selected && selected.id === plot.id}
                        onPress={() => openDetails(plot)}
                      />
                    ))
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyTitle}>No properties match that search</Text>
                      <Text style={styles.emptyText}>Try another locality or clear the selected filters.</Text>
                      <TouchableOpacity onPress={() => {
                        setQuery('');
                        setStatusFilter('All listings');
                        setPropertyTypeFilter('all');
                        setListingTypeFilter('all');
                      }}>
                        <Text style={styles.retryText}>Clear filters</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <Text style={styles.disclaimer}>
                    Interest amounts are proposals, not verified payments or proof of ownership.
                  </Text>
                </View>

                <View style={[styles.mapColumn, isWide && styles.mapColumnWide]}>
                  <AreaMap
                    plots={filteredPlots}
                    selectedPlot={selected}
                    onSelectPlot={openDetails}
                  />
                </View>
              </View>
            </View>
          )}

          <View style={styles.footer}>
            <View style={styles.footerBrandGroup}>
              <Text style={styles.footerBrand}>switchLAND.IN</Text>
              <Text style={styles.footerCompany}>Aman &amp; Aditya LTD</Text>
            </View>
            <Text style={styles.footerText}>A clearer way to explore property.</Text>
          </View>
        </View>
      </ScrollView>

      {selected && !listingMode ? (
        <View style={styles.modalBackdrop}>
          <View style={[
            styles.detailModal,
            isWide && styles.detailModalWide,
            sheetExpanded && styles.detailModalExpanded
          ]}>
            <View style={styles.sheetDragArea} {...detailPanResponder.panHandlers}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={sheetExpanded ? 'Collapse plot details' : 'Expand plot details'}
                onPress={() => setSheetExpanded(!sheetExpanded)}
                style={styles.sheetHandleButton}
              >
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetHint}>{sheetExpanded ? 'Drag down to close' : 'Drag up for full details'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.detailContent}>
              <View style={styles.detailTopRow}>
                <Text style={styles.sectionEyebrow}>PLOT DETAILS</Text>
                <TouchableOpacity accessibilityLabel="Close plot details" onPress={closeDetails}>
                  <Text style={styles.closeButton}>Close  ×</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.detailTitle}>{selected.title}</Text>
              <Text style={styles.detailLocation}>{selected.location}</Text>
              {selectedPhotos.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
                  {selectedPhotos.map((url, index) => (
                    <VenturePhoto
                      key={`${url}-${index}`}
                      url={url}
                      label={`${selected.title} photo ${index + 1}`}
                    />
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderTitle}>Venture photos</Text>
                  <Text style={styles.photoPlaceholderText}>No photos yet. Edit this property to add photos from your gallery or camera.</Text>
                </View>
              )}
              {selected.description ? <Text style={styles.detailDescription}>{selected.description}</Text> : null}
              <View style={styles.ventureDetails}>
                <DetailRow label="Property type" value={propertyTypeLabel(selected.property_type)} />
                <DetailRow
                  label="Listing"
                  value={selected.listing_type === 'rent'
                    ? `For rent · Per ${selected.rent_period || 'month'}`
                    : 'For sale'}
                />
                {selected.floor_number !== null && selected.floor_number !== undefined ? <DetailRow label="Floor" value={String(selected.floor_number)} /> : null}
                {selected.developer_name ? <DetailRow label="Developer" value={selected.developer_name} /> : null}
                {selected.approval_details ? <DetailRow label="Approvals" value={selected.approval_details} /> : null}
                {selected.acreage ? <DetailRow label="Venture size" value={`${selected.acreage} acres`} /> : null}
                {selected.price_per_sqyd ? <DetailRow label="Price per sq yd" value={formatMoney(selected.price_per_sqyd)} /> : null}
                {selected.contact_phone ? <DetailRow label="Contact" value={selected.contact_phone} /> : null}
              </View>
              <View style={styles.detailSummary}>
                <View>
                  <Text style={styles.detailPrice}>{formatListingPrice(selected)}</Text>
                  <Text style={styles.factLabel}>{selected.listing_type === 'rent' ? 'Rent' : 'Asking price'}</Text>
                </View>
                <View><Text style={styles.detailPrice}>{formatArea(selected)}</Text><Text style={styles.factLabel}>Area</Text></View>
              </View>
              <ActionButton label="Edit property" onPress={() => startEditingPlot(selected)} secondary />
              {hasCoordinates(selected) ? (
                <ActionButton label="Open location in Google Maps" onPress={openInGoogleMaps} secondary />
              ) : (
                <Text style={styles.helperText}>Add this plot's latitude and longitude to enable Google Maps directions.</Text>
              )}
              {selected.contact_phone ? (
                <ActionButton label={`Call ${selected.contact_phone}`} onPress={callContact} secondary />
              ) : null}
              <Text style={styles.formTitle}>Express your interest</Text>
              <Text style={styles.formDescription}>Send a non-binding proposal. No payment is collected here.</Text>
              <Field label="Your name" value={name} onChangeText={setName} placeholder="Full name" />
              <Field label="Phone (optional)" value={phone} onChangeText={setPhone} placeholder="Mobile number" keyboardType="phone-pad" />
              <Field label="Proposed amount (₹)" value={amount} onChangeText={setAmount} placeholder="e.g. 500000" keyboardType="numeric" />
              <ActionButton label="Send expression of interest" onPress={submitInterest} />
            </ScrollView>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F4F2ED',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
  },
  page: { paddingHorizontal: 20, paddingBottom: 34 },
  pageInner: { width: '100%', maxWidth: 1320, alignSelf: 'center' },
  header: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12
  },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: {
    width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#153D36', borderWidth: 1, borderColor: '#C9A96E'
  },
  brandMarkText: { color: '#F5F0E4', fontSize: 22, fontWeight: '900' },
  brandMarkAccent: { position: 'absolute', width: 6, height: 6, borderRadius: 3, right: 8, top: 8, backgroundColor: '#D4B579' },
  brandName: { color: '#183A34', fontSize: 16, fontWeight: '900', letterSpacing: 0.1 },
  brandAccent: { color: '#B38C4F' },
  brandTagline: { color: '#718079', fontSize: 10, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerLink: { color: '#38534A', fontSize: 13, fontWeight: '700' },
  actionButton: {
    alignItems: 'center', justifyContent: 'center', borderRadius: 13,
    backgroundColor: '#173F39', paddingHorizontal: 20, paddingVertical: 14
  },
  actionButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  secondaryButton: { backgroundColor: '#E9EEE9', borderWidth: 1, borderColor: '#D7E0DB' },
  secondaryButtonText: { color: '#173F39' },
  compactButton: { paddingHorizontal: 14, paddingVertical: 11 },
  hero: {
    backgroundColor: '#153D36', borderRadius: 26, minHeight: 310, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'stretch', marginBottom: 30
  },
  heroMobile: { flexDirection: 'column', minHeight: 0 },
  heroCopy: { flex: 1, padding: 30, justifyContent: 'center', zIndex: 1 },
  heroCopyMobile: { padding: 24 },
  eyebrow: { color: '#D7BA7D', fontSize: 10, letterSpacing: 1.7, fontWeight: '900' },
  heroTitle: { color: '#FBF9F3', fontSize: 39, lineHeight: 44, fontWeight: '900', marginTop: 12 },
  heroTitleMobile: { fontSize: 32, lineHeight: 37 },
  heroDescription: { color: '#D4DFD9', fontSize: 14, lineHeight: 21, maxWidth: 400, marginTop: 10 },
  heroStats: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 24 },
  heroStat: { minWidth: 72 },
  heroStatNumber: { color: '#FBF9F3', fontSize: 16, fontWeight: '900' },
  heroStatLabel: { color: '#BFCFC7', fontSize: 10, marginTop: 4 },
  statDivider: { width: 1, height: 30, backgroundColor: '#55736A' },
  heroArtwork: { flex: 0.9, minWidth: 250, overflow: 'hidden', position: 'relative', backgroundColor: '#DDE6DC' },
  heroArtworkMobile: { flex: 0, minWidth: 0, width: '100%', height: 150 },
  artworkSun: { position: 'absolute', width: 170, height: 170, borderRadius: 85, right: 30, top: 24, backgroundColor: '#E6D5AD' },
  artworkLine: { position: 'absolute', height: 12, borderRadius: 10, backgroundColor: '#F7F5EF', opacity: 0.92 },
  artworkLineOne: { width: '130%', left: '-10%', top: '39%', transform: [{ rotate: '-24deg' }] },
  artworkLineTwo: { width: '120%', left: '-15%', top: '67%', transform: [{ rotate: '18deg' }] },
  artworkLineThree: { width: '100%', left: '10%', top: '15%', transform: [{ rotate: '65deg' }] },
  artworkPlot: { position: 'absolute', width: 66, height: 60, borderWidth: 1, borderColor: '#78988A', backgroundColor: 'rgba(255,255,255,0.28)', transform: [{ rotate: '18deg' }] },
  artworkPlotOne: { left: '25%', top: '27%' },
  artworkPlotTwo: { left: '57%', top: '47%', width: 80, height: 68 },
  artworkPlotThree: { left: '37%', top: '69%', width: 55, height: 52 },
  artworkBadge: { position: 'absolute', right: 20, bottom: 20, backgroundColor: '#153D36', borderRadius: 14, paddingHorizontal: 15, paddingVertical: 12 },
  artworkBadgeTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  artworkBadgeText: { color: '#D5E0D9', fontSize: 10, marginTop: 3 },
  notice: { backgroundColor: '#F2EBD8', padding: 14, borderRadius: 14, marginBottom: 16 },
  noticeTitle: { color: '#775F2B', fontWeight: '800', fontSize: 12 },
  noticeText: { color: '#775F2B', fontSize: 12, marginTop: 4 },
  errorNotice: { backgroundColor: '#F9E7E1', padding: 14, borderRadius: 14, marginBottom: 16 },
  errorText: { color: '#8E392C', fontSize: 12, lineHeight: 18 },
  retryText: { color: '#173F39', fontWeight: '900', marginTop: 10, fontSize: 12 },
  discovery: { paddingTop: 4 },
  discoveryHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 },
  sectionEyebrow: { color: '#72806F', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  sectionTitle: { color: '#1D3027', fontSize: 24, fontWeight: '900', marginTop: 5 },
  resultCount: { color: '#72806F', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  searchBox: {
    minHeight: 54, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 15, borderWidth: 1, borderColor: '#E7E9E1', paddingHorizontal: 15
  },
  searchIcon: { fontSize: 25, color: '#52705B', marginRight: 10 },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 13, color: '#24352A', outlineStyle: 'none' },
  clearSearch: { color: '#52705B', fontSize: 11, fontWeight: '800', paddingLeft: 10 },
  filterRow: { gap: 8, paddingVertical: 13 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: '#ECEDE6', borderWidth: 1, borderColor: '#ECEDE6' },
  activeFilterChip: { backgroundColor: '#173F39', borderColor: '#173F39' },
  filterText: { fontSize: 11, fontWeight: '700', color: '#68756A' },
  activeFilterText: { color: '#FFFFFF' },
  optionGroup: { marginBottom: 12 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  optionChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: '#ECEDE6', borderWidth: 1, borderColor: '#E1E5DD' },
  activeOptionChip: { backgroundColor: '#173F39', borderColor: '#173F39' },
  optionText: { color: '#64736B', fontSize: 11, fontWeight: '700' },
  activeOptionText: { color: '#FFFFFF' },
  discoveryColumns: { flexDirection: 'column-reverse', gap: 14, alignItems: 'stretch' },
  discoveryColumnsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  listColumn: { width: '100%' },
  listColumnWide: { flex: 0.94, maxWidth: 560 },
  mapColumn: { width: '100%' },
  mapColumnWide: { flex: 1.06, minWidth: 0 },
  plotCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8EAE3', borderRadius: 18, padding: 16, marginBottom: 11 },
  selectedPlotCard: { borderColor: '#4E7A5D', borderWidth: 2, padding: 15 },
  plotCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  plotGlyph: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#E7ECE6', alignItems: 'center', justifyContent: 'center' },
  plotGlyphText: { color: '#173F39', fontSize: 19, fontWeight: '900' },
  plotHeading: { flex: 1, minWidth: 0 },
  plotName: { color: '#25352B', fontSize: 14, fontWeight: '900' },
  plotLocation: { color: '#758075', fontSize: 11, marginTop: 4 },
  plotTypeLine: { color: '#A17D43', fontSize: 10, fontWeight: '800', marginTop: 5 },
  statusPill: { fontSize: 9, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9, overflow: 'hidden' },
  availableStatus: { color: '#316647', backgroundColor: '#E6F0E7' },
  otherStatus: { color: '#6E6755', backgroundColor: '#EEECE4' },
  plotFacts: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 17, marginBottom: 16 },
  plotPrice: { color: '#26362C', fontSize: 13, fontWeight: '900' },
  factLabel: { color: '#798279', fontSize: 10, marginTop: 4 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { color: '#35674A', fontSize: 11, fontWeight: '900' },
  progressTrack: { height: 6, borderRadius: 8, overflow: 'hidden', backgroundColor: '#E9ECE5', marginTop: 7 },
  progressFill: { height: 6, backgroundColor: '#578565', borderRadius: 8 },
  progressFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  mapCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8EAE3', borderRadius: 20, padding: 14, overflow: 'hidden' },
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 4, paddingBottom: 13 },
  mapTitle: { color: '#26362C', fontSize: 15, fontWeight: '900' },
  mapSubtitle: { color: '#7A847B', fontSize: 10, marginTop: 4 },
  mapCount: { backgroundColor: '#EDF1E9', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12 },
  mapCountText: { color: '#42634B', fontSize: 10, fontWeight: '800' },
  mapCanvas: { height: 390, backgroundColor: '#E4E8DB', borderRadius: 15, overflow: 'hidden', position: 'relative' },
  loadingState: { paddingVertical: 45, alignItems: 'center', gap: 10 },
  loadingText: { color: '#758075', fontSize: 12 },
  emptyState: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 22, borderWidth: 1, borderColor: '#E8EAE3' },
  emptyTitle: { color: '#26362C', fontSize: 15, fontWeight: '900' },
  emptyText: { color: '#758075', fontSize: 12, marginTop: 7, lineHeight: 18 },
  disclaimer: { color: '#7D867D', fontSize: 10, lineHeight: 15, paddingHorizontal: 4, paddingTop: 7 },
  listingForm: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 22, borderWidth: 1, borderColor: '#E8EAE3' },
  formTitle: { color: '#1D3027', fontSize: 22, fontWeight: '900', marginTop: 8 },
  formDescription: { color: '#728074', fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 15 },
  formFields: { flexDirection: 'column' },
  field: { marginBottom: 12 },
  fieldLabel: { color: '#56645A', fontSize: 11, fontWeight: '800', marginBottom: 6 },
  input: { color: '#26362C', backgroundColor: '#F8F8F3', borderWidth: 1, borderColor: '#E3E7DF', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, fontSize: 13, outlineStyle: 'none' },
  multilineInput: { minHeight: 90 },
  photoUploadGroup: { marginBottom: 14 },
  photoUploadHint: { color: '#78847C', fontSize: 10, lineHeight: 15 },
  photoActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  photoUploading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12 },
  uploadedPhotoRow: { gap: 10, paddingVertical: 12 },
  uploadedPhotoItem: { alignItems: 'center', gap: 5 },
  uploadedPhotoPreview: { width: 100, height: 78, borderRadius: 10, backgroundColor: '#E7ECE6' },
  removePhotoText: { color: '#8E392C', fontSize: 10, fontWeight: '800', paddingVertical: 3 },
  manageListings: { marginTop: 26, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#E8EAE3' },
  manageListingsHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 },
  manageListingsTitle: { color: '#1D3027', fontSize: 17, fontWeight: '900', marginTop: 5 },
  manageListingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8F8F3', borderWidth: 1, borderColor: '#E8EAE3', borderRadius: 14, padding: 12, marginBottom: 9 },
  manageListingDetails: { flex: 1, minWidth: 0 },
  manageListingName: { color: '#25352B', fontSize: 13, fontWeight: '900' },
  manageListingLocation: { color: '#758075', fontSize: 11, marginTop: 4 },
  manageListingMeta: { color: '#A17D43', fontSize: 10, fontWeight: '800', marginTop: 5 },
  manageListingsEmpty: { color: '#758075', fontSize: 12, paddingVertical: 14 },
  disabledButton: { opacity: 0.55 },
  helperText: { color: '#818B80', fontSize: 10, lineHeight: 15, marginTop: 11 },
  footer: { borderTopWidth: 1, borderTopColor: '#E4E6DE', marginTop: 34, paddingTop: 20, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  footerBrandGroup: { gap: 4 },
  footerBrand: { color: '#173F39', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  footerCompany: { color: '#718079', fontSize: 10 },
  footerText: { color: '#798279', fontSize: 10 },
  modalBackdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(20,35,27,0.48)', justifyContent: 'flex-end', alignItems: 'center', paddingTop: 18 },
  detailModal: { width: '100%', maxWidth: 700, height: '76%', maxHeight: '96%', backgroundColor: '#F8F8F3', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  detailModalWide: { width: '100%' },
  detailModalExpanded: { height: '96%' },
  sheetDragArea: { alignItems: 'center', paddingTop: 8, paddingBottom: 8 },
  sheetHandleButton: { alignItems: 'center', paddingHorizontal: 40, paddingBottom: 4 },
  sheetHandle: { width: 42, height: 5, borderRadius: 4, backgroundColor: '#B9C2B8' },
  sheetHint: { color: '#7A847B', fontSize: 9, fontWeight: '700', marginTop: 5 },
  detailContent: { padding: 22 },
  detailTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { color: '#49684F', fontSize: 12, fontWeight: '900' },
  detailTitle: { color: '#1D3027', fontSize: 27, fontWeight: '900', marginTop: 12 },
  detailLocation: { color: '#748075', fontSize: 12, marginTop: 5 },
  photoStrip: { gap: 10, paddingVertical: 16 },
  venturePhoto: { width: 270, height: 165, borderRadius: 14, backgroundColor: '#E4E8DB' },
  photoLoadError: { width: 270, height: 165, borderRadius: 14, backgroundColor: '#E8EEE7', alignItems: 'center', justifyContent: 'center' },
  photoLoadErrorText: { color: '#66766A', fontSize: 11, fontWeight: '700' },
  photoPlaceholder: { minHeight: 130, marginTop: 16, marginBottom: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#E8EEE7', padding: 18 },
  photoPlaceholderTitle: { color: '#355C41', fontSize: 13, fontWeight: '900' },
  photoPlaceholderText: { color: '#768177', fontSize: 11, marginTop: 5, textAlign: 'center' },
  detailDescription: { color: '#56645A', fontSize: 12, lineHeight: 18, marginTop: 14 },
  ventureDetails: { marginTop: 14, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: '#FFFFFF' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF0EA' },
  detailRowValue: { color: '#2A3D30', fontSize: 11, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  detailSummary: { flexDirection: 'row', gap: 45, marginVertical: 20, padding: 16, borderRadius: 15, backgroundColor: '#E9EEE6' },
  detailPrice: { color: '#1D4D3D', fontSize: 18, fontWeight: '900' }
});
