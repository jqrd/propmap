/**
 * Legend utility — renders keyed legend panels into #legend-container.
 *
 * Usage:
 *   Legend.render('air', { title: 'Air Quality', items: [{color, label}, …] })
 *   Legend.render('noise', { title: 'Noise', wmsLegendUrl: '…', note: '…' })
 *   Legend.remove('air')
 *
 * Config shape:
 *   {
 *     title:        string,
 *     subtitle:     string (optional),
 *     items:        [{ color, label, circle? }] (optional),
 *     wmsLegendUrl: string (optional),
 *     note:         string (optional),
 *   }
 */
const Legend = (() => {
  const container = document.getElementById('legend-container');

  function _panelId(key) {
    return `legend-panel-${key}`;
  }

  function render(key, config) {
    remove(key);

    const panel = document.createElement('div');
    panel.className = 'legend-panel';
    panel.id = _panelId(key);

    // Title
    if (config.title) {
      const h3 = document.createElement('h3');
      h3.textContent = config.title;
      panel.appendChild(h3);
    }

    // Subtitle
    if (config.subtitle) {
      const sub = document.createElement('p');
      sub.className = 'legend-subtitle';
      sub.textContent = config.subtitle;
      panel.appendChild(sub);
    }

    // Swatch items
    if (config.items && config.items.length) {
      const list = document.createElement('div');
      list.className = 'legend-items';
      for (const item of config.items) {
        const row = document.createElement('div');
        row.className = 'legend-item';

        const swatch = document.createElement('span');
        swatch.className = 'legend-swatch' + (item.circle ? ' circle' : '');
        swatch.style.background = item.color;
        row.appendChild(swatch);

        const label = document.createElement('span');
        label.textContent = item.label;
        row.appendChild(label);

        list.appendChild(row);
      }
      panel.appendChild(list);
    }

    // WMS legend image
    if (config.wmsLegendUrl) {
      const img = document.createElement('img');
      img.className = 'legend-img';
      img.src = config.wmsLegendUrl;
      img.alt = 'Legend';
      img.onerror = () => { img.style.display = 'none'; };
      panel.appendChild(img);
    }

    // Note
    if (config.note) {
      const note = document.createElement('p');
      note.className = 'legend-note';
      note.textContent = config.note;
      panel.appendChild(note);
    }

    container.appendChild(panel);
  }

  function remove(key) {
    const existing = document.getElementById(_panelId(key));
    if (existing) existing.remove();
  }

  return { render, remove };
})();
