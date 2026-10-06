/** Sync peek of the Supabase session so the login form never paints first. */
(function () {
  var signedIn = false;
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key || key.indexOf("sb-") !== 0 || key.indexOf("-auth-token") === -1) continue;
      var raw = localStorage.getItem(key);
      if (!raw) continue;
      var parsed = JSON.parse(raw);
      var session = parsed.currentSession || parsed;
      if (session && (session.access_token || session.refresh_token)) {
        signedIn = true;
        break;
      }
    }
  } catch (err) {
    signedIn = false;
  }
  document.documentElement.classList.add(signedIn ? "auth-in" : "auth-out");
})();
