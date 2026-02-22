/**
 * app.js — initialises the map and wires all layer toggles.
 */
(function () {
  // ---- Map init -------------------------------------------------------
  const map = L.map('map', {
    center: [51.4786, -0.2246],  // Putney/Hammersmith area
    zoom: 13,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // ---- Layer init (order matches script load order) -------------------
  AirQualityLayer.init(map);
  NoiseLayer.init(map);
  RoadNoiseLayer.init(map);
  FloodRiskLayer.init(map);
  DeprivationLayer.init(map);
  CombinedScoreLayer.init(map);

  // ---- Toggle wiring --------------------------------------------------
  const toggleAir         = document.getElementById('toggle-air');
  const toggleNoise       = document.getElementById('toggle-noise');
  const toggleRoadNoise   = document.getElementById('toggle-road-noise');
  const toggleFlood       = document.getElementById('toggle-flood');
  const toggleDeprivation = document.getElementById('toggle-deprivation');
  const toggleCombined    = document.getElementById('toggle-combined');
  const roadNoiseSub      = document.getElementById('road-noise-sub');
  const floodSub          = document.getElementById('flood-sub');

  // Track which individual layers were visible when combined was switched on,
  // so we can restore them when combined is switched off.
  let _stateBeforeCombined = null;

  function _setIndividualLayersVisible(airOn, noiseOn, roadNoiseOn, floodOn, depOn) {
    if (airOn)       AirQualityLayer.show();  else AirQualityLayer.hide();
    if (noiseOn)     NoiseLayer.show();       else NoiseLayer.hide();
    if (roadNoiseOn) RoadNoiseLayer.show();   else RoadNoiseLayer.hide();
    if (floodOn)     FloodRiskLayer.show();   else FloodRiskLayer.hide();
    if (depOn)       DeprivationLayer.show(); else DeprivationLayer.hide();
  }

  toggleAir.addEventListener('change', () => {
    if (toggleCombined.checked) return;
    if (toggleAir.checked) AirQualityLayer.show();
    else                   AirQualityLayer.hide();
  });

  toggleNoise.addEventListener('change', () => {
    if (toggleCombined.checked) return;
    if (toggleNoise.checked) NoiseLayer.show();
    else                     NoiseLayer.hide();
  });

  toggleRoadNoise.addEventListener('change', () => {
    if (toggleCombined.checked) return;
    if (toggleRoadNoise.checked) {
      RoadNoiseLayer.show();
      roadNoiseSub.classList.remove('hidden');
    } else {
      RoadNoiseLayer.hide();
      roadNoiseSub.classList.add('hidden');
    }
  });

  // Road noise metric sub-selector
  document.querySelectorAll('input[name="road-noise-metric"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) RoadNoiseLayer.setMetric(radio.value);
    });
  });

  toggleFlood.addEventListener('change', () => {
    if (toggleCombined.checked) return;
    if (toggleFlood.checked) {
      FloodRiskLayer.show();
      floodSub.classList.remove('hidden');
    } else {
      FloodRiskLayer.hide();
      floodSub.classList.add('hidden');
    }
  });

  document.querySelectorAll('input[name="flood-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) FloodRiskLayer.setMode(radio.value);
    });
  });

  toggleDeprivation.addEventListener('change', () => {
    if (toggleCombined.checked) return;
    if (toggleDeprivation.checked) DeprivationLayer.show();
    else                           DeprivationLayer.hide();
  });

  toggleCombined.addEventListener('change', () => {
    if (toggleCombined.checked) {
      // Save individual layer state, then hide them all
      _stateBeforeCombined = {
        air:       toggleAir.checked,
        noise:     toggleNoise.checked,
        roadNoise: toggleRoadNoise.checked,
        flood:     toggleFlood.checked,
        dep:       toggleDeprivation.checked,
      };
      AirQualityLayer.hide();
      NoiseLayer.hide();
      RoadNoiseLayer.hide();
      FloodRiskLayer.hide();
      DeprivationLayer.hide();
      CombinedScoreLayer.show();
    } else {
      // Hide combined, restore individual layers
      CombinedScoreLayer.hide();
      if (_stateBeforeCombined) {
        _setIndividualLayersVisible(
          _stateBeforeCombined.air,
          _stateBeforeCombined.noise,
          _stateBeforeCombined.roadNoise,
          _stateBeforeCombined.flood,
          _stateBeforeCombined.dep
        );
        toggleAir.checked         = _stateBeforeCombined.air;
        toggleNoise.checked       = _stateBeforeCombined.noise;
        toggleRoadNoise.checked   = _stateBeforeCombined.roadNoise;
        toggleFlood.checked       = _stateBeforeCombined.flood;
        toggleDeprivation.checked = _stateBeforeCombined.dep;
        roadNoiseSub.classList.toggle('hidden', !_stateBeforeCombined.roadNoise);
        floodSub.classList.toggle('hidden', !_stateBeforeCombined.flood);
        _stateBeforeCombined = null;
      } else {
        AirQualityLayer.show();
        NoiseLayer.show();
        RoadNoiseLayer.show();
        FloodRiskLayer.show();
        DeprivationLayer.show();
      }
    }
  });
})();
