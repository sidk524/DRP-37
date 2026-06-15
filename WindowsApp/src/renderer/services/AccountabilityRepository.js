function api() {
    if (!window.tether) throw new Error("Tether desktop API is unavailable.");
    return window.tether;
}

export const getAccountabilityPreferences = () => api().getAccountabilityPreferences();
export const updateAccountabilityPreferences = (value) => api().updateAccountabilityPreferences(value);
export const getAccountabilityInbox = () => api().getAccountabilityInbox();
export const markAccountabilityNotificationRead = (id) => api().markAccountabilityNotificationRead(id);
export const sendAccountabilityMessage = (attemptId, payload) => api().sendAccountabilityMessage(attemptId, payload);
export const onAccountabilityEvent = (callback) => api().onAccountabilityEvent(callback);
