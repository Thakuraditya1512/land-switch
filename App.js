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
import { isSupabaseConfigured, supabase } from './src/supabase';
import VentureMap from './src/VentureMap';

const filters = ['All plots', 'Available', 'Reserved', 'Sold'];

const formatMoney = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const formatArea = plot => plot.area_sqft !== null && plot.area_sqft !== undefined
  ? `${Number(plot.area_sqft).toLocaleString('en-IN')} sq ft`
  : `${Number(plot.area_sqyd || 0).toLocaleString('en-IN')} sq yd`;
const hasCoordinates = plot => plot
  && plot.latitude !== null && plot.latitude !== undefined && plot.latitude !== ''
  && plot.longitude !== null && plot.longitude !== undefined && plot.longitude !== ''
  && Number.isFinite(Number(plot.latitude)) && Number.isFinite(Number(plot.longitude))
  && Number(plot.latitude) >= -90 && Number(plot.latitude) <= 90
  && Number(plot.longitude) >= -180 && Number(plot.longitude) <= 180;

function ActionButton({ label, onPress, secondary = false, compact = false }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.82}
      onPress={onPress}
      style={[
        styles.actionButton,
        secondary && styles.secondaryButton,
        compact && styles.compactButton
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
        <View style={styles.plotGlyph}><Text style={styles.plotGlyphText}>P</Text></View>
        <View style={styles.plotHeading}>
          <Text style={styles.plotName} numberOfLines={1}>{plot.title}</Text>
          <Text style={styles.plotLocation} numberOfLines={1}>{plot.location}</Text>
        </View>
        <Text style={[styles.statusPill, statusStyle]}>{plot.status || 'Available'}</Text>
      </View>

      <View style={styles.plotFacts}>
        <View>
          <Text style={styles.plotPrice}>{formatMoney(plot.price)}</Text>
          <Text style={styles.factLabel}>Total price</Text>
        </View>
        <View>
          <Text style={styles.plotPrice}>{formatArea(plot)}</Text>
          <Text style={styles.factLabel}>Plot area</Text>
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
  return (
    <View style={styles.mapCard}>
      <View style={styles.mapHeader}>
        <View>
          <Text style={styles.mapTitle}>Explore the region</Text>
          <Text style={styles.mapSubtitle}>Select a blue pin to zoom to a venture</Text>
        </View>
        <View style={styles.mapCount}><Text style={styles.mapCountText}>{plots.length} plots</Text></View>
      </View>

      <View style={styles.mapCanvas}>
        <VentureMap plots={plots} selectedPlot={selectedPlot} onSelectPlot={onSelectPlot} />
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
  const [statusFilter, setStatusFilter] = useState('All plots');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [listingMode, setListingMode] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newArea, setNewArea] = useState('');
  const [newDeveloper, setNewDeveloper] = useState('');
  const [newApproval, setNewApproval] = useState('');
  const [newAcreage, setNewAcreage] = useState('');
  const [newPricePerSqyd, setNewPricePerSqyd] = useState('');
  const [newLatitude, setNewLatitude] = useState('');
  const [newLongitude, setNewLongitude] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPhotoUrls, setNewPhotoUrls] = useState('');

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
        ? "Supabase cannot find public.plots. Run supabase/schema.sql in the project's SQL Editor."
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

  const filteredPlots = useMemo(() => {
    const search = query.trim().toLowerCase();
    return plots.filter(plot => {
      const matchesSearch = !search || `${plot.title} ${plot.location}`.toLowerCase().includes(search);
      const matchesStatus = statusFilter === 'All plots' || (plot.status || 'Available') === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [plots, query, statusFilter]);

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

  async function addPlot() {
    if (!newTitle.trim() || !newLocation.trim() || !newPrice || !newArea) {
      Alert.alert('Missing details', 'Complete all plot fields.');
      return;
    }
    const price = Number(newPrice);
    const area = Number(newArea);
    const latitude = newLatitude.trim() ? Number(newLatitude) : null;
    const longitude = newLongitude.trim() ? Number(newLongitude) : null;
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(area) || area <= 0) {
      Alert.alert('Invalid details', 'Price and plot area must be positive numbers.');
      return;
    }
    if ((latitude === null) !== (longitude === null)
      || (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90))
      || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
      Alert.alert('Invalid location', 'Enter both a valid latitude and longitude, or leave both blank.');
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      Alert.alert('Connect database', 'Set up Supabase first to save plots.');
      return;
    }

    const { error } = await supabase.from('plots').insert({
      title: newTitle.trim(),
      location: newLocation.trim(),
      price,
      area_sqyd: area,
      status: 'Available',
      developer_name: newDeveloper.trim() || null,
      approval_details: newApproval.trim() || null,
      acreage: newAcreage ? Number(newAcreage) : null,
      price_per_sqyd: newPricePerSqyd ? Number(newPricePerSqyd) : null,
      latitude,
      longitude,
      description: newDescription.trim(),
      photo_urls: newPhotoUrls.split(/\r?\n/).map(url => url.trim()).filter(Boolean)
    });

    if (error) {
      Alert.alert('Could not add plot', error.message);
      return;
    }

    setNewTitle('');
    setNewLocation('');
    setNewPrice('');
    setNewArea('');
    setNewDeveloper('');
    setNewApproval('');
    setNewAcreage('');
    setNewPricePerSqyd('');
    setNewLatitude('');
    setNewLongitude('');
    setNewDescription('');
    setNewPhotoUrls('');
    setListingMode(false);
    Alert.alert('Plot added', 'Your plot is now listed.');
    loadPlots();
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
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.pageInner}>
          <View style={styles.header}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => { setListingMode(false); setSelected(null); }}
              style={styles.brandLockup}
            >
              <View style={styles.brandMark}><Text style={styles.brandMarkText}>P</Text></View>
              <View>
                <Text style={styles.brandName}>PLOT<Text style={styles.brandAccent}>INVEST</Text></Text>
                <Text style={styles.brandTagline}>Land, with more clarity.</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.headerActions}>
              <Text style={styles.headerLink}>Explore</Text>
              <ActionButton
                label={listingMode ? 'Back to plots' : 'List a plot'}
                onPress={() => setListingMode(!listingMode)}
                compact={!isWide}
              />
            </View>
          </View>

          <View style={[styles.hero, !isWide && styles.heroMobile]}>
            <View style={[styles.heroCopy, !isWide && styles.heroCopyMobile]}>
              <Text style={styles.eyebrow}>PLOT DISCOVERY · MADE CLEAR</Text>
              <Text style={[styles.heroTitle, !isWide && styles.heroTitleMobile]}>Find land that{'\n'}fits your next move.</Text>
              <Text style={styles.heroDescription}>
                Explore available plots, compare the details, and express interest directly.
              </Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatNumber}>{plots.length}</Text>
                  <Text style={styles.heroStatLabel}>Listed plots</Text>
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
              <Text style={styles.eyebrow}>PARTNER WITH PLOTINVEST</Text>
              <Text style={styles.formTitle}>List a plot</Text>
              <Text style={styles.formDescription}>Add the venture details and coordinates. Coordinates place a blue marker on the map.</Text>
              <View style={styles.formFields}>
                <Field label="Plot or venture name" value={newTitle} onChangeText={setNewTitle} placeholder="e.g. Green Valley" />
                <Field label="Area or locality" value={newLocation} onChangeText={setNewLocation} placeholder="e.g. Mokila, Hyderabad" />
                <Field label="Total price (₹)" value={newPrice} onChangeText={setNewPrice} placeholder="5000000" keyboardType="numeric" />
                <Field label="Plot area (sq yd)" value={newArea} onChangeText={setNewArea} placeholder="300" keyboardType="numeric" />
                <Field label="Developer (optional)" value={newDeveloper} onChangeText={setNewDeveloper} placeholder="Developer or venture group" />
                <Field label="Approvals or registration (optional)" value={newApproval} onChangeText={setNewApproval} placeholder="Approval information" />
                <Field label="Acreage (optional)" value={newAcreage} onChangeText={setNewAcreage} placeholder="e.g. 12.5" keyboardType="decimal-pad" />
                <Field label="Price per sq yd (optional)" value={newPricePerSqyd} onChangeText={setNewPricePerSqyd} placeholder="e.g. 25000" keyboardType="numeric" />
                <Field label="Latitude (decimal degrees)" value={newLatitude} onChangeText={setNewLatitude} placeholder="e.g. 17.3850" keyboardType="decimal-pad" />
                <Field label="Longitude (decimal degrees)" value={newLongitude} onChangeText={setNewLongitude} placeholder="e.g. 78.4867" keyboardType="decimal-pad" />
                <Field label="Full description" value={newDescription} onChangeText={setNewDescription} placeholder="Describe access, facilities and key details." multiline />
                <Field label="Photo URLs (one public image URL per line)" value={newPhotoUrls} onChangeText={setNewPhotoUrls} placeholder="https://.../venture-photo.jpg" multiline />
              </View>
              <ActionButton label="Submit listing" onPress={addPlot} />
              <Text style={styles.helperText}>Run the venture-map SQL migration first. Enter both coordinates for an accurate pin. Photo links must be publicly accessible.</Text>
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
                  placeholder="Search a plot, city or locality"
                  placeholderTextColor="#818981"
                  style={styles.searchInput}
                />
                {query ? (
                  <TouchableOpacity accessibilityLabel="Clear search" onPress={() => setQuery('')}>
                    <Text style={styles.clearSearch}>Clear</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {filters.map(filter => (
                  <TouchableOpacity
                    accessibilityRole="button"
                    key={filter}
                    onPress={() => setStatusFilter(filter)}
                    style={[styles.filterChip, statusFilter === filter && styles.activeFilterChip]}
                  >
                    <Text style={[styles.filterText, statusFilter === filter && styles.activeFilterText]}>{filter}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

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
                      <Text style={styles.emptyTitle}>No plots match that search</Text>
                      <Text style={styles.emptyText}>Try another locality or clear the selected filters.</Text>
                      <TouchableOpacity onPress={() => { setQuery(''); setStatusFilter('All plots'); }}>
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
            <Text style={styles.footerBrand}>PLOTINVEST</Text>
            <Text style={styles.footerText}>A clearer way to explore land opportunities.</Text>
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
                  <Text style={styles.photoPlaceholderText}>Upload images to Supabase Storage and add their public URLs to this listing.</Text>
                </View>
              )}
              {selected.description ? <Text style={styles.detailDescription}>{selected.description}</Text> : null}
              <View style={styles.ventureDetails}>
                {selected.property_type ? <DetailRow label="Property type" value={selected.property_type} /> : null}
                {selected.floor_number !== null && selected.floor_number !== undefined ? <DetailRow label="Floor" value={String(selected.floor_number)} /> : null}
                {selected.developer_name ? <DetailRow label="Developer" value={selected.developer_name} /> : null}
                {selected.approval_details ? <DetailRow label="Approvals" value={selected.approval_details} /> : null}
                {selected.acreage ? <DetailRow label="Venture size" value={`${selected.acreage} acres`} /> : null}
                {selected.price_per_sqyd ? <DetailRow label="Price per sq yd" value={formatMoney(selected.price_per_sqyd)} /> : null}
                {selected.contact_phone ? <DetailRow label="Contact" value={selected.contact_phone} /> : null}
              </View>
              <View style={styles.detailSummary}>
                <View><Text style={styles.detailPrice}>{formatMoney(selected.price)}</Text><Text style={styles.factLabel}>Total price</Text></View>
                <View><Text style={styles.detailPrice}>{formatArea(selected)}</Text><Text style={styles.factLabel}>Area</Text></View>
              </View>
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
    backgroundColor: '#F6F5EF',
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
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1D4D3D', transform: [{ rotate: '-5deg' }]
  },
  brandMarkText: { color: '#F5F0DC', fontSize: 21, fontWeight: '900' },
  brandName: { color: '#1D3027', fontSize: 17, fontWeight: '900', letterSpacing: 1.2 },
  brandAccent: { color: '#6C9278' },
  brandTagline: { color: '#768177', fontSize: 10, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerLink: { color: '#3D5146', fontSize: 13, fontWeight: '700' },
  actionButton: {
    alignItems: 'center', justifyContent: 'center', borderRadius: 13,
    backgroundColor: '#1D4D3D', paddingHorizontal: 20, paddingVertical: 14
  },
  actionButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  secondaryButton: { backgroundColor: '#E8EEE7', borderWidth: 1, borderColor: '#DDE5DC' },
  secondaryButtonText: { color: '#1D4D3D' },
  compactButton: { paddingHorizontal: 14, paddingVertical: 11 },
  hero: {
    backgroundColor: '#E8ECDD', borderRadius: 26, minHeight: 310, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'stretch', marginBottom: 30
  },
  heroMobile: { flexDirection: 'column', minHeight: 0 },
  heroCopy: { flex: 1, padding: 30, justifyContent: 'center', zIndex: 1 },
  heroCopyMobile: { padding: 24 },
  eyebrow: { color: '#54735E', fontSize: 10, letterSpacing: 1.7, fontWeight: '900' },
  heroTitle: { color: '#1D3027', fontSize: 39, lineHeight: 44, fontWeight: '900', marginTop: 12 },
  heroTitleMobile: { fontSize: 32, lineHeight: 37 },
  heroDescription: { color: '#5D6A5F', fontSize: 14, lineHeight: 21, maxWidth: 400, marginTop: 10 },
  heroStats: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 24 },
  heroStat: { minWidth: 72 },
  heroStatNumber: { color: '#1D3027', fontSize: 16, fontWeight: '900' },
  heroStatLabel: { color: '#6D796D', fontSize: 10, marginTop: 4 },
  statDivider: { width: 1, height: 30, backgroundColor: '#CCD5C8' },
  heroArtwork: { flex: 0.9, minWidth: 250, overflow: 'hidden', position: 'relative', backgroundColor: '#D9E2D3' },
  heroArtworkMobile: { flex: 0, minWidth: 0, width: '100%', height: 150 },
  artworkSun: { position: 'absolute', width: 170, height: 170, borderRadius: 85, right: 30, top: 24, backgroundColor: '#E9DAB2' },
  artworkLine: { position: 'absolute', height: 12, borderRadius: 10, backgroundColor: '#F6F5EF', opacity: 0.92 },
  artworkLineOne: { width: '130%', left: '-10%', top: '39%', transform: [{ rotate: '-24deg' }] },
  artworkLineTwo: { width: '120%', left: '-15%', top: '67%', transform: [{ rotate: '18deg' }] },
  artworkLineThree: { width: '100%', left: '10%', top: '15%', transform: [{ rotate: '65deg' }] },
  artworkPlot: { position: 'absolute', width: 66, height: 60, borderWidth: 1, borderColor: '#9BB19A', backgroundColor: 'rgba(255,255,255,0.28)', transform: [{ rotate: '18deg' }] },
  artworkPlotOne: { left: '25%', top: '27%' },
  artworkPlotTwo: { left: '57%', top: '47%', width: 80, height: 68 },
  artworkPlotThree: { left: '37%', top: '69%', width: 55, height: 52 },
  artworkBadge: { position: 'absolute', right: 20, bottom: 20, backgroundColor: '#1D4D3D', borderRadius: 14, paddingHorizontal: 15, paddingVertical: 12 },
  artworkBadgeTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  artworkBadgeText: { color: '#D2E0D3', fontSize: 10, marginTop: 3 },
  notice: { backgroundColor: '#F2EBD8', padding: 14, borderRadius: 14, marginBottom: 16 },
  noticeTitle: { color: '#775F2B', fontWeight: '800', fontSize: 12 },
  noticeText: { color: '#775F2B', fontSize: 12, marginTop: 4 },
  errorNotice: { backgroundColor: '#F9E7E1', padding: 14, borderRadius: 14, marginBottom: 16 },
  errorText: { color: '#8E392C', fontSize: 12, lineHeight: 18 },
  retryText: { color: '#1D4D3D', fontWeight: '900', marginTop: 10, fontSize: 12 },
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
  activeFilterChip: { backgroundColor: '#1D4D3D', borderColor: '#1D4D3D' },
  filterText: { fontSize: 11, fontWeight: '700', color: '#68756A' },
  activeFilterText: { color: '#FFFFFF' },
  discoveryColumns: { flexDirection: 'column-reverse', gap: 14, alignItems: 'stretch' },
  discoveryColumnsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  listColumn: { width: '100%' },
  listColumnWide: { flex: 0.94, maxWidth: 560 },
  mapColumn: { width: '100%' },
  mapColumnWide: { flex: 1.06, minWidth: 0 },
  plotCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8EAE3', borderRadius: 18, padding: 16, marginBottom: 11 },
  selectedPlotCard: { borderColor: '#4E7A5D', borderWidth: 2, padding: 15 },
  plotCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  plotGlyph: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#E8EEE7', alignItems: 'center', justifyContent: 'center' },
  plotGlyphText: { color: '#1D4D3D', fontSize: 19, fontWeight: '900' },
  plotHeading: { flex: 1, minWidth: 0 },
  plotName: { color: '#25352B', fontSize: 14, fontWeight: '900' },
  plotLocation: { color: '#758075', fontSize: 11, marginTop: 4 },
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
  helperText: { color: '#818B80', fontSize: 10, lineHeight: 15, marginTop: 11 },
  footer: { borderTopWidth: 1, borderTopColor: '#E4E6DE', marginTop: 34, paddingTop: 20, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  footerBrand: { color: '#375944', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
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
