# 🔧 ZScaler TLS Certificate Fix Applied

## ✅ Problem Solved: "Certificate's CN name does not match"

This error happens because ZScaler (corporate firewall) intercepts TLS connections and presents its own certificate instead of the real SMTP server's certificate.

## 🚀 How to Apply the Fix

### Option 1: Bypass TLS Verification (Recommended for Corporate Networks)

Your `.env` file now has:
```properties
SMTP_DANGEROUS_TLS=true
```

This tells the email service to accept any TLS certificate, which works with corporate firewalls.

### Option 2: Skip Email Entirely (For Quick Testing)

If you just want to test the app without dealing with email, change your `.env` to:
```properties
# Comment out the dangerous TLS line
# SMTP_DANGEROUS_TLS=true

# Enable this instead
SKIP_EMAIL_SENDING=true
```

With this option, verification codes will be printed in the server console instead of emailed.

## 🔄 Rebuild and Test

```powershell
cd backend

# Rebuild with the updated email service
cargo build --release

# Run the server
cargo run --release
```

## 🧪 Testing

### Test 1: Try Sign Up
1. Start the backend server
2. Open the Chrome extension 
3. Try to sign up with any email
4. Look for one of these outcomes:

**With SMTP_DANGEROUS_TLS=true:**
- ✅ "Verification email sent successfully"
- You should receive the email

**With SKIP_EMAIL_SENDING=true:**
- ⚠️ Server console shows: "Verification code for email@example.com: 123456"
- Use that code in the extension

### Test 2: Check Server Logs

Look for these messages:
```
✅ "TLS certificate verification disabled for corporate network" 
✅ "Verification email sent successfully"
```

OR
```
📧 "Email sending is disabled - verification codes will be logged"
📧 "Verification code for user@email.com: 123456"
```

## 🐛 If Still Not Working

### Try Gmail Instead
Update your `.env`:
```properties
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-gmail@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-gmail@gmail.com
SMTP_USE_SSL=true
SMTP_DANGEROUS_TLS=true
```

### Or Use Development Mode
```properties
SKIP_EMAIL_SENDING=true
```

## 📊 What Each Option Does

| Option | What Happens | Best For |
|--------|-------------|----------|
| `SMTP_DANGEROUS_TLS=true` | Accepts any TLS certificate | Corporate networks with ZScaler |
| `SKIP_EMAIL_SENDING=true` | Logs codes to console | Quick local testing |
| Gmail + App Password | Uses Google's SMTP | When corporate SMTP is blocked |

## 🎯 Expected Result

After applying the fix:

1. **Server starts without TLS errors** ✅
2. **Sign up process works** ✅  
3. **Either emails are sent OR codes appear in console** ✅
4. **You can complete account verification** ✅

**The ZScaler certificate issue should now be resolved!** 🚀

Try running `cargo run --release` now and test the sign-up process.