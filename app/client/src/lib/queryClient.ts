import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getApiUrl } from "./config";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      // Try to parse as JSON first
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await res.json();
        throw new Error(errorData.message || `${res.status}: ${res.statusText}`);
      } else {
        // If not JSON, treat as text
        const text = await res.text();
        console.error('Non-JSON error response:', text);
        throw new Error(`${res.status}: ${res.statusText}`);
      }
    } catch (parseError) {
      // If JSON parsing fails, return the status text
      console.error('Error parsing error response:', parseError);
      throw new Error(`${res.status}: ${res.statusText} - Server error`);
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = typeof queryKey[0] === "string" 
      ? queryKey[0].startsWith("http") 
        ? queryKey[0] 
        : getApiUrl(queryKey[0])
      : queryKey[0];
      
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Supabase subscription functionality is not implemented yet
// To implement this, we would need to add the Supabase client
/*
export function subscribeToTable(table: string, callback: (payload: any) => void) {
  return supabase
    .channel('table_db_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => callback(payload)
    )
    .subscribe();
}
*/

/**
 * Function to handle attendance updates in offline mode
 * Stores pending updates to be synced when back online
 */
export function queueAttendanceUpdate(sessionId: number, userId: number, status: string) {
  // Get existing queue or create new one
  const queueString = localStorage.getItem('pendingAttendanceUpdates') || '[]';
  const queue = JSON.parse(queueString);
  
  // Add new update to queue
  queue.push({
    sessionId,
    userId,
    status,
    timestamp: Date.now()
  });
  
  // Save updated queue
  localStorage.setItem('pendingAttendanceUpdates', JSON.stringify(queue));
  console.log("Queued attendance update for offline sync:", { sessionId, userId, status });
}

/**
 * Process any pending attendance updates
 * Call this when the app comes back online
 */
export async function syncPendingAttendanceUpdates() {
  const queueString = localStorage.getItem('pendingAttendanceUpdates');
  if (!queueString) return;
  
  const queue = JSON.parse(queueString);
  if (queue.length === 0) return;
  
  console.log(`Attempting to sync ${queue.length} pending attendance updates`);
  
  const failedUpdates = [];
  
  for (const update of queue) {
    try {
      await apiRequest('POST', getApiUrl('/api/attendance'), {
        sessionId: update.sessionId,
        userId: update.userId,
        status: update.status
      });
      console.log('Successfully synced attendance update:', update);
    } catch (error) {
      console.error('Failed to sync attendance update:', update, error);
      failedUpdates.push(update);
    }
  }
  
  // Save any failed updates back to the queue
  localStorage.setItem('pendingAttendanceUpdates', JSON.stringify(failedUpdates));
}

// Listen for online status and sync when back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('App is back online. Syncing pending updates...');
    syncPendingAttendanceUpdates();
  });
}
