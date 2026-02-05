// Tab management
let tabs = [];
let activeTabId = null;
let tabIdCounter = 0;

// Search engines configuration
const SEARCH_ENGINES = {
  duckduckgo: {
    name: 'DuckDuckGo',
    iconPath: 'assets/icons/duckduckgo.svg',
    searchUrl: 'https://duckduckgo.com/?q=',
    homeUrl: 'https://duckduckgo.com'
  },
  google: {
    name: 'Google',
    iconPath: 'assets/icons/google.svg',
    searchUrl: 'https://www.google.com/search?q=',
    homeUrl: 'https://www.google.com'
  },
  bing: {
    name: 'Bing',
    iconPath: 'assets/icons/bing.ico',
    searchUrl: 'https://www.bing.com/search?q=',
    homeUrl: 'https://www.bing.com'
  },
  yahoo: {
    name: 'Yahoo',
    iconPath: 'assets/icons/yahoo.ico',
    searchUrl: 'https://search.yahoo.com/search?p=',
    homeUrl: 'https://www.yahoo.com'
  },
  brave: {
    name: 'Brave',
    iconPath: 'assets/icons/brave.svg',
    searchUrl: 'https://search.brave.com/search?q=',
    homeUrl: 'https://search.brave.com'
  },
  ecosia: {
    name: 'Ecosia',
    iconPath: 'assets/icons/ecosia.svg',
    searchUrl: 'https://www.ecosia.org/search?q=',
    homeUrl: 'https://www.ecosia.org'
  }
};

function safeGetStorage(key, fallbackValue) {
  try {
    const value = localStorage.getItem(key);
    return value || fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

function safeSetStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // Ignore storage errors in restricted contexts.
  }
}

// Default search engine (DuckDuckGo)
let currentSearchEngine = safeGetStorage('searchEngine', 'duckduckgo');
const HOME_URL = SEARCH_ENGINES[currentSearchEngine].homeUrl;

// DOM elements
const tabsContainer = document.getElementById('tabs-container');
const webviewContainer = document.getElementById('webview-container');
const { ipcRenderer } = require('electron');

ipcRenderer.send('ui-debug', 'renderer loaded');
window.addEventListener('click', () => {
  ipcRenderer.send('ui-debug', 'renderer click');
});

const urlInput = document.getElementById('url-input');
const newTabBtn = document.getElementById('new-tab-btn');
const securityIcon = document.getElementById('security-icon');
const searchEngineBtn = document.getElementById('search-engine-btn');
const searchEngineIcon = document.getElementById('search-engine-icon');
const searchEngineDropdown = document.getElementById('search-engine-dropdown');
const downloadShelf = document.getElementById('download-shelf');
const downloadList = document.getElementById('download-list');
const downloadHistoryList = document.getElementById('download-history-list');
const toolbar = document.querySelector('.toolbar');
const downloadToggleBtn = toolbar ? toolbar.querySelector('[data-action="downloads"]') : null;
const menuToggleBtn = toolbar ? toolbar.querySelector('[data-action="menu"]') : null;
const appMenu = document.getElementById('app-menu');
const menuPanels = appMenu ? appMenu.querySelectorAll('.menu-panel') : [];
const themeToggleBtn = appMenu ? appMenu.querySelector('[data-action="toggle-theme"]') : null;
const backBtn = toolbar ? toolbar.querySelector('[data-action="back"]') : null;
const forwardBtn = toolbar ? toolbar.querySelector('[data-action="forward"]') : null;
const refreshBtn = toolbar ? toolbar.querySelector('[data-action="refresh"]') : null;
const homeBtn = toolbar ? toolbar.querySelector('[data-action="home"]') : null;
const downloadsById = new Map();
const dismissedDownloadIds = new Set();
const DOWNLOAD_HISTORY_KEY = 'downloadHistory';
const DOWNLOAD_HISTORY_LIMIT = 40;
let downloadHistory = [];
const THEME_KEY = 'theme';
let currentTheme = safeGetStorage(THEME_KEY, 'dark');

// Initialize browser
function init() {
  // Set initial search engine
  updateSearchEngineUI();

  applyTheme(currentTheme);
  updateThemeToggle();
  
  // Create first tab
  createTab(SEARCH_ENGINES[currentSearchEngine].homeUrl);
  
  // Setup event listeners
  setupEventListeners();

  setupDownloadShelf();
  loadDownloadHistory();
}

// Setup all event listeners
function setupEventListeners() {
  newTabBtn.addEventListener('click', () => createTab(SEARCH_ENGINES[currentSearchEngine].homeUrl));
  
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      navigateToUrl();
    }
  });
  
  urlInput.addEventListener('focus', () => {
    urlInput.select();
  });
  
  // Toolbar action handling (robust event delegation)
  if (toolbar) {
    toolbar.addEventListener('click', (e) => {
      const actionButton = e.target.closest('[data-action]');
      if (!actionButton) return;
      
      const action = actionButton.dataset.action;
      if (!action) return;

      ipcRenderer.send('ui-debug', `toolbar action: ${action}`);
      
      switch (action) {
        case 'back':
          navigateBack();
          break;
        case 'forward':
          navigateForward();
          break;
        case 'refresh':
          reloadPage();
          break;
        case 'home':
          navigateToHome();
          break;
        case 'go':
          navigateToUrl();
          break;
        case 'engine':
          toggleSearchEngineDropdown();
          break;
        case 'menu':
          toggleAppMenu();
          break;
        case 'downloads':
          toggleDownloadShelf();
          break;
        default:
          break;
      }
    });
  }
  
  // Search engine selector
  if (searchEngineBtn && searchEngineDropdown) {
    document.addEventListener('click', (e) => {
      const clickedInside = searchEngineDropdown.contains(e.target) || searchEngineBtn.contains(e.target);
      if (!clickedInside) {
        searchEngineDropdown.classList.remove('active');
      }
    });
    
    document.querySelectorAll('.search-engine-option').forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const engine = option.dataset.engine;
        setSearchEngine(engine);
        searchEngineDropdown.classList.remove('active');
      });
    });
  }

  if (appMenu && menuToggleBtn) {
    document.addEventListener('click', (e) => {
      const clickedInside = appMenu.contains(e.target) || menuToggleBtn.contains(e.target);
      if (!clickedInside) {
        closeAppMenu();
      }
    });

    window.addEventListener('resize', () => {
      if (appMenu.classList.contains('active')) {
        positionAppMenu();
      }
    });

    appMenu.addEventListener('click', (event) => {
      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;

      const action = actionButton.dataset.action;
      if (action === 'menu-history') {
        openDownloadHistory();
        closeAppMenu();
      }

      if (action === 'menu-settings') {
        setMenuPanel('settings');
      }

      if (action === 'menu-back') {
        setMenuPanel('main');
      }

      if (action === 'toggle-theme') {
        toggleTheme();
      }
    });
  }
}

function setupDownloadShelf() {
  if (!downloadShelf || !downloadList || !downloadHistoryList) return;

  ipcRenderer.on('download-item', (event, payload) => {
    updateDownloadItem(payload);
  });

  downloadShelf.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;

    const action = actionButton.dataset.action;
    if (action === 'clear-downloads') {
      downloadsById.clear();
      dismissedDownloadIds.clear();
      downloadHistory = [];
      saveDownloadHistory();
      downloadList.innerHTML = '';
      downloadHistoryList.innerHTML = '';
      downloadShelf.classList.remove('active');
      updateDownloadBadge();
      return;
    }

    const itemElement = actionButton.closest('.download-item');
    if (!itemElement) return;

    const downloadId = itemElement.dataset.downloadId;
    const download = downloadsById.get(downloadId);
    if (!download) return;

    if (action === 'open-download') {
      ipcRenderer.send('download-open', { path: download.savePath });
    }

    if (action === 'show-download') {
      ipcRenderer.send('download-show', { path: download.savePath });
    }

    if (action === 'cancel-download') {
      dismissedDownloadIds.add(download.id);
      ipcRenderer.send('download-cancel', { id: download.id });
      downloadsById.delete(downloadId);
      animateRemoveDownloadItem(itemElement);
      updateDownloadBadge();
      return;
    }

    if (action === 'remove-download') {
      downloadsById.delete(downloadId);
      animateRemoveDownloadItem(itemElement);
      if (downloadsById.size === 0) {
        downloadShelf.classList.remove('active');
      }
      updateDownloadBadge();
    }
  });
}

function updateDownloadItem(payload) {
  if (!downloadShelf || !downloadList || !downloadHistoryList) return;

  const {
    id,
    filename,
    receivedBytes,
    totalBytes,
    state,
    savePath,
    speedBps
  } = payload;

  if (dismissedDownloadIds.has(id)) {
    return;
  }

  let item = downloadsById.get(id);
  if (!item) {
    item = {
      id,
      filename,
      receivedBytes: 0,
      totalBytes: totalBytes || 0,
      state,
      savePath,
      speedBps: speedBps || 0
    };
    downloadsById.set(id, item);
    downloadList.prepend(createDownloadElement(item));
    if (state === 'progress') {
      toggleDownloadShelf(true);
    }
  }

  item.filename = filename;
  item.receivedBytes = receivedBytes || 0;
  item.totalBytes = totalBytes || item.totalBytes;
  item.state = state;
  item.savePath = savePath;
  item.speedBps = speedBps || 0;

  renderDownloadItem(item);
  updateDownloadBadge();

  if (state === 'completed' || state === 'failed') {
    archiveDownload(item);
  }
}

function toggleDownloadShelf(forceState) {
  if (!downloadShelf) return;

  const nextState = typeof forceState === 'boolean'
    ? forceState
    : !downloadShelf.classList.contains('active');

  downloadShelf.classList.toggle('active', nextState);
}

function toggleAppMenu(forceState) {
  if (!appMenu || !menuToggleBtn) return;

  const nextState = typeof forceState === 'boolean'
    ? forceState
    : !appMenu.classList.contains('active');

  if (nextState) {
    setMenuPanel('main');
    positionAppMenu();
  }

  appMenu.classList.toggle('active', nextState);
}

function closeAppMenu() {
  if (!appMenu) return;
  appMenu.classList.remove('active');
}

function positionAppMenu() {
  if (!appMenu || !menuToggleBtn) return;
  const rect = menuToggleBtn.getBoundingClientRect();
  const rightOffset = Math.max(8, window.innerWidth - rect.right);
  appMenu.style.top = `${rect.bottom + 8}px`;
  appMenu.style.right = `${rightOffset}px`;
}

function setMenuPanel(panelName) {
  menuPanels.forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === panelName);
  });
}

function applyTheme(theme) {
  document.body.classList.toggle('theme-light', theme === 'light');
}

function updateThemeToggle() {
  if (!themeToggleBtn) return;
  const isLight = currentTheme === 'light';
  themeToggleBtn.textContent = isLight ? 'Light' : 'Dark';
  themeToggleBtn.setAttribute('aria-pressed', String(isLight));
}

function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  safeSetStorage(THEME_KEY, currentTheme);
  applyTheme(currentTheme);
  updateThemeToggle();
}

function updateDownloadBadge() {
  if (!downloadToggleBtn) return;
  downloadToggleBtn.classList.toggle('downloads-has-items', downloadsById.size > 0);
}

function openDownloadHistory() {
  toggleDownloadShelf(true);
  if (downloadHistoryList) {
    downloadHistoryList.scrollTop = 0;
  }
}

function createDownloadElement(item) {
  const element = document.createElement('div');
  element.className = 'download-item';
  element.dataset.downloadId = item.id;
  element.innerHTML = `
    <div class="download-meta">
      <div class="download-name"></div>
      <div class="download-status"></div>
    </div>
    <div class="download-progress">
      <div class="download-progress-bar"></div>
    </div>
    <div class="download-actions">
      <button class="download-action ghost" data-action="cancel-download">Cancel</button>
      <button class="download-action" data-action="open-download">Open</button>
      <button class="download-action ghost" data-action="show-download">Show</button>
      <button class="download-action ghost" data-action="remove-download">Clear</button>
    </div>
  `;
  return element;
}

function renderDownloadItem(item) {
  const element = downloadList.querySelector(`[data-download-id="${item.id}"]`);
  if (!element) return;

  const nameEl = element.querySelector('.download-name');
  const statusEl = element.querySelector('.download-status');
  const progressEl = element.querySelector('.download-progress-bar');
  const actions = element.querySelectorAll('.download-action');

  nameEl.textContent = item.filename || 'Download';

  const total = item.totalBytes || 0;
  const received = item.receivedBytes || 0;
  const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
  const speedText = item.speedBps > 0 ? ` • ${formatSpeed(item.speedBps)}` : '';

  if (item.state === 'completed') {
    statusEl.textContent = 'Done';
    progressEl.style.width = '100%';
    actions.forEach((button) => button.classList.remove('download-hidden'));
  } else if (item.state === 'failed') {
    statusEl.textContent = 'Failed';
    progressEl.style.width = `${percent}%`;
    actions.forEach((button) => button.classList.remove('download-hidden'));
  } else if (item.state === 'interrupted') {
    statusEl.textContent = 'Paused';
    progressEl.style.width = `${percent}%`;
    actions.forEach((button) => button.classList.remove('download-hidden'));
  } else if (item.state === 'cancelled') {
    statusEl.textContent = 'Cancelled';
    progressEl.style.width = `${percent}%`;
    actions.forEach((button) => button.classList.remove('download-hidden'));
  } else {
    statusEl.textContent = total > 0 ? `Downloading ${percent}%${speedText}` : `Downloading${speedText}`;
    progressEl.style.width = `${percent}%`;
    actions.forEach((button) => {
      const action = button.dataset.action;
      if (action === 'remove-download' || action === 'cancel-download') {
        button.classList.remove('download-hidden');
      } else {
        button.classList.add('download-hidden');
      }
    });
  }
}

function animateRemoveDownloadItem(element) {
  if (!element) return;
  element.classList.add('removing');
  const cleanup = () => element.remove();
  element.addEventListener('transitionend', cleanup, { once: true });
  setTimeout(cleanup, 260);
}

function archiveDownload(item) {
  if (!downloadHistoryList) return;

  const existingIndex = downloadHistory.findIndex((entry) => entry.id === item.id);
  if (existingIndex !== -1) {
    downloadHistory[existingIndex] = { ...item };
  } else {
    downloadHistory.unshift({ ...item });
  }

  downloadHistory = downloadHistory.slice(0, DOWNLOAD_HISTORY_LIMIT);
  saveDownloadHistory();
  renderDownloadHistory();
}

function loadDownloadHistory() {
  if (!downloadHistoryList) return;

  downloadHistory = safeGetJson(DOWNLOAD_HISTORY_KEY, []);
  if (!Array.isArray(downloadHistory)) {
    downloadHistory = [];
  }

  renderDownloadHistory();
}

function saveDownloadHistory() {
  safeSetStorage(DOWNLOAD_HISTORY_KEY, JSON.stringify(downloadHistory));
}

function renderDownloadHistory() {
  if (!downloadHistoryList) return;
  downloadHistoryList.innerHTML = '';

  downloadHistory.forEach((item) => {
    const element = createDownloadElement(item);
    element.classList.add('history');
    downloadHistoryList.appendChild(element);
    renderHistoryItem(item, element);
  });
}

function renderHistoryItem(item, element) {
  const nameEl = element.querySelector('.download-name');
  const statusEl = element.querySelector('.download-status');
  const progressEl = element.querySelector('.download-progress-bar');
  const actions = element.querySelectorAll('.download-action');

  nameEl.textContent = item.filename || 'Download';
  statusEl.textContent = item.state === 'completed' ? 'Done' : 'Failed';
  progressEl.style.width = '100%';

  actions.forEach((button) => {
    const action = button.dataset.action;
    if (action === 'open-download' || action === 'show-download' || action === 'remove-download') {
      button.classList.remove('download-hidden');
    } else {
      button.classList.add('download-hidden');
    }
  });
}

function safeGetJson(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallbackValue;
    return JSON.parse(raw);
  } catch (error) {
    return fallbackValue;
  }
}

function formatSpeed(bytesPerSecond) {
  if (!bytesPerSecond || !Number.isFinite(bytesPerSecond)) return '';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let value = bytesPerSecond;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted = value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2);
  return `${formatted} ${units[unitIndex]}`;
}

// Create a new tab
function createTab(url = HOME_URL) {
  const tabId = tabIdCounter++;
  
  // Create tab object
  const tab = {
    id: tabId,
    url: url,
    title: 'New Tab',
    favicon: null,
    loading: false
  };
  
  tabs.push(tab);
  
  // Create tab UI element
  const tabElement = createTabElement(tab);
  tabsContainer.appendChild(tabElement);
  
  // Create webview
  const webview = createWebview(tab);
  webviewContainer.appendChild(webview);
  
  // Switch to new tab
  switchTab(tabId);
  
  return tabId;
}

// Create tab element for sidebar
function createTabElement(tab) {
  const tabElement = document.createElement('div');
  tabElement.className = 'tab-item';
  tabElement.dataset.tabId = tab.id;
  
  const favicon = document.createElement('div');
  favicon.className = 'tab-favicon';
  favicon.innerHTML = '🌐';
  
  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = tab.title;
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'tab-close';
  closeBtn.innerHTML = '×';
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    closeTab(tab.id);
  };
  
  tabElement.appendChild(favicon);
  tabElement.appendChild(title);
  tabElement.appendChild(closeBtn);
  
  tabElement.addEventListener('click', () => switchTab(tab.id));
  
  return tabElement;
}

// Create webview element
function createWebview(tab) {
  const webview = document.createElement('webview');
  webview.id = `webview-${tab.id}`;
  webview.src = tab.url;
  webview.dataset.tabId = tab.id;
  webview.dataset.domReady = 'false';
  
  // Webview event listeners
  webview.addEventListener('dom-ready', () => {
    webview.dataset.domReady = 'true';
    updateNavigationButtons();
  });

  webview.addEventListener('did-start-loading', () => {
    updateTabLoading(tab.id, true);
  });
  
  webview.addEventListener('did-stop-loading', () => {
    updateTabLoading(tab.id, false);
  });
  
  webview.addEventListener('page-title-updated', (e) => {
    updateTabTitle(tab.id, e.title);
  });
  
  webview.addEventListener('page-favicon-updated', (e) => {
    if (e.favicons && e.favicons.length > 0) {
      updateTabFavicon(tab.id, e.favicons[0]);
    }
  });
  
  webview.addEventListener('did-navigate', (e) => {
    updateTabUrl(tab.id, e.url);
    updateNavigationButtons();
  });
  
  webview.addEventListener('did-navigate-in-page', (e) => {
    updateTabUrl(tab.id, e.url);
    updateNavigationButtons();
  });
  
  webview.addEventListener('new-window', (e) => {
    createTab(e.url);
  });
  
  webview.addEventListener('did-fail-load', (e) => {
    if (e.errorCode !== -3) { // Ignore aborted loads
      console.error('Failed to load:', e.errorDescription);
    }
  });
  
  return webview;
}

// Switch to a tab
function switchTab(tabId) {
  activeTabId = tabId;
  
  // Update tab UI
  document.querySelectorAll('.tab-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tabId == tabId);
  });
  
  // Update webview visibility
  document.querySelectorAll('webview').forEach(wv => {
    wv.classList.toggle('active', wv.dataset.tabId == tabId);
  });
  
  // Update URL bar and navigation buttons
  const tab = getTab(tabId);
  if (tab) {
    urlInput.value = tab.url;
    updateNavigationButtons();
    updateSecurityIcon(tab.url);
  }
}

// Close a tab
function closeTab(tabId) {
  const index = tabs.findIndex(t => t.id === tabId);
  if (index === -1) return;
  
  // Remove from array
  tabs.splice(index, 1);
  
  // Remove UI elements
  const tabElement = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
  const webview = document.getElementById(`webview-${tabId}`);
  
  if (tabElement) tabElement.remove();
  if (webview) webview.remove();
  
  // If closing active tab, switch to another
  if (activeTabId === tabId) {
    if (tabs.length > 0) {
      const newActiveTab = tabs[Math.max(0, index - 1)];
      switchTab(newActiveTab.id);
    } else {
      // No tabs left, create a new one
      createTab(HOME_URL);
    }
  }
}

// Get tab by ID
function getTab(tabId) {
  return tabs.find(t => t.id === tabId);
}

// Get active webview
function getActiveWebview() {
  if (activeTabId === null) return null;
  return document.getElementById(`webview-${activeTabId}`);
}

function isWebviewReady(webview) {
  return webview && webview.dataset.domReady === 'true';
}

// Update tab loading state
function updateTabLoading(tabId, loading) {
  const tab = getTab(tabId);
  if (tab) tab.loading = loading;
  
  const tabElement = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
  if (!tabElement) return;
  
  const favicon = tabElement.querySelector('.tab-favicon');
  if (loading) {
    favicon.innerHTML = '<div class="tab-loading"></div>';
  } else {
    favicon.innerHTML = tab.favicon ? 
      `<img src="${tab.favicon}" alt="">` : '🌐';
  }
}

// Update tab title
function updateTabTitle(tabId, title) {
  const tab = getTab(tabId);
  if (tab) tab.title = title || 'Untitled';
  
  const tabElement = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
  if (!tabElement) return;
  
  const titleElement = tabElement.querySelector('.tab-title');
  if (titleElement) {
    titleElement.textContent = tab.title;
    titleElement.title = tab.title;
  }
}

// Update tab favicon
function updateTabFavicon(tabId, favicon) {
  const tab = getTab(tabId);
  if (tab) tab.favicon = favicon;
  
  if (!tab.loading) {
    const tabElement = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
    if (!tabElement) return;
    
    const faviconElement = tabElement.querySelector('.tab-favicon');
    if (faviconElement && favicon) {
      faviconElement.innerHTML = `<img src="${favicon}" alt="">`;
    }
  }
}

// Update tab URL
function updateTabUrl(tabId, url) {
  const tab = getTab(tabId);
  if (tab) tab.url = url;
  
  if (activeTabId === tabId) {
    urlInput.value = url;
    updateSecurityIcon(url);
  }
}

// Search engine management
function setSearchEngine(engineKey) {
  if (SEARCH_ENGINES[engineKey]) {
    currentSearchEngine = engineKey;
    safeSetStorage('searchEngine', engineKey);
    updateSearchEngineUI();
  }
}

function updateSearchEngineUI() {
  const engine = SEARCH_ENGINES[currentSearchEngine];
  if (searchEngineIcon) {
    searchEngineIcon.src = engine.iconPath;
    searchEngineIcon.alt = engine.name;
  }
  searchEngineBtn.title = `Search with ${engine.name}`;
  urlInput.placeholder = `Search with ${engine.name} or enter address`;
  
  // Update selected state in dropdown
  document.querySelectorAll('.search-engine-option').forEach(option => {
    option.classList.toggle('selected', option.dataset.engine === currentSearchEngine);
  });
}

function toggleSearchEngineDropdown() {
  if (!searchEngineBtn || !searchEngineDropdown) return;
  
  const isActive = searchEngineDropdown.classList.toggle('active');
  if (isActive) {
    const rect = searchEngineBtn.getBoundingClientRect();
    searchEngineDropdown.style.top = `${rect.bottom + 8}px`;
    searchEngineDropdown.style.left = `${rect.left}px`;
  }
}

// Navigation functions
function navigateToUrl() {
  const webview = getActiveWebview();
  if (!webview) return;
  
  let url = urlInput.value.trim();
  
  if (!url) return;
  
  // Check if it's a search query or URL
  if (!url.includes('.') && !url.includes('localhost') && !url.startsWith('http')) {
    // Search query - use selected search engine
    const engine = SEARCH_ENGINES[currentSearchEngine];
    url = engine.searchUrl + encodeURIComponent(url);
  } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // Add protocol
    url = 'https://' + url;
  }
  
  webview.src = url;
}

function navigateBack() {
  const webview = getActiveWebview();
  if (isWebviewReady(webview) && webview.canGoBack()) {
    webview.goBack();
  }
}

function navigateForward() {
  const webview = getActiveWebview();
  if (isWebviewReady(webview) && webview.canGoForward()) {
    webview.goForward();
  }
}

function reloadPage() {
  const webview = getActiveWebview();
  if (isWebviewReady(webview)) {
    webview.reload();
  }
}

function navigateToHome() {
  const webview = getActiveWebview();
  if (webview) {
    webview.src = SEARCH_ENGINES[currentSearchEngine].homeUrl;
  }
}

// Update navigation button states
function updateNavigationButtons() {
  const webview = getActiveWebview();
  if (!backBtn || !forwardBtn) return;
  
  if (!isWebviewReady(webview)) {
    backBtn.disabled = true;
    forwardBtn.disabled = true;
    return;
  }
  
  backBtn.disabled = !webview.canGoBack();
  forwardBtn.disabled = !webview.canGoForward();
}

// Update security icon based on URL
function updateSecurityIcon(url) {
  if (url.startsWith('https://')) {
    securityIcon.classList.add('secure');
    securityIcon.title = 'Secure connection';
  } else {
    securityIcon.classList.remove('secure');
    securityIcon.title = 'Not secure';
  }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + T: New tab
  if ((e.ctrlKey || e.metaKey) && e.key === 't') {
    e.preventDefault();
    createTab(HOME_URL);
  }
  
  // Ctrl/Cmd + W: Close tab
  if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
    e.preventDefault();
    if (activeTabId !== null) {
      closeTab(activeTabId);
    }
  }
  
  // Ctrl/Cmd + R: Reload
  if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
    e.preventDefault();
    reloadPage();
  }
  
  // Alt + Left: Back
  if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault();
    navigateBack();
  }
  
  // Alt + Right: Forward
  if (e.altKey && e.key === 'ArrowRight') {
    e.preventDefault();
    navigateForward();
  }
  
  // Ctrl/Cmd + L: Focus URL bar
  if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
    e.preventDefault();
    urlInput.focus();
    urlInput.select();
  }
  
  // Ctrl/Cmd + 1-9: Switch to tab
  if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
    e.preventDefault();
    const index = parseInt(e.key) - 1;
    if (tabs[index]) {
      switchTab(tabs[index].id);
    }
  }
});

// Initialize on load
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
