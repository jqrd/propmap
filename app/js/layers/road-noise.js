/**
 * Road Noise layer — Defra END Round 3, served via Extrium GeoServer WMS.
 *
 * Source: http://wms.extrium.co.uk/geoserver/NoiseE/wms  (HTTP only — no HTTPS)
 * Layers:
 *   NoiseE:RD_LDEN_R3   — Road Lden (day-evening-night weighted, default)
 *   NoiseE:RD_LQ16_R3   — Road LAeq,16h (daytime equivalent)
 *   NoiseE:RD_LNGT_R3   — Road Lnight
 *
 * Colors are extracted directly from GeoServer's SLD for RD_LDEN_R3:
 *   #ff6600  55–60 dB
 *   #ff3333  60–65 dB
 *   #990033  65–70 dB
 *   #ad9ad6  70–75 dB
 *   #0000e0  ≥75 dB
 */
const RoadNoiseLayer = (() => {
  const WMS_URL = 'http://wms.extrium.co.uk/geoserver/NoiseE/wms';
  const NAMESPACE = 'NoiseE';

  const METRICS = {
    RD_LDEN_R3:  'Lden (day-evening-night)',
    RD_LQ16_R3:  'LAeq,16h (daytime)',
    RD_LNGT_R3:  'Lnight',
  };

  // Colors extracted from Extrium GeoServer SLD (ascending noise level)
  const BANDS = [
    { color: '#ff6600', label: '55–60 dB' },
    { color: '#ff3333', label: '60–65 dB' },
    { color: '#990033', label: '65–70 dB' },
    { color: '#ad9ad6', label: '70–75 dB' },
    { color: '#0000e0', label: '≥75 dB'   },
  ];

  let _map     = null;
  let _layer   = null;
  let _visible = false;
  let _metric  = 'RD_LDEN_R3';

  function _makeLayer(layerName) {
    return L.tileLayer.wms(WMS_URL, {
      layers:      `${NAMESPACE}:${layerName}`,
      format:      'image/png',
      transparent: true,
      opacity:     0.7,
      version:     '1.1.1',
      attribution: 'Road noise © Defra END Round 3 via <a href="http://extrium.co.uk/noiseviewer.html" target="_blank">Extrium</a>',
    });
  }

  function _renderLegend() {
    const metricLabel = METRICS[_metric] || _metric;
    Legend.render('road-noise', {
      title:    `Road Noise — ${metricLabel}`,
      subtitle: 'Defra END Round 3 · Average dB',
      items:    BANDS.map(b => ({ color: b.color, label: b.label })),
      note:     'Tiles: Extrium GeoServer (http). Data: Defra END Round 3.',
    });
  }

  // ---- public API ----------------------------------------------------

  function init(map) {
    _map = map;
    _layer = _makeLayer(_metric);
    _layer.addTo(_map);
    _visible = true;
    _renderLegend();
  }

  function show() {
    if (!_map || _visible) return;
    _layer = _makeLayer(_metric);
    _layer.addTo(_map);
    _visible = true;
    _renderLegend();
  }

  function hide() {
    if (!_map || !_visible) return;
    _map.removeLayer(_layer);
    _layer = null;
    _visible = false;
    Legend.remove('road-noise');
  }

  /** Switch to a different noise metric (Lden / LAeq,16h / Lnight). */
  function setMetric(layerName) {
    if (!METRICS[layerName]) return;
    _metric = layerName;
    if (_visible && _layer) {
      _map.removeLayer(_layer);
      _layer = _makeLayer(_metric);
      _layer.addTo(_map);
      _renderLegend();
    }
  }

  return { init, show, hide, setMetric };
})();
