// Test script to verify Chrome extension context invalidation fixes
// Run this in the browser console on any webpage with VOTP extension loaded

console.log('🧪 VOTP Extension Context Fix Test');
console.log('=================================');

// Test 1: Check if content script loaded
console.log('\n1. Testing content script loading...');
if (window.votpContentScriptLoaded) {
    console.log('✅ Content script loaded successfully');
} else {
    console.log('❌ Content script not loaded');
}

// Test 2: Check extension context validation
console.log('\n2. Testing extension context validation...');
try {
    if (chrome && chrome.runtime && chrome.runtime.id) {
        console.log('✅ Extension context is valid');
        console.log('   Extension ID:', chrome.runtime.id);
    } else {
        console.log('⚠️  Extension context appears invalid');
    }
} catch (error) {
    console.log('❌ Extension context error:', error.message);
}

// Test 3: Test sidebar creation
console.log('\n3. Testing sidebar creation...');
const sidebarElement = document.getElementById('votp-sidebar-container');
if (sidebarElement) {
    console.log('✅ Sidebar container exists');
    console.log('   Sidebar display:', getComputedStyle(sidebarElement).display);
    console.log('   Sidebar position:', getComputedStyle(sidebarElement).right);
} else {
    console.log('ℹ️  Sidebar not created yet (this is normal if extension icon hasn\'t been clicked)');
}

// Test 4: Check for error notifications
console.log('\n4. Checking for error notifications...');
const errorNotifications = document.querySelectorAll('[style*="background: #f8d7da"]');
if (errorNotifications.length > 0) {
    console.log('⚠️  Found extension error notifications:', errorNotifications.length);
    errorNotifications.forEach((notification, index) => {
        console.log(`   Notification ${index + 1}:`, notification.textContent.trim());
    });
} else {
    console.log('✅ No error notifications found');
}

// Test 5: Manual context validation function
console.log('\n5. Testing context validation...');
function testExtensionContext() {
    try {
        return !!(chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage);
    } catch (error) {
        return false;
    }
}

if (testExtensionContext()) {
    console.log('✅ Extension context validation passed');
} else {
    console.log('❌ Extension context validation failed');
}

console.log('\n🔧 How to test the fix:');
console.log('1. Make sure VOTP extension is loaded and working normally');
console.log('2. Open this webpage and click the VOTP extension icon');
console.log('3. Go to chrome://extensions/ and click "Reload" on VOTP extension');
console.log('4. Come back to this page and try to use VOTP');
console.log('5. You should see helpful error messages instead of console errors');
console.log('6. Refresh this page and VOTP should work normally again');

console.log('\n✨ Test completed!');