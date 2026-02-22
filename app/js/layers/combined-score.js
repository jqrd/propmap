/**
 * Combined Score layer — per-LSOA composite of air quality, noise, deprivation.
 *
 * Weights:
 *   40% deprivation: (11 - imd_decile) / 10  →  decile 1 (worst) = 1.0
 *   40% air quality: nearest station maxAQI / 10
 *   20% noise:       neutral 0.5 (WMS not per-LSOA queryable)
 *
 * Score ranges 0 (best) → 1 (worst).
 * Colour: green → yellow → red.
 */
const CombinedScoreLayer = (() => {
  // Green → yellow → red gradient stops
  const COLOR_STOPS = [
    { t: 0.0,  r: 44,  g: 160, b: 44  }, // green
    { t: 0.25, r: 143, g: 188, b: 50  },
    { t: 0.5,  r: 240, g: 165, b: 0   }, // yellow-orange
    { t: 0.75, r: 220, g: 90,  b: 30  },
    { t: 1.0,  r: 180, g: 30,  b: 30  }, // red
  ];

  let _map = null;
  let _layer = null;
  let _visible = false;

  // ---- colour interpolation ------------------------------------------

  function _lerp(a, b, t) { return Math.round(a + (b - a) * t); }

  function _scoreColor(score) {
    const s = Math.max(0, Math.min(1, score));
    let lo = COLOR_STOPS[0];
    let hi = COLOR_STOPS[COLOR_STOPS.length - 1];
    for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
      if (s >= COLOR_STOPS[i].t && s <= COLOR_STOPS[i + 1].t) {
        lo = COLOR_STOPS[i];
        hi = COLOR_STOPS[i + 1];
        break;
      }
    }
    const span = hi.t - lo.t || 1;
    const t = (s - lo.t) / span;
    const r = _lerp(lo.r, hi.r, t);
    const g = _lerp(lo.g, hi.g, t);
    const b = _lerp(lo.b, hi.b, t);
    return `rgb(${r},${g},${b})`;
  }

  // ---- haversine nearest-station -------------------------------------

  function _haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function _nearestStation(lat, lng, stations) {
    let best = null;
    let bestDist = Infinity;
    for (const [code, st] of Object.entries(stations)) {
      const d = _haversine(lat, lng, st.lat, st.lng);
      if (d < bestDist) { bestDist = d; best = st; }
    }
    return best;
  }

  // ---- popup ---------------------------------------------------------

  function _escape(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function _buildPopup(lsoa, score, depComp, aqComp, noiseComp, nearestSt) {
    const pct = (v) => (v * 100).toFixed(0) + '%';
    return `
      <div class="popup-title">${_escape(lsoa.lsoa_name)}</div>
      <table class="popup-table">
        <tr><td>Borough</td><td>${_escape(lsoa.borough)}</td></tr>
        <tr><td>Combined score</td><td><strong>${score.toFixed(2)} / 1.00</strong></td></tr>
        <tr><td colspan="2" style="padding-top:5px;font-weight:600;color:#666;font-size:11px">COMPONENTS</td></tr>
        <tr><td>Deprivation (40%)</td><td>${pct(depComp)} <span style="color:#999;font-size:10px">(IMD decile ${lsoa.imd_decile})</span></td></tr>
        <tr><td>Air quality (40%)</td><td>${pct(aqComp)} <span style="color:#999;font-size:10px">${nearestSt ? '(' + _escape(nearestSt.name) + ')' : '(no data)'}</span></td></tr>
        <tr><td>Noise (20%)</td><td>${pct(noiseComp)} <span style="color:#999;font-size:10px">(neutral — WMS only)</span></td></tr>
      </table>
    `;
  }

  // ---- layer build ---------------------------------------------------

  function _buildLayer() {
    const stations = AirQualityLayer._stations;
    const lsoaData = DeprivationLayer._data;

    const hasStations = Object.keys(stations).length > 0;

    const features = lsoaData.map(lsoa => {
      // Deprivation component: decile 1 (worst) → 1.0, decile 10 → 0.1
      const depComp = lsoa.imd_decile != null
        ? (11 - lsoa.imd_decile) / 10
        : 0.5;

      // Air quality component: nearest station AQI / 10
      let aqComp = 0.5; // neutral fallback
      let nearestSt = null;
      if (hasStations && lsoa.centroid) {
        const [lat, lng] = lsoa.centroid;
        nearestSt = _nearestStation(lat, lng, stations);
        if (nearestSt && nearestSt.maxAQI != null) {
          aqComp = Math.min(nearestSt.maxAQI / 10, 1);
        }
      }

      // Noise: neutral
      const noiseComp = 0.5;

      const score = 0.4 * depComp + 0.4 * aqComp + 0.2 * noiseComp;

      return { lsoa, score, depComp, aqComp, noiseComp, nearestSt };
    });

    const group = L.layerGroup();

    for (const { lsoa, score, depComp, aqComp, noiseComp, nearestSt } of features) {
      if (!lsoa.geometry) continue;
      const layer = L.geoJSON({ type: 'Feature', geometry: lsoa.geometry }, {
        style: {
          fillColor: _scoreColor(score),
          fillOpacity: 0.7,
          color: '#555',
          weight: 0.5,
        },
      });
      layer.bindPopup(_buildPopup(lsoa, score, depComp, aqComp, noiseComp, nearestSt));
      layer.on('mouseover', () => layer.setStyle({ weight: 2, fillOpacity: 0.9 }));
      layer.on('mouseout',  () => layer.setStyle({ weight: 0.5, fillOpacity: 0.7 }));
      group.addLayer(layer);
    }

    return group;
  }

  // ---- legend --------------------------------------------------------

  function _renderLegend() {
    Legend.render('combined', {
      title: 'Combined Environment Score',
      subtitle: '0 = best environment, 1 = worst',
      items: [
        { color: _scoreColor(0.0),  label: '0.0 — least concern' },
        { color: _scoreColor(0.25), label: '0.25' },
        { color: _scoreColor(0.5),  label: '0.5 — moderate' },
        { color: _scoreColor(0.75), label: '0.75' },
        { color: _scoreColor(1.0),  label: '1.0 — most concern' },
      ],
      note: '40% deprivation · 40% air quality · 20% noise (neutral)',
    });
  }

  // ---- public API ----------------------------------------------------

  function init(map) {
    _map = map;
    // Layer built on demand (needs other layers loaded first)
  }

  function show() {
    if (!_map || _visible) return;
    _layer = _buildLayer();
    _layer.addTo(_map);
    _visible = true;
    _renderLegend();
  }

  function hide() {
    if (!_map || !_visible) return;
    if (_layer) _map.removeLayer(_layer);
    _layer = null;
    _visible = false;
    Legend.remove('combined');
  }

  return { init, show, hide };
})();
