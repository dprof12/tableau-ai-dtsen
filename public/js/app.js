/**
 * Tableau AI DTSEN - Multi-Topic Insight Extension
 * Interactive Pill Switcher & Smart In-Memory Caching
 */

// Application State
const state = {
  dashboard: null,
  availableWorksheets: [],
  filterUnregisterHandlers: [],
  debounceTimer: null,
  debounceDelayMs: 500,
  activeAbortController: null,
  isTableauEnvironment: false,
  language: 'id',
  activeTopic: 'overview',
  cachedInsights: {}, // { overview: '', desil: '', wilayah: '', integrasi: '', anggaran: '', temuan: '' }
  isGenerating: false
};

// DOM Elements
const elements = {
  pillsToolbar: document.getElementById('pillsToolbar'),
  pills: document.querySelectorAll('.topic-pill'),
  loadingView: document.getElementById('loadingView'),
  loadingHint: document.getElementById('loadingHint'),
  insightView: document.getElementById('insightView'),
  errorView: document.getElementById('errorView'),
  errorMessage: document.getElementById('errorMessage')
};

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initTopicPillListeners();
  initTableauExtension();
});

/**
 * 1. Initialize Topic Pill Button Click Listeners
 */
function initTopicPillListeners() {
  elements.pills.forEach(pill => {
    pill.addEventListener('click', () => {
      const selectedTopic = pill.getAttribute('data-topic');
      if (selectedTopic === state.activeTopic && !state.isGenerating) {
        return;
      }
      switchTopic(selectedTopic);
    });
  });
}

/**
 * Switch Active Topic Pill with Instant Render from Memory Cache
 */
function switchTopic(newTopic) {
  state.activeTopic = newTopic;

  // Update UI Pills styling
  elements.pills.forEach(p => {
    const isCurrent = p.getAttribute('data-topic') === newTopic;
    p.classList.toggle('active', isCurrent);
    p.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
  });

  // If insight for this topic is already in memory cache, render instantly (0ms lag!)
  if (state.cachedInsights[newTopic]) {
    renderInsightMarkdown(state.cachedInsights[newTopic]);
  } else if (!state.isGenerating) {
    // If cache not present, re-trigger analysis
    triggerDataExtractionAndAnalysis();
  }
}

/**
 * 2. Initialize Tableau Extensions SDK
 */
function initTableauExtension() {
  if (typeof tableau !== 'undefined' && tableau.extensions && tableau.extensions.initializeAsync) {
    tableau.extensions.initializeAsync().then(() => {
      state.isTableauEnvironment = true;
      state.dashboard = tableau.extensions.dashboardContent.dashboard;
      state.availableWorksheets = state.dashboard.worksheets || [];

      console.log('[Tableau AI DTSEN] Connected to Dashboard:', state.dashboard.name);
      detectDashboardLanguage();
      attachAllEventListeners();
      
      // Initial Multi-Topic Insight Generation
      triggerDataExtractionAndAnalysis();

    }).catch((err) => {
      console.error('[Tableau AI DTSEN] initializeAsync error:', err);
      setupBrowserPreviewMode();
    });
  } else {
    setupBrowserPreviewMode();
  }
}

/**
 * Fallback Browser Preview Mode (When opened directly in Chrome/Safari)
 */
function setupBrowserPreviewMode() {
  state.isTableauEnvironment = false;
  detectDashboardLanguage();
  triggerDataExtractionAndAnalysis();
}

/**
 * 3. Attach Filter & Parameter Listeners Across All Worksheets
 */
function attachAllEventListeners() {
  state.filterUnregisterHandlers.forEach(unregister => {
    try { unregister(); } catch (e) {}
  });
  state.filterUnregisterHandlers = [];

  // Listen to Filter & Selection changes on ALL worksheets
  state.availableWorksheets.forEach(ws => {
    try {
      const unregFilter = ws.addEventListener(
        tableau.TableauEventType.FilterChanged,
        onTableauFilterChanged
      );
      state.filterUnregisterHandlers.push(unregFilter);

      const unregSelection = ws.addEventListener(
        tableau.TableauEventType.MarkSelectionChanged,
        onTableauFilterChanged
      );
      state.filterUnregisterHandlers.push(unregSelection);
    } catch (e) {
      console.warn('[Tableau AI DTSEN] Listener warning on worksheet:', ws.name, e);
    }
  });

  // Listen to Parameter changes on the Dashboard (if any)
  if (state.dashboard && state.dashboard.getParametersAsync) {
    state.dashboard.getParametersAsync().then(params => {
      params.forEach(param => {
        try {
          const unregParam = param.addEventListener(
            tableau.TableauEventType.ParameterChanged,
            onTableauFilterChanged
          );
          state.filterUnregisterHandlers.push(unregParam);
        } catch (e) {}
      });
    }).catch(() => {});
  }
}

/**
 * 4. Debounced Filter/Parameter Changed Handler
 */
function onTableauFilterChanged() {
  clearTimeout(state.debounceTimer);
  
  const isEn = state.language === 'en';
  setLoadingState(true, isEn ? 'Updating DTSEN data...' : 'Memperbarui data DTSEN...');

  state.debounceTimer = setTimeout(() => {
    // Reset cache for new filter state
    state.cachedInsights = {};
    triggerDataExtractionAndAnalysis();
  }, state.debounceDelayMs);
}

/**
 * 5. Extract Data from Worksheet(s) & Fetch Multi-Topic AI Insights
 */
async function triggerDataExtractionAndAnalysis() {
  // Abort any ongoing fetch request
  if (state.activeAbortController) {
    state.activeAbortController.abort();
  }
  state.activeAbortController = new AbortController();
  const currentSignal = state.activeAbortController.signal;

  state.isGenerating = true;
  setLoadingState(true);

  try {
    let payload = {};

    if (state.isTableauEnvironment && state.dashboard) {
      const combinedSheetsData = [];
      let totalDataRows = 0;
      const allAppliedFilters = [];

      for (const ws of state.availableWorksheets) {
        try {
          const summaryData = await ws.getSummaryDataAsync({ maxRows: 100 });
          const wsFilters = await ws.getFiltersAsync();

          const columns = summaryData.columns.map(c => c.fieldName);
          const rows = summaryData.data.map(r => {
            return r.map((cell, colIdx) => {
              let val = (cell.formattedValue !== undefined && cell.formattedValue !== null && cell.formattedValue !== '') 
                ? cell.formattedValue 
                : cell.value;
              
              // Percentage normalization
              const colName = (columns[colIdx] || '').toLowerCase();
              if (
                typeof val === 'number' || 
                (typeof val === 'string' && /^-?\d+([.,]\d+)?$/.test(val.trim()))
              ) {
                const num = typeof val === 'number' ? val : parseFloat(val.replace(',', '.'));
                if (
                  (colName.includes('persen') || colName.includes('percent') || colName.includes('rate') || colName.includes('rasio') || colName.includes('ratio')) &&
                  !String(val).includes('%')
                ) {
                  const isEn = state.language === 'en';
                  const percentValue = Math.abs(num) <= 1.0 ? (num * 100) : num;
                  const formattedPercent = percentValue.toFixed(2);
                  val = isEn ? `${formattedPercent}%` : `${formattedPercent.replace('.', ',')}%`;
                }
              }
              return val;
            });
          });

          totalDataRows += rows.length;

          wsFilters.forEach(f => {
            if (f.appliedValues && f.appliedValues.length > 0) {
              const filterValues = f.appliedValues.map(v => v.formattedValue || v.value);
              allAppliedFilters.push({
                worksheet: ws.name,
                fieldName: f.fieldName,
                appliedValues: filterValues
              });
            }
          });

          combinedSheetsData.push({
            worksheetName: ws.name,
            columns: columns,
            rows: rows
          });
        } catch (err) {
          console.warn(`[Tableau AI DTSEN] Could not read worksheet ${ws.name}:`, err);
        }
      }

      payload = {
        dashboardName: state.dashboard.name || 'Executive Dashboard DTSEN',
        totalRows: totalDataRows,
        appliedFilters: allAppliedFilters,
        sheetsData: combinedSheetsData,
        language: state.language,
        activeTopic: state.activeTopic
      };

    } else {
      payload = getDemoDtsenPayload();
    }

    // Send POST to Serverless API Endpoint with silent auto-retry
    const result = await fetchWithRetry('/api/generate-dtsen-insight', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: currentSignal
    }, 2, 1500);

    state.isGenerating = false;

    // Save insights dictionary in memory cache
    if (result.insights && typeof result.insights === 'object') {
      state.cachedInsights = result.insights;
    } else if (result.insight) {
      // Fallback single insight
      state.cachedInsights[state.activeTopic] = result.insight;
    }

    // Render insight for current active topic
    const currentText = state.cachedInsights[state.activeTopic] || result.insight || '*(Insight tidak tersedia untuk topik ini)*';
    renderInsightMarkdown(currentText);
    setLoadingState(false);

  } catch (error) {
    state.isGenerating = false;
    if (error.name === 'AbortError') {
      return;
    }
    console.error('[Tableau AI DTSEN] Error generating insight:', error);
    const isEn = state.language === 'en';
    
    let userFriendlyError = error.message;
    if (
      !userFriendlyError || 
      userFriendlyError.includes('Failed to fetch') || 
      userFriendlyError.includes('NetworkError') ||
      userFriendlyError.includes('Transient server error') ||
      userFriendlyError.includes('Load failed')
    ) {
      userFriendlyError = isEn
        ? 'Insight service is busy or connection was interrupted. Please adjust filters again.'
        : 'Layanan insight sedang sibuk atau koneksi tidak stabil. Silakan geser filter kembali.';
    }

    showError(userFriendlyError);
  }
}

/**
 * Resilient Fetch with Silent Auto-Retry
 */
async function fetchWithRetry(url, options, maxRetries = 2, delayMs = 1500) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok && [502, 503, 504].includes(response.status) && attempt < maxRetries) {
        throw new Error(`Transient server error: ${response.status}`);
      }

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || `Server error: ${response.status}`);
      }
      return result;
    } catch (err) {
      if (err.name === 'AbortError' || (options.signal && options.signal.aborted)) {
        throw err;
      }

      attempt++;
      if (attempt > maxRetries) {
        throw err;
      }

      console.warn(`[Tableau AI DTSEN] Request attempt ${attempt}/${maxRetries} failed. Retrying...`, err);
      
      const isEn = state.language === 'en';
      const retryMsg = isEn 
        ? 'Reconnecting insight service...' 
        : 'Koneksi terputus sesaat, mencoba menghubungkan ulang...';
      setLoadingState(true, retryMsg);

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * 6. Render Markdown to DOM
 */
function renderInsightMarkdown(markdownText) {
  hideAllViews();
  elements.insightView.classList.remove('hidden');

  let rendered = false;
  if (typeof marked !== 'undefined' && marked.parse) {
    try {
      elements.insightView.innerHTML = marked.parse(markdownText);
      rendered = true;
    } catch (e) {
      console.warn('[Tableau AI DTSEN] marked.parse failed, fallback to regex:', e);
    }
  }
  
  if (!rendered) {
    const html = markdownText
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '<p></p>')
      .replace(/\n/g, '<br>');
    elements.insightView.innerHTML = html;
  }
}

/**
 * 7. UI State Management
 */
function setLoadingState(isLoading, customMessage) {
  if (isLoading) {
    hideAllViews();
    elements.loadingView.classList.remove('hidden');
    
    if (elements.loadingHint) {
      elements.loadingHint.textContent = customMessage || (state.language === 'en' ? 'Analyzing and processing insight...' : 'Sedang menganalisis dan memproses insight...');
    }
  }
}

function showError(message) {
  hideAllViews();
  elements.errorView.classList.remove('hidden');
  elements.errorMessage.textContent = message;
}

function hideAllViews() {
  elements.loadingView.classList.add('hidden');
  elements.insightView.classList.add('hidden');
  elements.errorView.classList.add('hidden');
}

/**
 * Demo Mock Payload for Testing DTSEN Dashboard Outside Tableau
 */
function getDemoDtsenPayload() {
  return {
    dashboardName: 'Executive Dashboard DTSEN - Data Tahun 2025',
    totalRows: 24,
    appliedFilters: [
      { fieldName: 'Tahun', appliedValues: ['2025'] },
      { fieldName: 'Wilayah', appliedValues: ['Semua Wilayah'] }
    ],
    sheetsData: [
      {
        worksheetName: 'Key_Statistics',
        columns: ['Metrik', 'Jumlah Individu', 'Individu Penerima', 'Persen Individu', 'Jumlah Keluarga', 'Keluarga Penerima', 'Persen Keluarga'],
        rows: [
          ['Total Agregat', '10.014.402', '4.906.878', '49,00%', '3.438.683', '2.048.122', '59,56%']
        ]
      },
      {
        worksheetName: 'Distribusi_Desil',
        columns: ['Kelompok Desil', 'Total Individu', 'Penerima Program', 'Penetrasi (%)'],
        rows: [
          ['Desil 1', '953.400', '461.459', '48,40%'],
          ['Desil 2-4', '3.468.100', '1.972.296', '56,87%'],
          ['Desil 5-6', '3.048.400', '1.790.350', '58,73%'],
          ['Desil 7-10', '10.843.400', '4.706.058', '43,40%']
        ]
      },
      {
        worksheetName: 'Distribusi_Wilayah',
        columns: ['Wilayah', 'Total Penduduk', 'Penerima Program', 'Penetrasi (%)'],
        rows: [
          ['Jakarta Timur', '2.903.640', '1.323.754', '45,59%'],
          ['Jakarta Barat', '2.360.388', '1.243.090', '52,66%'],
          ['Jakarta Selatan', '2.074.390', '987.387', '47,60%'],
          ['Jakarta Utara', '1.696.736', '835.706', '49,25%'],
          ['Jakarta Pusat', '950.002', '502.303', '52,87%'],
          ['Kepulauan Seribu', '29.246', '14.638', '50,05%']
        ]
      },
      {
        worksheetName: 'Integrasi_Pola_Program',
        columns: ['Kategori', 'Jumlah Program', 'Penerima Individu', 'Pola Usia'],
        rows: [
          ['Penerima 1 Program', '1 Program', '4.331.434', 'Dominasi Usia Produktif (PDPEMDA) & Pelajar (KJP)'],
          ['Penerima 2 Program', '2 Program', '558.869', 'Irisan KJP + Bantuan Pangan'],
          ['Penerima 3 Program', '3 Program', '16.500', 'Keluarga Sangat Rentan (KJP + Pangan + KLJ)'],
          ['Penerima 4 Program', '4 Program', '75', 'Keluarga Multi-Bantuan Ekstrem']
        ]
      },
      {
        worksheetName: 'Alokasi_Anggaran_Bansos',
        columns: ['Nama Program', 'Jumlah Penerima', 'Alokasi Anggaran (Rp)'],
        rows: [
          ['KJP (Kartu Jakarta Pintar)', '776.789', 'Rp3.243.905.917.224'],
          ['PDPEMDA (Pangan Bersubsidi)', '4.305.718', 'Rp1.921.914.199.800'],
          ['KJMU (Mahasiswa Unggul)', '49.120', 'Rp305.091.000.000'],
          ['BPMS (Bantuan Masuk Sekolah)', '68.450', 'Rp88.226.055.140'],
          ['KLJ (Lansia Jakarta)', '157.127', 'Rp0'],
          ['KPDJ (Disabilitas Jakarta)', '21.400', 'Rp0']
        ]
      }
    ],
    language: state.language,
    activeTopic: state.activeTopic
  };
}

/**
 * 8. Language Detection & UI Localization Helpers
 */
function detectDashboardLanguage() {
  let lang = 'id';
  const url = window.location.href.toLowerCase();
  const enRegex = /(^|[^a-zA-Z])en($|[^a-zA-Z])/i;
  
  if (enRegex.test(url)) {
    lang = 'en';
  } else if (state.isTableauEnvironment && state.dashboard && state.dashboard.name) {
    const dbName = state.dashboard.name.toLowerCase();
    if (enRegex.test(dbName) || dbName.includes('english') || dbName.includes('dtsen executive')) {
      // Keep 'id' for DTSEN unless explicitly en
      if (dbName.includes('english')) lang = 'en';
    }
  }
  
  state.language = lang;
}
