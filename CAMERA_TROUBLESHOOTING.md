# Camera Not Working - Troubleshooting Guide

## Common Issues on Deployed Sites (Vercel/Production)

### Issue: "No valid camera device found"

**Causes:**
1. Camera permissions not granted
2. Browser blocking camera access
3. HTTPS not properly configured
4. Camera in use by another application

### Solutions:

#### 1. Check Browser Permissions

**Chrome:**
1. Look for the camera icon in the address bar (left side)
2. Click it and select "Allow"
3. Refresh the page

**Safari:**
1. Go to Safari → Settings for This Website
2. Set Camera to "Allow"
3. Refresh the page

**Firefox:**
1. Click the lock/camera icon in the address bar
2. Remove the camera permission block
3. Allow camera access when prompted
4. Refresh the page

#### 2. Verify HTTPS

- Camera access requires HTTPS in production
- Vercel automatically provides HTTPS
- Check that your URL starts with `https://`
- If using custom domain, ensure SSL is configured

#### 3. Clear Browser Cache

```bash
# Chrome/Edge
Cmd+Shift+Delete (Mac) or Ctrl+Shift+Delete (Windows)
Select "Cached images and files"
Clear data

# Safari  
Cmd+Option+E (Mac)
Then refresh the page
```

#### 4. Try Different Browser

Test in multiple browsers:
- ✅ Chrome (best support)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ❌ Internet Explorer (not supported)

#### 5. Check Camera Access

**On Mac:**
1. System Settings → Privacy & Security → Camera
2. Ensure browser (Chrome/Safari/Firefox) has camera permission

**On Windows:**
1. Settings → Privacy → Camera
2. Ensure "Allow apps to access your camera" is ON
3. Ensure browser has permission

**On Mobile:**
1. Settings → Privacy → Camera
2. Enable camera for your browser

#### 6. Close Other Applications

- Close Zoom, Teams, Skype, or any video call apps
- Close other browser tabs using the camera
- Restart your browser

### Testing Steps

1. **Test camera in another app** (like Photo Booth or Camera app)
   - If camera doesn't work elsewhere, it's a system issue
   - If it works, continue below

2. **Test on camera test site**
   - Go to: https://webcamtests.com/
   - If camera works there but not on DaanaRX, it's a permission issue

3. **Check browser console**
   - Press F12 or Cmd+Option+I
   - Look for errors in the Console tab
   - Share error messages for debugging

### Manual Workaround

If camera still doesn't work:
1. Click "Cancel and enter manually instead"
2. Type or paste the Daana ID/NDC code manually
3. Camera scanning is optional - manual entry works fine!

### Developer Solutions

If you're the developer/admin:

**1. Check HTTPS Configuration**
```javascript
// Verify HTTPS in browser
console.log(window.location.protocol); // Should be "https:"
```

**2. Test Camera Permissions**
```javascript
// Test in browser console
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    console.log('✅ Camera access granted');
    stream.getTracks().forEach(track => track.stop());
  })
  .catch(err => console.error('❌ Camera error:', err));
```

**3. Check Vercel Deployment**
- Ensure project deployed correctly
- Check build logs for errors
- Verify environment variables are set

**4. Review Browser Compatibility**
```javascript
// Check API support
console.log('MediaDevices:', !!navigator.mediaDevices);
console.log('getUserMedia:', !!navigator.mediaDevices?.getUserMedia);
```

### Error Messages Explained

| Error | Cause | Solution |
|-------|-------|----------|
| "NotAllowedError" | User denied permission | Click allow when prompted |
| "NotFoundError" | No camera detected | Connect a camera, check drivers |
| "NotReadableError" | Camera in use | Close other apps using camera |
| "OverconstrainedError" | Camera doesn't support requirements | Try different camera |
| "SecurityError" | Not HTTPS | Access via HTTPS URL |

### Still Not Working?

1. **Use Manual Entry**: Click "Cancel and enter manually"
2. **Try Mobile**: Mobile devices often have better camera support
3. **Update Browser**: Ensure you're on the latest version
4. **Contact Support**: Share browser console errors

### Alternative: Use Mobile Device

Mobile browsers typically have better camera support:
1. Open site on phone/tablet
2. Camera permissions are usually easier to grant
3. QR code scanning works better with phone cameras

## Quick Checklist

- [ ] Using HTTPS URL (not HTTP)
- [ ] Browser has camera permission
- [ ] System has camera permission for browser
- [ ] No other apps using the camera
- [ ] Latest browser version
- [ ] Camera works in other apps
- [ ] Cache cleared
- [ ] Page refreshed after granting permissions

---

**Note**: Camera scanning is a convenience feature. You can always enter codes manually if camera access doesn't work.

