// Data Manager Service for AttendWise
// Batches reads, queries efficiently, and coordinates IndexedDB cache + Firestore background sync
import { db } from "./firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { getCachedStore, setCachedStore } from "./idb-cache";
import type { ClassSessionItem, SubjectItem } from "./firebase";

export interface DashboardData {
  sessions: ClassSessionItem[];
  subjects: SubjectItem[];
  lastSyncedAt: number;
}

export const dataManager = {
  async getCachedDashboardData(uid: string): Promise<DashboardData | null> {
    try {
      const [sessions, subjects] = await Promise.all([
        getCachedStore<ClassSessionItem>("sessions"),
        getCachedStore<SubjectItem>("subjects"),
      ]);
      if (sessions.length > 0 || subjects.length > 0) {
        return {
          sessions,
          subjects,
          lastSyncedAt: Date.now(),
        };
      }
    } catch (e) {
      console.warn("Cache read error:", e);
    }
    return null;
  },

  async fetchAndCacheFreshData(uid: string): Promise<DashboardData> {
    try {
      // Efficiently batched query using indexed collections
      const sessionsRef = collection(db, "users", uid, "classSessions");
      const subjectsRef = collection(db, "users", uid, "subjects");

      const [sessionsSnap, subjectsSnap] = await Promise.all([
        getDocs(query(sessionsRef, orderBy("scheduledStartAt", "asc"))),
        getDocs(subjectsRef),
      ]);

      const sessions: ClassSessionItem[] = [];
      sessionsSnap.forEach((d) => sessions.push(d.data() as ClassSessionItem));

      const subjects: SubjectItem[] = [];
      subjectsSnap.forEach((d) => subjects.push(d.data() as SubjectItem));

      // Save to IndexedDB cache in background
      await Promise.all([
        setCachedStore("sessions", sessions),
        setCachedStore("subjects", subjects),
      ]);

      return {
        sessions,
        subjects,
        lastSyncedAt: Date.now(),
      };
    } catch (err) {
      console.warn("Firestore fetch error, falling back to cache:", err);
      const cached = await this.getCachedDashboardData(uid);
      if (cached) return cached;
      throw err;
    }
  },
};
