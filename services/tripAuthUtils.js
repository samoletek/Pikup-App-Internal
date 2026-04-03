import {
    getAuthenticatedSession,
    getAuthenticatedUser,
    refreshAuthenticatedSession,
} from "./repositories/authRepository";

export const ensureAuthenticatedUserId = async () => {
    const { data: sessionData } = await getAuthenticatedSession();
    const sessionUserId = sessionData?.session?.user?.id || null;
    if (sessionUserId) {
        return sessionUserId;
    }

    const { data: userData, error: userError } = await getAuthenticatedUser();
    if (!userError && userData?.user?.id) {
        return userData.user.id;
    }

    const hasRefreshToken = Boolean(sessionData?.session?.refresh_token);
    if (hasRefreshToken) {
        const { data: refreshedData, error: refreshError } = await refreshAuthenticatedSession();
        if (!refreshError && refreshedData?.user?.id) {
            return refreshedData.user.id;
        }
    }

    return null;
};
