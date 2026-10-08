import { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

/**
 * Native Google sign-in (requires a development build — NOT Expo Go).
 * webClientId makes Google return an ID token whose `aud` matches the backend's
 * GOOGLE_CLIENT_ID, which /auth/google-login verifies. On Android the app is
 * matched by package name + SHA-1 (an Android OAuth client must exist).
 */
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '453311658725-s55gcpidi4h6kf38hgqhmrku11ha02ts.apps.googleusercontent.com';
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  if (Platform.OS === 'ios' && !GOOGLE_IOS_CLIENT_ID) {
    throw new Error('Google sign-in is unavailable in this iOS build. Use your other sign-in method.');
  }
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    offlineAccess: false,
  });
  configured = true;
}

/** Opens the Google sign-in flow and returns an ID token for /auth/google-login. */
let signingIn = false;
export async function googleSignInIdToken(): Promise<string | null> {
  if (signingIn) return null;
  signingIn = true;
  try {
    ensureConfigured();
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // A fresh chooser prevents another SirfBazar user inheriting the SDK's selected account.
    await GoogleSignin.signOut();
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;
    if (!response.data.idToken) throw new Error('Google did not return a sign-in token. Please try again.');
    return response.data.idToken;
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS) return null;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Update Google Play services or use your other sign-in method.');
      }
    }
    throw error;
  } finally { signingIn = false; }
}
