// Simple test script to verify VOTP extension functionality
// Run this in browser console to test if extension is working

(function testVOTPExtension() {
    console.log('🧪 Starting VOTP Extension Test...');
    
    // Test 1: Check if content script loaded
    console.log('1. Content script loaded:', !!window.votpContentScriptLoaded);
    
    // Test 2: Check if sidebar container exists
    const sidebarContainer = document.getElementById('votp-sidebar-container');
    console.log('2. Sidebar container exists:', !!sidebarContainer);
    
    // Test 3: Check if extension context is available
    const extensionAvailable = typeof chrome !== 'undefined' && chrome.runtime;
    console.log('3. Chrome extension API available:', extensionAvailable);
    
    // Test 4: Try to get extension ID
    if (extensionAvailable) {
        console.log('4. Extension ID:', chrome.runtime.id);
    } else {
        console.log('4. Extension ID: Not available');
    }
    
    // Test 5: Check if VOTP extension is in the page
    const extensionElements = document.querySelectorAll('[id*="votp"], [class*="votp"]');
    console.log('5. VOTP elements found:', extensionElements.length);
    
    // Test 6: Try to create a test sidebar manually
    console.log('6. Creating test sidebar...');
    const testSidebar = document.createElement('div');
    testSidebar.id = 'votp-test-sidebar';
    testSidebar.style.cssText = `
        position: fixed;
        top: 50px;
        right: 20px;
        width: 300px;
        height: 200px;
        background: #4CAF50;
        color: white;
        padding: 20px;
        border-radius: 8px;
        z-index: 999999;
        font-family: Arial, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    testSidebar.innerHTML = `
        <h3>🗣️ VOTP Test Sidebar</h3>
        <p>If you see this, the DOM manipulation works!</p>
        <button onclick="this.parentElement.remove()" style="
            background: white;
            color: #4CAF50;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
        ">Close</button>
    `;
    
    document.body.appendChild(testSidebar);
    console.log('✅ Test sidebar created! Check the top-right corner.');
    
    // Test 7: Try to send message to extension (if available)
    if (extensionAvailable && chrome.runtime.id) {
        console.log('7. Testing extension messaging...');
        try {
            chrome.runtime.sendMessage({type: 'GET_AUTH_STATUS'}, (response) => {
                console.log('✅ Extension responded:', response);
            });
        } catch (error) {
            console.log('❌ Extension messaging failed:', error.message);
        }
    } else {
        console.log('7. Extension messaging: Not available');
    }
    
    // Test 8: Check for common extension files
    const testUrls = [
        'sidebar/sidebar.html',
        'sidebar/sidebar.css',
        'sidebar/sidebar.js',
        'icons/icon16.png'
    ];
    
    console.log('8. Testing extension resource URLs...');
    testUrls.forEach(url => {
        if (extensionAvailable && chrome.runtime.id) {
            const fullUrl = chrome.runtime.getURL(url);
            console.log(`   ${url}: ${fullUrl}`);
        }
    });
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log('================');
    console.log('Content Script:', window.votpContentScriptLoaded ? '✅' : '❌');
    console.log('Extension API:', extensionAvailable ? '✅' : '❌');
    console.log('Sidebar Container:', !!sidebarContainer ? '✅' : '❌');
    console.log('DOM Manipulation:', '✅ (test sidebar created)');
    
    // Auto-remove test sidebar after 10 seconds
    setTimeout(() => {
        const testDiv = document.getElementById('votp-test-sidebar');
        if (testDiv) {
            testDiv.remove();
            console.log('🧹 Test sidebar auto-removed');
        }
    }, 10000);
    
    console.log('\n💡 Next steps:');
    console.log('- If you see the green test sidebar → DOM manipulation works');
    console.log('- Check chrome://extensions/ for the VOTP extension');
    console.log('- Look for any red error messages in this console');
    console.log('- Try clicking the VOTP icon in the toolbar');
})();