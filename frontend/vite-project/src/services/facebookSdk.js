let sdkLoadPromise = null;
let initializedAppId = "";
let initializedApiVersion = "";

const FACEBOOK_SDK_SCRIPT_ID = "facebook-jssdk";
const FACEBOOK_SDK_URL = "https://connect.facebook.net/en_US/sdk.js";

const initFacebookSdk = (appId, apiVersion) => {
  if (!window.FB) {
    throw new Error("Facebook SDK is not available");
  }

  if (initializedAppId !== appId || initializedApiVersion !== apiVersion) {
    window.FB.init({
      appId,
      cookie: true,
      xfbml: true,
      version: apiVersion,
    });

    initializedAppId = appId;
    initializedApiVersion = apiVersion;
  }

  window.FB.AppEvents?.logPageView?.();

  return window.FB;
};

export const loadFacebookSdk = (appId, apiVersion) =>
  new Promise((resolve, reject) => {
    if (!appId) {
      reject(new Error("Meta App ID is required"));
      return;
    }

    if (!apiVersion) {
      reject(new Error("Meta API version is required"));
      return;
    }

    if (window.FB) {
      try {
        resolve(initFacebookSdk(appId, apiVersion));
      } catch (error) {
        reject(error);
      }
      return;
    }

    if (!sdkLoadPromise) {
      sdkLoadPromise = new Promise((sdkResolve, sdkReject) => {
        window.fbAsyncInit = function () {
          try {
            sdkResolve(window.FB);
          } catch (error) {
            sdkReject(error);
          }
        };

        const existingScript = document.getElementById(FACEBOOK_SDK_SCRIPT_ID);
        if (existingScript) {
          existingScript.addEventListener("load", () => sdkResolve(window.FB), { once: true });
          existingScript.addEventListener(
            "error",
            () => sdkReject(new Error("Failed to load Facebook SDK")),
            { once: true }
          );
          return;
        }

        const firstScript = document.getElementsByTagName("script")[0];
        const script = document.createElement("script");
        script.id = FACEBOOK_SDK_SCRIPT_ID;
        script.src = FACEBOOK_SDK_URL;
        script.async = true;
        script.defer = true;
        script.onerror = () => sdkReject(new Error("Failed to load Facebook SDK"));

        if (firstScript?.parentNode) {
          firstScript.parentNode.insertBefore(script, firstScript);
        } else {
          document.body.appendChild(script);
        }
      });
    }

    sdkLoadPromise
      .then(() => resolve(initFacebookSdk(appId, apiVersion)))
      .catch((error) => {
        sdkLoadPromise = null;
        reject(error);
      });
  });
