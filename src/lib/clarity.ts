import Clarity from '@microsoft/clarity';

export const initClarity = () => {
    const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID;

    if (projectId) {
        Clarity.init(projectId);
    } else {
        console.warn('Microsoft Clarity Project ID not found in environment variables.');
    }
};
