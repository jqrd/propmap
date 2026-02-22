/**
 * Air Quality layer — fetches live data from ERG/KCL London Air API.
 * Exports AirQualityLayer._stations for use by combined-score.js.
 */
const AirQualityLayer = (() => {
  const SITES_URL =
    'https://api.erg.ic.ac.uk/AirQuality/Information/MonitoringSites/GroupName=London/Json';
  const AQI_URL =
    'https://api.erg.ic.ac.uk/AirQuality/Hourly/MonitoringIndex/GroupName=London/Json';

  // Target borough names as they appear in the ERG API
  const TARGET_BOROUGHS = new Set([
    'Hammersmith and Fulham',
    'Richmond',
    'Richmond Upon Thames',
    'Wandsworth',
    'Hounslow',
    'Kensington and Chelsea',
    'Kensington And Chelsea',
  ]);

  // AQI band definitions (ERG 1–10 scale)
  const BANDS = [
    { max: 3,  label: 'Low',       color: '#3cb371', cssClass: 'aqi-low' },
    { max: 6,  label: 'Moderate',  color: '#f0a500', cssClass: 'aqi-moderate' },
    { max: 9,  label: 'High',      color: '#e67e22', cssClass: 'aqi-high' },
    { max: 10, label: 'Very High', color: '#c0392b', cssClass: 'aqi-very-high' },
  ];

  const NO_DATA_COLOR = '#aaa';

  let _map = null;
  let _layer = null;       // L.LayerGroup
  let _visible = false;
  let _stations = {};      // { siteCode: { lat, lng, maxAQI, name } } — shared with combined

  // ---- helpers -------------------------------------------------------

  function _bandForAQI(aqi) {
    if (aqi == null || isNaN(aqi)) return null;
    return BANDS.find(b => aqi <= b.max) || BANDS[BANDS.length - 1];
  }

  function _markerColor(maxAQI) {
    const band = _bandForAQI(maxAQI);
    return band ? band.color : NO_DATA_COLOR;
  }

  function _buildPopup(site, pollutants, date) {
    const maxAQI = _maxAQI(pollutants);
    const band = _bandForAQI(maxAQI);
    const bandLabel = band ? band.label : 'No data';
    const bandClass = band ? band.cssClass : 'aqi-no-data';

    let rows = '';
    for (const p of pollutants) {
      const val = p.AirQualityIndex != null ? p.AirQualityIndex : '—';
      rows += `<tr>
        <td>${_escape(p.SpeciesCode || p.SpeciesName || '')}</td>
        <td>${_escape(String(val))}</td>
      </tr>`;
    }

    return `
      <div class="popup-title">${_escape(site.SiteName || site.LocalAuthorityName || '')}</div>
      <table class="popup-table">
        <tr><td>Borough</td><td>${_escape(site.LocalAuthorityName || '')}</td></tr>
        <tr><td>Overall AQI</td><td>
          <span class="popup-aqi-band ${bandClass}">${bandLabel}${maxAQI != null ? ' (' + maxAQI + ')' : ''}</span>
        </td></tr>
        ${rows ? '<tr><td colspan="2" style="padding-top:4px;font-weight:600;color:#666;font-size:11px">POLLUTANTS</td></tr>' + rows : ''}
        ${date ? `<tr><td>Updated</td><td>${_escape(date)}</td></tr>` : ''}
      </table>
    `;
  }

  function _maxAQI(pollutants) {
    let max = null;
    for (const p of pollutants) {
      const v = parseFloat(p.AirQualityIndex);
      if (!isNaN(v) && (max === null || v > max)) max = v;
    }
    return max;
  }

  function _escape(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---- data fetch ----------------------------------------------------

  async function _fetchData() {
    const [sitesResp, aqiResp] = await Promise.all([
      fetch(SITES_URL),
      fetch(AQI_URL),
    ]);
    const sitesJson = await sitesResp.json();
    const aqiJson   = await aqiResp.json();
    return { sitesJson, aqiJson };
  }

  function _parseSites(sitesJson) {
    const arr =
      sitesJson?.Sites?.Site ||
      sitesJson?.AirQualityInformation?.LocalAuthority?.flatMap(la => la.Site || []) ||
      [];
    const map = {};
    for (const s of (Array.isArray(arr) ? arr : [arr])) {
      if (s['@SiteCode']) map[s['@SiteCode']] = s;
    }
    return map;
  }

  function _parseAQI(aqiJson) {
    // Structure: { HourlyAirQualityIndex: { LocalAuthority: [...] } }
    const las =
      aqiJson?.HourlyAirQualityIndex?.LocalAuthority ||
      [];
    const result = {}; // siteCode → { pollutants, date }
    const lasArr = Array.isArray(las) ? las : [las];
    for (const la of lasArr) {
      const sites = Array.isArray(la.Site) ? la.Site : (la.Site ? [la.Site] : []);
      for (const site of sites) {
        const code = site['@SiteCode'];
        if (!code) continue;
        const species = Array.isArray(site.Species)
          ? site.Species
          : (site.Species ? [site.Species] : []);
        const pollutants = species.map(sp => ({
          SpeciesCode: sp['@SpeciesCode'],
          SpeciesName: sp['@SpeciesName'] || sp['@SpeciesCode'],
          AirQualityIndex: sp['@AirQualityIndex'] != null ? parseFloat(sp['@AirQualityIndex']) : null,
        }));
        result[code] = {
          pollutants,
          date: site['@BulletinDate'] || '',
        };
      }
    }
    return result;
  }

  // ---- layer build ---------------------------------------------------

  function _buildLayer(sitesMap, aqiMap) {
    const group = L.layerGroup();
    _stations = {};

    for (const [code, site] of Object.entries(sitesMap)) {
      const borough = (site['@LocalAuthorityName'] || site.LocalAuthorityName || '').trim();

      // Filter to target boroughs
      const boroughNorm = borough.toLowerCase().replace(/\s+/g, ' ');
      const inTarget = [...TARGET_BOROUGHS].some(
        b => b.toLowerCase().replace(/\s+/g, ' ') === boroughNorm ||
             boroughNorm.includes(b.toLowerCase().replace(/\s+/g, ' '))
      );
      if (!inTarget) continue;

      const lat = parseFloat(site['@Latitude'] || site.Latitude);
      const lng = parseFloat(site['@Longitude'] || site.Longitude);
      if (isNaN(lat) || isNaN(lng)) continue;

      // Check station is active / has data
      const isActive = (site['@SiteType'] !== 'Closed') &&
                       (site['@DateClosed'] == null || site['@DateClosed'] === '');
      if (!isActive) continue;

      const aqiData = aqiMap[code] || { pollutants: [], date: '' };
      const maxAQI  = _maxAQI(aqiData.pollutants);

      const siteName = site['@SiteName'] || site.SiteName || code;
      const laSite = {
        SiteName: siteName,
        LocalAuthorityName: borough,
      };

      const color = _markerColor(maxAQI);
      const marker = L.circleMarker([lat, lng], {
        radius: 8,
        color: '#fff',
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.85,
      });
      marker.bindPopup(_buildPopup(laSite, aqiData.pollutants, aqiData.date));
      group.addLayer(marker);

      // Export for combined score
      _stations[code] = { lat, lng, maxAQI, name: siteName };
    }

    return group;
  }

  // ---- public API ----------------------------------------------------

  async function init(map) {
    _map = map;
    _layer = L.layerGroup().addTo(_map);
    _visible = true;

    _renderLegend();

    try {
      const { sitesJson, aqiJson } = await _fetchData();
      const sitesMap = _parseSites(sitesJson);
      const aqiMap   = _parseAQI(aqiJson);
      _layer.clearLayers();
      const built = _buildLayer(sitesMap, aqiMap);
      built.eachLayer(l => _layer.addLayer(l));
    } catch (err) {
      console.error('Air quality fetch failed:', err);
    }
  }

  function show() {
    if (!_map || _visible) return;
    _layer.addTo(_map);
    _visible = true;
    _renderLegend();
  }

  function hide() {
    if (!_map || !_visible) return;
    _map.removeLayer(_layer);
    _visible = false;
    Legend.remove('air');
  }

  function _renderLegend() {
    Legend.render('air', {
      title: 'Air Quality (AQI)',
      subtitle: 'ERG/KCL London Air — live hourly',
      items: [
        { color: '#3cb371', label: 'Low (1–3)',        circle: true },
        { color: '#f0a500', label: 'Moderate (4–6)',   circle: true },
        { color: '#e67e22', label: 'High (7–9)',        circle: true },
        { color: '#c0392b', label: 'Very High (10)',    circle: true },
        { color: '#aaa',    label: 'No data',           circle: true },
      ],
      note: 'Active stations in target boroughs only.',
    });
  }

  return { init, show, hide, get _stations() { return _stations; } };
})();
