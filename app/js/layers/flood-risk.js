/**
 * Flood Risk layer — Environment Agency, Open Government Licence.
 *
 * Two sub-layers (both HTTPS, no auth required):
 *
 * 1. Rivers & Sea — Flood Map for Planning (Flood Zones 2 & 3 combined)
 *    WMS: https://environment.data.gov.uk/geoservices/datasets/
 *         04532375-a198-476e-985e-0579a0a11b47/wms
 *    Layer: Flood_Zones_2_3_Rivers_and_Sea
 *    FZ3 (high, >1% annual): #394386 dark blue
 *    FZ2 (medium, 0.1–1%):   #9bcffb light blue
 *
 * 2. Surface Water — Risk of Flooding from Surface Water (RoFSW)
 *    WMS: https://environment.data.gov.uk/geoservices/datasets/
 *         b5aaa28d-6eb9-460e-8d6f-43caa71fbe0e/wms
 *    Layer: rofsw
 *    High:      #555b9d  Medium: #9a9fde
 *    Low:       #c3e0ff  Very low: #b0b3b4
 *
 * ⚠ Both services have MaxScaleDenominator=50000: tiles are blank below zoom ~12.
 */
const FloodRiskLayer = (() => {
  const RS_WMS_URL = 'https://environment.data.gov.uk/geoservices/datasets/' +
                     '04532375-a198-476e-985e-0579a0a11b47/wms';
  const SW_WMS_URL = 'https://environment.data.gov.uk/geoservices/datasets/' +
                     'b5aaa28d-6eb9-460e-8d6f-43caa71fbe0e/wms';

  const RS_LAYER = 'Flood_Zones_2_3_Rivers_and_Sea';
  const SW_LAYER = 'rofsw';

  const WMS_OPTS = {
    format:      'image/png',
    transparent: true,
    opacity:     0.65,
    version:     '1.3.0',
    attribution: '© <a href="https://www.gov.uk/government/organisations/environment-agency" target="_blank">Environment Agency</a> flood risk data, OGL v3',
  };

  // Legend definitions (colors extracted from WMS GetLegendGraphic)
  const LEGEND_RS = {
    title:    'Flood Risk — Rivers & Sea',
    subtitle: 'EA Flood Map for Planning (FZ2 & FZ3)',
    items: [
      { color: '#394386', label: 'Flood Zone 3 — High (>1% annual)' },
      { color: '#9bcffb', label: 'Flood Zone 2 — Medium (0.1–1% annual)' },
    ],
    note: 'Only visible at zoom 12+.',
  };

  const LEGEND_SW = {
    title:    'Flood Risk — Surface Water',
    subtitle: 'EA Risk of Flooding from Surface Water',
    items: [
      { color: '#555b9d', label: 'High risk' },
      { color: '#9a9fde', label: 'Medium risk' },
      { color: '#c3e0ff', label: 'Low risk' },
      { color: '#b0b3b4', label: 'Very low risk' },
    ],
    note: 'Only visible at zoom 12+.',
  };

  let _map        = null;
  let _rsLayer    = null;
  let _swLayer    = null;
  let _visible    = false;
  let _mode       = 'rs';  // 'rs' | 'sw' | 'both'

  // ---- helpers -------------------------------------------------------

  function _makeRS() {
    return L.tileLayer.wms(RS_WMS_URL, { ...WMS_OPTS, layers: RS_LAYER });
  }

  function _makeSW() {
    return L.tileLayer.wms(SW_WMS_URL, { ...WMS_OPTS, layers: SW_LAYER });
  }

  function _applyMode() {
    // Remove existing
    if (_rsLayer && _map.hasLayer(_rsLayer)) _map.removeLayer(_rsLayer);
    if (_swLayer && _map.hasLayer(_swLayer)) _map.removeLayer(_swLayer);
    Legend.remove('flood-rs');
    Legend.remove('flood-sw');

    if (_mode === 'rs' || _mode === 'both') {
      _rsLayer = _makeRS();
      _rsLayer.addTo(_map);
      Legend.render('flood-rs', LEGEND_RS);
    }
    if (_mode === 'sw' || _mode === 'both') {
      _swLayer = _makeSW();
      _swLayer.addTo(_map);
      Legend.render('flood-sw', LEGEND_SW);
    }
  }

  // ---- public API ----------------------------------------------------

  function init(map) {
    _map = map;
    _rsLayer = _makeRS();
    _rsLayer.addTo(_map);
    _visible = true;
    Legend.render('flood-rs', LEGEND_RS);
  }

  function show() {
    if (!_map || _visible) return;
    _visible = true;
    _applyMode();
  }

  function hide() {
    if (!_map || !_visible) return;
    if (_rsLayer && _map.hasLayer(_rsLayer)) _map.removeLayer(_rsLayer);
    if (_swLayer && _map.hasLayer(_swLayer)) _map.removeLayer(_swLayer);
    _visible = false;
    Legend.remove('flood-rs');
    Legend.remove('flood-sw');
  }

  function setMode(mode) {
    if (!['rs', 'sw', 'both'].includes(mode)) return;
    _mode = mode;
    if (_visible) _applyMode();
  }

  return { init, show, hide, setMode };
})();
