// Content Script for VOTP Chrome Extension
// This script runs on every webpage and manages the sidebar

(function() {
  'use strict';
  
  let sidebarContainer = null;
  let sidebarIframe = null;
  let isInitialized = false;
  
  // Configuration
  const SIDEBAR_WIDTH = '380px';
  const SIDEBAR_ID = 'votp-sidebar-container';
  const IFRAME_ID = 'votp-sidebar-iframe';
  
  // Initialize the extension
  function initialize() {
    if (isInitialized) return;
    
    console.log('VOTP Content Script: Initializing on', window.location.href);
    
    // Create sidebar container
    createSidebarContainer();
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener(handleMessage);
    
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
    sidebarIframe.src = chrome.runtime.getURL('sidebar/sidebar.html');
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
          // Forward API requests to background script
          chrome.runtime.sendMessage({
            type: 'API_REQUEST',
            data: event.data.data
          }, (response) => {
            sidebarIframe.contentWindow.postMessage({
              type: 'API_RESPONSE',
              requestId: event.data.requestId,
              data: response
            }, '*');
          });
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
          // Forward auth requests to background script
          chrome.runtime.sendMessage({
            type: event.data.authType,
            data: event.data.data
          }, (response) => {
            sidebarIframe.contentWindow.postMessage({
              type: 'AUTH_RESPONSE',
              requestId: event.data.requestId,
              data: response
            }, '*');
          });
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
    
    // Add some padding to body to prevent content from being hidden
    document.body.style.marginRight = SIDEBAR_WIDTH;
    
    // Show sidebar
    sidebarContainer.style.right = '0';
    
    // Focus on sidebar
    setTimeout(() => {
      if (sidebarIframe && sidebarIframe.contentWindow) {
        sidebarIframe.contentWindow.focus();
      }
    }, 300);
    
    // Notify sidebar that it's visible
    setTimeout(() => {
      if (sidebarIframe && sidebarIframe.contentWindow) {
        sidebarIframe.contentWindow.postMessage({
          type: 'SIDEBAR_VISIBLE',
          url: window.location.href,
          title: document.title
        }, '*');
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
    
    // Update storage state
    chrome.runtime.sendMessage({
      type: 'UPDATE_SIDEBAR_STATE',
      data: { visible: false }
    });
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
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
  // Prevent multiple initializations
  if (window.votpContentScriptLoaded) {
    return;
  }
  window.votpContentScriptLoaded = true;
  
  console.log('VOTP Content Script: Loaded successfully');
})();