/**
 * Deprivation layer — IMD 2019 choropleth from pre-bundled GeoJSON.
 * Exports DeprivationLayer._data for use by combined-score.js.
 */
const DeprivationLayer = (() => {
  const GEOJSON_URL = 'data/west-london-imd.geojson';

  // ColorBrewer RdYlGn-10: decile 1 (worst/most deprived) → dark red, 10 → dark green
  const DECILE_COLORS = [
    '#a50026', // 1 — most deprived
    '#d73027',
    '#f46d43',
    '#fdae61',
    '#fee08b',
    '#d9ef8b',
    '#a6d96a',
    '#66bd63',
    '#1a9850',
    '#006837', // 10 — least deprived
  ];

  let _map = null;
  let _layer = null;   // L.GeoJSON
  let _visible = false;
  let _data = [];      // array of { lsoa_code, imd_decile, imd_score, centroid: [lat,lng] }

  // ---- helpers -------------------------------------------------------

  function _decileColor(decile) {
    if (decile == null || decile < 1 || decile > 10) return '#ccc';
    return DECILE_COLORS[decile - 1];
  }

  function _escape(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function _buildPopup(props) {
    const decile = props.imd_decile;
    const color  = _decileColor(decile);
    return `
      <div class="popup-title">${_escape(props.lsoa_name)}</div>
      <table class="popup-table">
        <tr><td>Borough</td><td>${_escape(props.borough)}</td></tr>
        <tr><td>LSOA code</td><td>${_escape(props.lsoa_code)}</td></tr>
        <tr><td>IMD decile</td><td>
          <span class="popup-aqi-band" style="background:${color}">${decile != null ? decile : '—'} / 10</span>
        </td></tr>
        <tr><td>IMD score</td><td>${props.imd_score != null ? props.imd_score : '—'}</td></tr>
      </table>
      <p style="font-size:10px;color:#999;margin-top:5px">Decile 1 = most deprived, 10 = least deprived</p>
    `;
  }

  /**
   * Compute polygon centroid by averaging all ring coordinates.
   * Sufficient precision for LSOA-scale polygons.
   */
  function _centroid(geometry) {
    const coords = geometry.coordinates;
    let sumLat = 0, sumLng = 0, count = 0;

    function processRing(ring) {
      for (const [lng, lat] of ring) {
        sumLng += lng;
        sumLat += lat;
        count++;
      }
    }

    if (geometry.type === 'Polygon') {
      processRing(coords[0]);
    } else if (geometry.type === 'MultiPolygon') {
      for (const poly of coords) processRing(poly[0]);
    }

    if (count === 0) return null;
    return [sumLat / count, sumLng / count];
  }

  // ---- public API ----------------------------------------------------

  async function init(map) {
    _map = map;
    _renderLegend();

    try {
      const resp = await fetch(GEOJSON_URL);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const geojson = await resp.json();

      _layer = L.geoJSON(geojson, {
        style: feature => ({
          fillColor: _decileColor(feature.properties.imd_decile),
          fillOpacity: 0.6,
          color: '#666',
          weight: 0.5,
        }),
        onEachFeature: (feature, lyr) => {
          lyr.bindPopup(_buildPopup(feature.properties));
          lyr.on('mouseover', () => lyr.setStyle({ weight: 2, fillOpacity: 0.8 }));
          lyr.on('mouseout',  () => _layer.resetStyle(lyr));
        },
      });

      // Build _data array for combined score
      _data = geojson.features
        .filter(f => f.properties.imd_decile != null)
        .map(f => ({
          lsoa_code:  f.properties.lsoa_code,
          lsoa_name:  f.properties.lsoa_name,
          borough:    f.properties.borough,
          imd_decile: f.properties.imd_decile,
          imd_score:  f.properties.imd_score,
          centroid:   _centroid(f.geometry),
          geometry:   f.geometry,
        }));

      _layer.addTo(_map);
      _visible = true;
    } catch (err) {
      console.error('Deprivation layer failed:', err);
    }
  }

  function show() {
    if (!_map || _visible || !_layer) return;
    _layer.addTo(_map);
    _visible = true;
    _renderLegend();
  }

  function hide() {
    if (!_map || !_visible || !_layer) return;
    _map.removeLayer(_layer);
    _visible = false;
    Legend.remove('deprivation');
  }

  function _renderLegend() {
    Legend.render('deprivation', {
      title: 'Deprivation (IMD 2019)',
      subtitle: 'Index of Multiple Deprivation by LSOA',
      items: DECILE_COLORS.map((color, i) => ({
        color,
        label: i === 0 ? 'Decile 1 — most deprived'
             : i === 9 ? 'Decile 10 — least deprived'
             : `Decile ${i + 1}`,
      })),
    });
  }

  return {
    init,
    show,
    hide,
    get _data() { return _data; },
  };
})();
