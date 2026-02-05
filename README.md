# Sidebar Browser

A modern, custom web browser for PC built with Electron featuring a sleek sidebar tab interface inspired by Firefox.

## Features

### 🎨 Modern UI
- **Sidebar Tabs**: Vertical tab bar that expands on hover
- **Dark Theme**: Easy on the eyes with a professional dark interface
- **Smooth Animations**: Polished transitions and hover effects

### 🌐 Browser Features
- **Full Web Browsing**: Browse any website with Chromium engine
- **Multiple Tabs**: Open unlimited tabs with easy management
- **Navigation Controls**: Back, forward, refresh, and home buttons
- **Smart URL Bar**: Enter URLs or search queries directly
- **Security Indicators**: Visual HTTPS/HTTP connection status
- **Favicon Support**: Displays website icons in tabs
- **Loading States**: Visual feedback while pages load

### ⌨️ Keyboard Shortcuts
- `Ctrl/Cmd + T`: New tab
- `Ctrl/Cmd + W`: Close current tab
- `Ctrl/Cmd + R`: Reload page
- `Ctrl/Cmd + L`: Focus URL bar
- `Ctrl/Cmd + 1-9`: Switch to tab by number
- `Alt + Left`: Go back
- `Alt + Right`: Go forward
- `Enter` (in URL bar): Navigate/Search

## Installation

1. Install dependencies:
```bash
npm install
```

## Usage

Start the browser:
```bash
npm start
```

For development with DevTools:
```bash
npm run dev
```

## Project Structure

```
sidebar-browser/
├── main.js           # Electron main process
├── index.html        # Browser UI layout
├── styles.css        # Styling and theme
├── renderer.js       # Tab management and browser logic
├── package.json      # Project configuration
└── README.md         # Documentation
```

## Technology Stack

- **Electron**: Desktop application framework
- **Chromium**: Web rendering engine
- **HTML/CSS/JavaScript**: UI and functionality
- **Webview Tag**: Isolated web content rendering

## Customization

### Change Home Page
Edit the `HOME_URL` constant in `renderer.js`:
```javascript
const HOME_URL = 'https://your-homepage.com';
```

### Modify Theme
Edit colors in `styles.css`. Key variables:
- Background: `#1e1e1e`
- Sidebar: `#252526`
- Active tab: `#094771`
- Text: `#e0e0e0`

### Adjust Sidebar Width
Modify the width in `styles.css`:
```css
.sidebar {
  width: 60px; /* Collapsed width */
}

.sidebar:hover {
  width: 250px; /* Expanded width */
}
```

## Browser Capabilities

- ✅ Navigate to any URL
- ✅ Search from address bar
- ✅ Multiple simultaneous tabs
- ✅ Tab management (open, close, switch)
- ✅ Browser history (back/forward)
- ✅ Page refresh
- ✅ HTTPS detection
- ✅ Favicon display
- ✅ Page title updates
- ✅ Loading indicators
- ✅ External link handling
- ✅ Keyboard shortcuts

## Future Enhancements

Potential features to add:
- Bookmarks system
- Download manager
- Browser history panel
- Developer tools integration
- Extensions support
- Tab groups/organization
- Reading mode
- Screenshot tool
- Settings panel
- Custom search engines
- Private browsing mode

## Known Limitations

- Based on Electron's webview (older technology)
- Some modern web features may have compatibility issues
- Not a full replacement for production browsers
- Limited web extension support

## License

MIT

## Credits

Built with Electron and modern web technologies.
