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
const toolbar = document.querySelector('.toolbar');
const backBtn = toolbar ? toolbar.querySelector('[data-action="back"]') : null;
const forwardBtn = toolbar ? toolbar.querySelector('[data-action="forward"]') : null;
const refreshBtn = toolbar ? toolbar.querySelector('[data-action="refresh"]') : null;
const homeBtn = toolbar ? toolbar.querySelector('[data-action="home"]') : null;

// Initialize browser
function init() {
  // Set initial search engine
  updateSearchEngineUI();
  
  // Create first tab
  createTab(SEARCH_ENGINES[currentSearchEngine].homeUrl);
  
  // Setup event listeners
  setupEventListeners();
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
          // Placeholder for future menu actions
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
