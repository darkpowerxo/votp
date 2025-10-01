// Debug helper for VOTP extension
// Run this in the browser console to test the extension

(function debugVOTP() {
    console.log('🔧 VOTP Extension Debug Tool');
    console.log('==============================');
    
    // Test 1: Check if backend is running
    console.log('1. Testing backend connection...');
    fetch('http://localhost:8000/playground')
        .then(response => {
            if (response.ok) {
                console.log('✅ Backend is running at http://localhost:8000');
                return testGraphQL();
            } else {
                console.log('❌ Backend responded with error:', response.status);
            }
        })
        .catch(error => {
            console.log('❌ Backend is not running or not accessible');
            console.log('   Error:', error.message);
            console.log('💡 Make sure to run: cd backend && cargo run --release');
        });
    
    // Test 2: Test GraphQL endpoint
    async function testGraphQL() {
        console.log('2. Testing GraphQL endpoint...');
        try {
            const response = await fetch('http://localhost:8000/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: '{ __typename }'
                })
            });
            
            const data = await response.json();
            console.log('✅ GraphQL endpoint is working:', data);
        } catch (error) {
            console.log('❌ GraphQL endpoint failed:', error.message);
        }
    }
    
    // Test 3: Check extension elements
    console.log('3. Checking extension elements...');
    const sidebarContainer = document.getElementById('votp-sidebar-container');
    const sidebarIframe = document.getElementById('votp-sidebar-iframe');
    
    console.log('Sidebar container:', !!sidebarContainer);
    console.log('Sidebar iframe:', !!sidebarIframe);
    
    if (sidebarContainer) {
        console.log('Sidebar visible:', sidebarContainer.style.right === '0px');
    }
    
    // Test 4: Test extension messaging
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        console.log('4. Testing extension messaging...');
        chrome.runtime.sendMessage({type: 'GET_AUTH_STATUS'}, (response) => {
            if (chrome.runtime.lastError) {
                console.log('❌ Extension messaging failed:', chrome.runtime.lastError.message);
            } else {
                console.log('✅ Extension messaging works:', response);
            }
        });
    } else {
        console.log('4. Chrome extension API not available');
    }
    
    // Test 5: Manual sidebar creation
    console.log('5. Creating test sidebar...');
    const testSidebar = document.createElement('div');
    testSidebar.id = 'votp-debug-sidebar';
    testSidebar.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 300px;
        height: 200px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 10px;
        z-index: 999999;
        font-family: Arial, sans-serif;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    `;
    
    testSidebar.innerHTML = `
        <h3 style="margin:0 0 10px 0;">🗣️ VOTP Debug</h3>
        <p style="margin:5px 0;font-size:14px;">Extension loaded: ${!!window.votpContentScriptLoaded}</p>
        <p style="margin:5px 0;font-size:14px;">Backend: <span id="backend-status">Testing...</span></p>
        <button onclick="this.parentElement.remove()" style="
            background: rgba(255,255,255,0.2);
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
            padding: 5px 10px;
            border-radius: 5px;
            cursor: pointer;
            margin-top: 10px;
        ">Close</button>
    `;
    
    document.body.appendChild(testSidebar);
    
    // Update backend status in the test sidebar
    fetch('http://localhost:8000/playground')
        .then(response => {
            const status = document.getElementById('backend-status');
            if (status) {
                status.textContent = response.ok ? '✅ Running' : '❌ Error';
                status.style.color = response.ok ? '#90EE90' : '#FFB6C1';
            }
        })
        .catch(() => {
            const status = document.getElementById('backend-status');
            if (status) {
                status.textContent = '❌ Not Running';
                status.style.color = '#FFB6C1';
            }
        });
    
    // Auto-remove test sidebar after 15 seconds
    setTimeout(() => {
        const testDiv = document.getElementById('votp-debug-sidebar');
        if (testDiv) {
            testDiv.remove();
        }
    }, 15000);
    
    console.log('🎯 Debug Summary:');
    console.log('- Check the test sidebar in the top-right corner');
    console.log('- If backend is not running: cd backend && cargo run --release');
    console.log('- If extension issues: Reload extension in chrome://extensions/');
    console.log('- Check this console for detailed error messages');
})();