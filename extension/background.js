// Background Service Worker for VOTP Chrome Extension

// API Configuration
const API_BASE_URL = 'http://localhost:8000/api';
const STORAGE_KEYS = {
  AUTH_TOKEN: 'votp_auth_token',
  USER_DATA: 'votp_user_data',
  SIDEBAR_STATE: 'votp_sidebar_state'
};

// Extension installation/update handler
chrome.runtime.onInstalled.addListener((details) => {
  console.log('VOTP Extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    // Set default values on first install
    chrome.storage.local.set({
      [STORAGE_KEYS.SIDEBAR_STATE]: false,
      [STORAGE_KEYS.AUTH_TOKEN]: null,
      [STORAGE_KEYS.USER_DATA]: null
    });
  }
  
  // Create context menu
  chrome.contextMenus.create({
    id: 'votp-comment',
    title: 'Comment on this page with VOTP',
    contexts: ['page']
  });
  
  // Set up periodic cleanup alarm
  chrome.alarms.create('cleanup', { periodInMinutes: 60 });
});

// Action button click handler
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Toggle sidebar state
    const result = await chrome.storage.local.get([STORAGE_KEYS.SIDEBAR_STATE]);
    const currentState = result[STORAGE_KEYS.SIDEBAR_STATE] || false;
    const newState = !currentState;
    
    // Store new state
    await chrome.storage.local.set({
      [STORAGE_KEYS.SIDEBAR_STATE]: newState
    });
    
    // Send message to content script to toggle sidebar
    chrome.tabs.sendMessage(tab.id, {
      type: 'TOGGLE_SIDEBAR',
      show: newState
    }).catch(error => {
      console.log('Could not communicate with content script - user may need to refresh the page');
    });
    
    // Update action icon to reflect state (use same icons for now)
    chrome.action.setIcon({
      tabId: tab.id,
      path: {
        16: 'icons/icon16.png',
        48: 'icons/icon48.png',
        128: 'icons/icon128.png'
      }
    });
    
  } catch (error) {
    console.error('Error toggling sidebar:', error);
  }
});

// Message handler for communication between components
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_AUTH_STATUS':
      handleGetAuthStatus(sendResponse);
      return true; // Keep channel open for async response
      
    case 'AUTHENTICATE':
      handleAuthentication(message.data, sendResponse);
      return true;
      
    case 'LOGOUT':
      handleLogout(sendResponse);
      return true;
      
    case 'API_REQUEST':
      handleApiRequest(message.data, sendResponse);
      return true;
      
    case 'GET_CURRENT_URL':
      handleGetCurrentUrl(sender, sendResponse);
      return true;
      
    default:
      console.warn('Unknown message type:', message.type);
      sendResponse({ error: 'Unknown message type' });
  }
});

// Authentication status handler
async function handleGetAuthStatus(sendResponse) {
  try {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_DATA
    ]);
    
    const isAuthenticated = !!result[STORAGE_KEYS.AUTH_TOKEN];
    const userData = result[STORAGE_KEYS.USER_DATA];
    
    sendResponse({
      isAuthenticated,
      user: userData,
      token: result[STORAGE_KEYS.AUTH_TOKEN]
    });
  } catch (error) {
    console.error('Error getting auth status:', error);
    sendResponse({ error: error.message });
  }
}

// Authentication handler
async function handleAuthentication(authData, sendResponse) {
  try {
    // Store authentication data
    await chrome.storage.local.set({
      [STORAGE_KEYS.AUTH_TOKEN]: authData.token,
      [STORAGE_KEYS.USER_DATA]: authData.user
    });
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error storing auth data:', error);
    sendResponse({ error: error.message });
  }
}

// Logout handler
async function handleLogout(sendResponse) {
  try {
    // Clear authentication data
    await chrome.storage.local.remove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_DATA
    ]);
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error during logout:', error);
    sendResponse({ error: error.message });
  }
}

// API request handler
async function handleApiRequest(requestData, sendResponse) {
  try {
    const { query, variables, requireAuth = false } = requestData;
    
    // Get auth token if required
    let headers = {
      'Content-Type': 'application/json'
    };
    
    if (requireAuth) {
      const result = await chrome.storage.local.get([STORAGE_KEYS.AUTH_TOKEN]);
      const token = result[STORAGE_KEYS.AUTH_TOKEN];
      
      if (!token) {
        sendResponse({ error: 'Authentication required' });
        return;
      }
      
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Make API request
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        variables: variables || {}
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    
    sendResponse({ data });
    
  } catch (error) {
    console.error('API request failed:', error);
    sendResponse({ error: error.message });
  }
}

// Get current URL handler
function handleGetCurrentUrl(sender, sendResponse) {
  if (sender.tab) {
    sendResponse({ url: sender.tab.url });
  } else {
    sendResponse({ error: 'Unable to get current URL' });
  }
}

// Tab update handler - reset sidebar state when navigating
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      // Reset sidebar state for new page
      await chrome.storage.local.set({
        [STORAGE_KEYS.SIDEBAR_STATE]: false
      });
      
      // Reset action icon
      chrome.action.setIcon({
        tabId: tabId,
        path: {
          16: 'icons/icon16.png',
          48: 'icons/icon48.png',
          128: 'icons/icon128.png'
        }
      }).catch(() => {
        // Ignore icon setting errors
      });
    } catch (error) {
      console.error('Error resetting sidebar state:', error);
    }
  }
});

// Context menu setup (optional - for future features)
// Note: Context menu creation moved to the main onInstalled listener above

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'votp-comment') {
    // Trigger sidebar open
    chrome.tabs.sendMessage(tab.id, {
      type: 'TOGGLE_SIDEBAR',
      show: true
    }).catch(error => {
      console.log('Could not communicate with content script - user may need to refresh the page');
    });
  }
});

// Alarm for periodic cleanup (optional)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    // Perform periodic cleanup tasks
    console.log('Performing periodic cleanup...');
  }
});

// Set up periodic cleanup on installation
// Note: Service workers don't have a persistent onStartup, so we set this up during install
// This is handled in the onInstalled listener above

console.log('VOTP Background service worker initialized');