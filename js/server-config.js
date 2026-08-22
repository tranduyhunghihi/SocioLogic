/**
 * SOCIO LOGIC DYNAMIC FRONTEND CONFIGURATION
 * Resolves Backend API URL dynamically without hardcoded values.
 */
(function() {
    let resolvedApiUrl = '';

    // 1. Explicit window override if defined
    if (window.CUSTOM_BACKEND_URL) {
        resolvedApiUrl = window.CUSTOM_BACKEND_URL;
    } 
    // 2. Web production host detection (Render / Vercel / Custom Domain)
    else if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && window.location.protocol.startsWith('http')) {
        // If served on custom subdomain or backend server
        if (window.location.hostname.includes('render.com')) {
            resolvedApiUrl = window.location.origin;
        } else {
            resolvedApiUrl = 'https://sociologic.onrender.com';
        }
    } 
    // 3. Local development fallback
    else {
        resolvedApiUrl = 'http://localhost:5000';
    }

    window.BACKEND_CONFIG = {
        apiUrl: resolvedApiUrl
    };
})();
