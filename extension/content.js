// Content Script for VOTP Chrome Extension
// This script runs on every webpage and manages the sidebar

(function() {
  'use strict';
  
  // Early check for extension context validity
  try {
    if (!chrome || !chrome.runtime || !chrome.runtime.id) {
      console.warn('VOTP: Extension context is invalid, skipping initialization');
      return;
    }
  } catch (e) {
    console.warn('VOTP: Extension context check failed, skipping initialization:', e.message);
    return;
  }
  
  let sidebarContainer = null;
  let sidebarIframe = null;
  let isInitialized = false;
  
  // Utility function to check if extension context is valid
  function isExtensionContextValid() {
    try {
      return !!(chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage);
    } catch (error) {
      return false;
    }
  }
  
  // Configuration
  const SIDEBAR_WIDTH = '380px';
  const SIDEBAR_ID = 'votp-sidebar-container';
  const IFRAME_ID = 'votp-sidebar-iframe';

  // Send error response to sidebar when extension context is invalid
  function sendExtensionErrorToSidebar(requestId, requestType = 'API_RESPONSE') {
    if (sidebarIframe && sidebarIframe.contentWindow) {
      try {
        sidebarIframe.contentWindow.postMessage({
          type: requestType,
          requestId: requestId,
          data: { error: 'Extension was reloaded. Please refresh the page.' }
        }, '*');
      } catch (error) {
        console.log('VOTP: Could not send error message to sidebar');
      }
    }
  }

  // Initialize the extension
  function initialize() {
    if (isInitialized) return;
    
    // Check if extension context is valid
    if (!isExtensionContextValid()) {
      console.warn('VOTP: Extension context invalidated. Page needs to be refreshed.');
      return;
    }
    
    console.log('VOTP Content Script: Initializing on', window.location.href);
    
    // Create sidebar container
    createSidebarContainer();
    
    // Listen for messages from background script
    if (isExtensionContextValid()) {
      try {
        chrome.runtime.onMessage.addListener(handleMessage);
      } catch (error) {
        console.warn('VOTP: Could not set up message listener:', error.message);
      }
    }
    
    // Listen for window resize
    window.addEventListener('resize', handleWindowResize);
    
    // Listen for escape key to close sidebar
    document.addEventListener('keydown', handleKeyDown);
    
    isInitialized = true;
  }
  
  // Create the sidebar container and iframe
  function createSidebarContainer() {
    // Check if sidebar already exists
    if (document.getElementById(SIDEBAR_ID)) {
      return;
    }
    
    // Create container
    sidebarContainer = document.createElement('div');
    sidebarContainer.id = SIDEBAR_ID;
    sidebarContainer.style.cssText = `
      position: fixed;
      top: 0;
      right: -${SIDEBAR_WIDTH};
      width: ${SIDEBAR_WIDTH};
      height: 100vh;
      z-index: 2147483647;
      transition: right 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
      box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
      background: white;
      border-left: 1px solid #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    `;
    
    // Create iframe for sidebar content
    sidebarIframe = document.createElement('iframe');
    sidebarIframe.id = IFRAME_ID;
    
    try {
      if (!chrome.runtime || !chrome.runtime.getURL) {
        throw new Error('Extension context is invalid');
      }
      sidebarIframe.src = chrome.runtime.getURL('sidebar/sidebar.html');
    } catch (error) {
      console.error('VOTP: Failed to get extension URL, extension may have been reloaded');
      // Show error message instead of loading sidebar
      sidebarContainer.innerHTML = `
        <div style="padding: 20px; color: #721c24; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; margin: 20px; font-family: Arial, sans-serif;">
          <h4 style="margin: 0 0 8px 0;">VOTP Extension Reloaded</h4>
          <p style="margin: 0 0 12px 0;">Please refresh this page to use VOTP comments.</p>
          <button onclick="this.parentElement.parentElement.remove()" style="
            background: #dc3545;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
          ">Close</button>
        </div>
      `;
      return;
    }
    
    sidebarIframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      background: white;
    `;
    
    // Add iframe to container
    sidebarContainer.appendChild(sidebarIframe);
    
    // Add container to page
    document.body.appendChild(sidebarContainer);
    
    // Set up iframe communication
    setupIframeMessaging();
  }
  
  // Set up messaging between content script and sidebar iframe
  function setupIframeMessaging() {
    window.addEventListener('message', (event) => {
      // Only accept messages from our sidebar iframe
      if (event.source !== sidebarIframe.contentWindow) return;
      
      switch (event.data.type) {
        case 'CLOSE_SIDEBAR':
          hideSidebar();
          break;
          
        case 'RESIZE_SIDEBAR':
          handleSidebarResize(event.data.width);
          break;
          
        case 'API_REQUEST':
          // Check extension context before making API requests
          if (!isExtensionContextValid()) {
            console.warn('VOTP: Extension context invalid, cannot make API request');
            sendExtensionErrorToSidebar(event.data.requestId, 'API_RESPONSE');
            break;
          }
          
          // Forward API requests to background script with error handling
          try {
            chrome.runtime.sendMessage({
              type: 'API_REQUEST',
              data: event.data.data
            }, (response) => {
              if (chrome.runtime.lastError) {
                console.warn('Extension context invalidated, sending error response');
                sidebarIframe.contentWindow.postMessage({
                  type: 'API_RESPONSE',
                  requestId: event.data.requestId,
                  data: { error: 'Extension was reloaded. Please refresh the page.' }
                }, '*');
                return;
              }
              
              sidebarIframe.contentWindow.postMessage({
                type: 'API_RESPONSE',
                requestId: event.data.requestId,
                data: response
              }, '*');
            });
          } catch (error) {
            console.warn('Chrome runtime error:', error);
            sidebarIframe.contentWindow.postMessage({
              type: 'API_RESPONSE',
              requestId: event.data.requestId,
              data: { error: 'Extension error. Please refresh the page.' }
            }, '*');
          }
          break;
          
        case 'GET_CURRENT_URL':
          // Send current URL to sidebar
          sidebarIframe.contentWindow.postMessage({
            type: 'CURRENT_URL',
            url: window.location.href,
            title: document.title
          }, '*');
          break;
          
        case 'AUTH_REQUEST':
          // Check extension context before making auth requests
          if (!isExtensionContextValid()) {
            console.warn('VOTP: Extension context invalid, cannot make auth request');
            sendExtensionErrorToSidebar(event.data.requestId, 'AUTH_RESPONSE');
            break;
          }
          
          // Forward auth requests to background script with error handling
          try {
            chrome.runtime.sendMessage({
              type: event.data.authType,
              data: event.data.data
            }, (response) => {
              if (chrome.runtime.lastError) {
                console.warn('Extension context invalidated during auth request');
                sidebarIframe.contentWindow.postMessage({
                  type: 'AUTH_RESPONSE',
                  requestId: event.data.requestId,
                  data: { error: 'Extension was reloaded. Please refresh the page.' }
                }, '*');
                return;
              }
              
              sidebarIframe.contentWindow.postMessage({
                type: 'AUTH_RESPONSE',
                requestId: event.data.requestId,
                data: response
              }, '*');
            });
          } catch (error) {
            console.warn('Chrome runtime error during auth:', error);
            sidebarIframe.contentWindow.postMessage({
              type: 'AUTH_RESPONSE',
              requestId: event.data.requestId,
              data: { error: 'Extension error. Please refresh the page.' }
            }, '*');
          }
          break;
      }
    });
  }
  
  // Handle messages from background script
  function handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'TOGGLE_SIDEBAR':
        if (message.show) {
          showSidebar();
        } else {
          hideSidebar();
        }
        break;
        
      case 'SIDEBAR_STATE_CHANGED':
        updateSidebarState(message.data);
        break;
    }
  }
  
  // Show the sidebar
  function showSidebar() {
    if (!sidebarContainer) {
      createSidebarContainer();
    }
    
    // Check if sidebarContainer was successfully created
    if (!sidebarContainer) {
      console.warn('VOTP: Could not create sidebar container, extension may be reloaded');
      return;
    }
    
    // Add some padding to body to prevent content from being hidden
    document.body.style.marginRight = SIDEBAR_WIDTH;
    
    // Show sidebar
    sidebarContainer.style.right = '0';
    
    // Focus on sidebar
    setTimeout(() => {
      if (sidebarIframe && sidebarIframe.contentWindow) {
        try {
          sidebarIframe.contentWindow.focus();
        } catch (error) {
          console.log('VOTP: Could not focus sidebar:', error.message);
        }
      }
    }, 300);
    
    // Notify sidebar that it's visible
    setTimeout(() => {
      if (sidebarIframe && sidebarIframe.contentWindow) {
        try {
          sidebarIframe.contentWindow.postMessage({
            type: 'SIDEBAR_VISIBLE',
            url: window.location.href,
            title: document.title
          }, '*');
        } catch (error) {
          console.log('VOTP: Could not send message to sidebar:', error.message);
        }
      }
    }, 100);
  }
  
  // Hide the sidebar
  function hideSidebar() {
    if (!sidebarContainer) return;
    
    // Remove body padding
    document.body.style.marginRight = '';
    
    // Hide sidebar
    sidebarContainer.style.right = `-${SIDEBAR_WIDTH}`;
    
    // Update storage state if extension context is valid
    if (isExtensionContextValid()) {
      try {
        chrome.runtime.sendMessage({
          type: 'UPDATE_SIDEBAR_STATE',
          data: { visible: false }
        });
      } catch (error) {
        console.log('VOTP: Could not update sidebar state:', error.message);
      }
    }
  }
  
  // Handle sidebar resize
  function handleSidebarResize(newWidth) {
    if (!sidebarContainer) return;
    
    const width = newWidth || SIDEBAR_WIDTH;
    sidebarContainer.style.width = width;
    
    // Update body margin if sidebar is visible
    if (sidebarContainer.style.right === '0px') {
      document.body.style.marginRight = width;
    }
  }
  
  // Handle window resize
  function handleWindowResize() {
    // Adjust sidebar position on window resize if needed
    if (sidebarContainer && sidebarContainer.style.right === '0px') {
      // Sidebar is visible, ensure it's properly positioned
      sidebarContainer.style.height = '100vh';
    }
  }
  
  // Handle keyboard shortcuts
  function handleKeyDown(event) {
    // Close sidebar on Escape key
    if (event.key === 'Escape' && sidebarContainer && sidebarContainer.style.right === '0px') {
      hideSidebar();
    }
  }
  
  // Update sidebar state
  function updateSidebarState(stateData) {
    if (sidebarIframe && sidebarIframe.contentWindow) {
      sidebarIframe.contentWindow.postMessage({
        type: 'STATE_UPDATE',
        data: stateData
      }, '*');
    }
  }
  
  // Clean up when page is about to unload
  window.addEventListener('beforeunload', () => {
    if (sidebarContainer) {
      document.body.removeChild(sidebarContainer);
      document.body.style.marginRight = '';
    }
  });
  
  // Handle page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Page is hidden, pause any active operations
      if (sidebarIframe && sidebarIframe.contentWindow) {
        sidebarIframe.contentWindow.postMessage({
          type: 'PAGE_VISIBILITY_CHANGED',
          visible: false
        }, '*');
      }
    } else {
      // Page is visible again, resume operations
      if (sidebarIframe && sidebarIframe.contentWindow) {
        sidebarIframe.contentWindow.postMessage({
          type: 'PAGE_VISIBILITY_CHANGED',
          visible: true
        }, '*');
      }
    }
  });
  
  // Initialize when DOM is ready with error handling
  function safeInitialize() {
    try {
      initialize();
    } catch (error) {
      console.warn('VOTP: Failed to initialize content script:', error.message);
      // Create a simple error notification
      if (document.body) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #f8d7da;
          color: #721c24;
          padding: 12px 16px;
          border: 1px solid #f5c6cb;
          border-radius: 4px;
          z-index: 9999999;
          font-family: Arial, sans-serif;
          font-size: 14px;
          max-width: 300px;
        `;
        errorDiv.innerHTML = `
          <strong>VOTP Extension:</strong><br>
          Extension was reloaded. Please refresh this page to use VOTP.
          <button onclick="this.parentElement.remove()" style="
            float: right;
            background: none;
            border: none;
            color: #721c24;
            cursor: pointer;
            font-size: 16px;
            margin-left: 8px;
          ">×</button>
        `;
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
          if (errorDiv.parentElement) {
            errorDiv.remove();
          }
        }, 10000);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInitialize);
  } else {
    safeInitialize();
  }
  
  // Prevent multiple initializations
  if (window.votpContentScriptLoaded) {
    return;
  }
  window.votpContentScriptLoaded = true;
  
  console.log('VOTP Content Script: Loaded successfully');
})();