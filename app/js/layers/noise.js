/**
 * Noise layer — Defra END Round 3 WMS tiles.
 * No CORS issue: Leaflet WMS uses <img> tags.
 */
const NoiseLayer = (() => {
  const WMS_URL =
    'https://environment.data.gov.uk/spatialdata/' +
    'environmental-noise-directive-end-noise-mapping-agglomerations-england-round-3/wms';

  const LAYER_NAME =
    'Environmental_Noise_Directive_END_Noise_Mapping_Agglomerations_England_Round_3';

  const LEGEND_URL =
    `${WMS_URL}?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0` +
    `&LAYER=${encodeURIComponent(LAYER_NAME)}&FORMAT=image/png`;

  let _map = null;
  let _layer = null;
  let _visible = false;

  function init(map) {
    _map = map;
    _layer = L.tileLayer.wms(WMS_URL, {
      layers: LAYER_NAME,
      format: 'image/png',
      transparent: true,
      opacity: 0.5,
      version: '1.3.0',
      attribution: '© Defra END Round 3',
    });
    _layer.addTo(_map);
    _visible = true;
    _renderLegend();
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
    Legend.remove('noise');
  }

  function _renderLegend() {
    Legend.render('noise', {
      title: 'Noise (Defra END Round 3)',
      wmsLegendUrl: LEGEND_URL,
      note: 'Road, rail & industry noise contours (dB Lden).',
    });
  }

  return { init, show, hide };
})();
