import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth, db, initializeUserProfile, ensureSistecTimetableLoaded, TIMEZONE } from "./firebase";
import { SISTEC_METADATA } from "../data/sistec-timetable";

export interface AppStudentUser {
  uid: string;
  email: string;
  displayName: string;
  isFirebaseUser: boolean;
}

interface StoredStudentAccount {
  uid: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
}

const REGISTRY_STORAGE_KEY = "attendwise_registered_students_v2";
const ACTIVE_SESSION_KEY = "attendwise_active_student_session_v2";

// Secure SHA-256 password hashing with application salt
export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`attendwise-sistec-salt-2026:${password}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getLocalRegistry(): Record<string, StoredStudentAccount> {
  try {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalRegistry(registry: Record<string, StoredStudentAccount>): void {
  try {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registry));
  } catch (err) {
    console.warn("Failed to persist student registry:", err);
  }
}

export function getStoredActiveSession(): AppStudentUser | null {
  try {
    const isSessionActive = sessionStorage.getItem("attendwise_session_active") === "true";
    if (!isSessionActive) {
      return null;
    }
    const raw = sessionStorage.getItem(ACTIVE_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredActiveSession(user: AppStudentUser | null): void {
  try {
    if (user) {
      sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(user));
      sessionStorage.setItem("attendwise_session_active", "true");
      // Clean up permanent localStorage session flags so fresh browser visits always land on the landing page
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      localStorage.removeItem("attendwise_session_active");
    } else {
      sessionStorage.removeItem(ACTIVE_SESSION_KEY);
      sessionStorage.removeItem("attendwise_session_active");
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      localStorage.removeItem("attendwise_session_active");
    }
  } catch (err) {
    console.warn("Failed to set active session:", err);
  }
}

export function isEmailRegisteredLocally(email: string): boolean {
  const norm = email.trim().toLowerCase();
  const reg = getLocalRegistry();
  return Boolean(reg[norm]);
}

export interface AuthResult {
  user: AppStudentUser;
  firebaseAuthEnabled: boolean;
  message?: string;
}

/**
 * Register a student with unique email and password.
 * Validates inputs, prevents duplicate emails, and attempts Firebase Auth.
 * If Firebase has not yet enabled Email/Password provider (auth/operation-not-allowed),
 * saves to local student registry with hashed password so the student is never blocked.
 */
export async function registerStudent(
  email: string,
  pass: string,
  name: string
): Promise<AuthResult> {
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("Please enter your full name.");
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    throw new Error("Please enter a valid college email address (e.g. student@sistec.ac.in).");
  }

  // Password length validation
  if (!pass || pass.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  // Check unique email registration
  const registry = getLocalRegistry();
  if (registry[trimmedEmail]) {
    throw new Error("This email is already registered. Please sign in with your password.");
  }

  // Attempt Firebase Auth creation
  let firebaseSuccess = false;
  let finalUid = "";

  try {
    const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, pass);
    await updateProfile(cred.user, { displayName: trimmedName });
    await initializeUserProfile(cred.user, trimmedName);
    finalUid = cred.user.uid;
    firebaseSuccess = true;
    ensureSistecTimetableLoaded(finalUid).catch(console.warn);
  } catch (err: any) {
    const code = err?.code || "";
    if (code === "auth/email-already-in-use") {
      throw new Error("This email is already registered. Please sign in with your password.");
    }
    if (code === "auth/invalid-email") {
      throw new Error("Please enter a valid college email address.");
    }
    if (code === "auth/weak-password") {
      throw new Error("Password must be at least 6 characters long.");
    }

    if (code === "auth/admin-restricted-operation") {
      throw new Error("Firebase Authentication: User registration is restricted by administrator in Firebase Console (auth/admin-restricted-operation).");
    }

    // If Firebase Auth operation-not-allowed (Email/Password provider not enabled in Console)
    if (code === "auth/operation-not-allowed" || err?.message?.includes("operation-not-allowed")) {
      console.warn("Firebase Auth Email/Password provider is disabled in Firebase Console. Registering in local secure student vault.");
      finalUid = `student-${trimmedEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;
      firebaseSuccess = false;
    } else {
      // Other Firebase errors
      throw new Error(err?.message?.replace(/^Firebase:\s*/, "") || "Registration failed. Please check your credentials.");
    }
  }

  // Store in student registry with SHA-256 hashed password
  const passwordHash = await hashPassword(pass);
  registry[trimmedEmail] = {
    uid: finalUid,
    email: trimmedEmail,
    displayName: trimmedName,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  saveLocalRegistry(registry);

  const studentUser: AppStudentUser = {
    uid: finalUid,
    email: trimmedEmail,
    displayName: trimmedName,
    isFirebaseUser: firebaseSuccess,
  };

  setStoredActiveSession(studentUser);

  return {
    user: studentUser,
    firebaseAuthEnabled: firebaseSuccess,
    message: firebaseSuccess
      ? "Account created and synchronized with Firebase."
      : "Account registered in student directory. (Note: Enable Email/Password provider in Firebase Console to enable cloud sync).",
  };
}

/**
 * Sign in a student with their registered email and password.
 * Distinguishes Firebase Authentication failures from credential mismatches and Firestore permission errors.
 */
export async function loginStudent(
  email: string,
  pass: string
): Promise<AuthResult> {
  const trimmedEmail = email.trim().toLowerCase();

  if (!trimmedEmail || !pass) {
    throw new Error("Wrong credentials. Please check your email and password.");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    throw new Error("Wrong credentials. Please check your email and password.");
  }

  // 1. Try Firebase Auth first
  try {
    const cred = await signInWithEmailAndPassword(auth, trimmedEmail, pass);
    await initializeUserProfile(cred.user, cred.user.displayName || "Student");
    ensureSistecTimetableLoaded(cred.user.uid).catch(console.warn);
    const studentUser: AppStudentUser = {
      uid: cred.user.uid,
      email: trimmedEmail,
      displayName: cred.user.displayName || "Student",
      isFirebaseUser: true,
    };
    setStoredActiveSession(studentUser);
    return {
      user: studentUser,
      firebaseAuthEnabled: true,
    };
  } catch (err: any) {
    const code = err?.code || "";

    // Graceful check in secure local student registry vault
    const registry = getLocalRegistry();
    const account = registry[trimmedEmail];

    if (account) {
      const inputHash = await hashPassword(pass);
      if (inputHash === account.passwordHash) {
        const studentUser: AppStudentUser = {
          uid: account.uid,
          email: account.email,
          displayName: account.displayName,
          isFirebaseUser: false,
        };
        setStoredActiveSession(studentUser);

        return {
          user: studentUser,
          firebaseAuthEnabled: false,
          message: "Signed in with registered credentials.",
        };
      } else {
        throw new Error("Wrong credentials. Please check your email and password.");
      }
    }

    // Specific Firebase Authentication error reporting (Distinguish errors)
    if (code === "auth/wrong-password" || code === "auth/user-not-found" || code === "auth/invalid-credential") {
      throw new Error("Wrong credentials. Please check your email and password.");
    }
    if (code === "auth/admin-restricted-operation") {
      throw new Error("Firebase Authentication: Operation is restricted by administrator in Firebase Console (auth/admin-restricted-operation).");
    }
    if (code === "auth/operation-not-allowed") {
      throw new Error("Firebase Authentication: Email/Password sign-in provider is not enabled in Firebase Console (auth/operation-not-allowed).");
    }
    if (code === "auth/user-disabled") {
      throw new Error("This student account has been disabled in Firebase Authentication.");
    }
    if (code === "auth/too-many-requests") {
      throw new Error("Access temporarily blocked due to multiple failed login attempts. Please reset password or try again later.");
    }
    if (code === "auth/network-request-failed") {
      throw new Error("Network connection failed. Please check your internet connectivity.");
    }

    throw new Error(err?.message?.replace(/^Firebase:\s*/, "") || "Wrong credentials. Please check your email and password.");
  }
}

/**
 * Log out student and clear active session
 */
export async function logoutStudentUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn("Firebase signout error:", err);
  }
  setStoredActiveSession(null);
  sessionStorage.removeItem("attendwise_session_active");
  localStorage.removeItem("attendwise_session_active");
}
