import {
    getAuthenticatedSession,
    getAuthenticatedUser,
    refreshAuthenticatedSession,
} from "./repositories/authRepository";

export const ensureAuthenticatedUserId = async () => {
    const { data: userData, error: userError } = await getAuthenticatedUser();
    if (!userError && userData?.user?.id) {
        return userData.user.id;
    }

    const { data: sessionData } = await getAuthenticatedSession();
    if (sessionData?.session) {
        const { data: refreshedData, error: refreshError } = await refreshAuthenticatedSession();
        if (!refreshError && refreshedData?.user?.id) {
            return refreshedData.user.id;
        }
    }

    return null;
};
