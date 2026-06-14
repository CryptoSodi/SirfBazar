import { GoogleSignin } from '@react-native-google-signin/google-signin';

/**
 * Native Google sign-in (requires a development build — NOT Expo Go).
 * webClientId makes Google return an ID token whose `aud` matches the backend's
 * GOOGLE_CLIENT_ID, which /auth/google-login verifies. On Android the app is
 * matched by package name + SHA-1 (an Android OAuth client must exist).
 */
export const GOOGLE_WEB_CLIENT_ID = '453311658725-s55gcpidi4h6kf38hgqhmrku11ha02ts.apps.googleusercontent.com';
export const GOOGLE_IOS_CLIENT_ID = ''; // set after creating the iOS OAuth client (leave '' for Android)

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    offlineAccess: false,
  });
  configured = true;
}

/** Opens the Google sign-in flow and returns an ID token for /auth/google-login. */
export async function googleSignInIdToken(): Promise<string> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res: any = await GoogleSignin.signIn();
  const idToken: string | undefined = res?.data?.idToken ?? res?.idToken;
  if (!idToken) throw new Error('Google did not return an ID token.');
  return idToken;
}
