import mixpanel, { Config, Dict } from 'mixpanel-browser';

const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN || 'YOUR_MIXPANEL_TOKEN';

const isProduction = import.meta.env.PROD;

const config: Partial<Config> = {
    debug: !isProduction,
    track_pageview: true,
    persistence: 'localStorage',
};

export const MixpanelEvents = {
    // Auth
    AUTH_SIGN_UP: 'Auth: Sign Up',
    AUTH_LOGIN: 'Auth: Login',
    AUTH_LOGOUT: 'Auth: Logout',
    AUTH_ERROR: 'Auth: Error',

    // Board
    BOARD_CREATE: 'Board: Create',
    BOARD_OPEN: 'Board: Open',
    BOARD_DELETE: 'Board: Delete',
    BOARD_DUPLICATE: 'Board: Duplicate',
    BOARD_RENAME: 'Board: Rename',
    BOARD_SHARE_TOGGLE: 'Board: Share Toggle',
    BOARD_HISTORY_OPEN: 'Board: History Open',

    // Navigation
    NAV_HOME: 'Nav: Home',
    NAV_BOARDS: 'Nav: Boards',
    NAV_NEW_BOARD: 'Nav: New Board',
    APP_OPEN: 'App: Open',

    // AI
    AI_GENERATE_START: 'AI: Generate Start',
    AI_GENERATE_SUCCESS: 'AI: Generate Success',
    AI_GENERATE_ERROR: 'AI: Generate Error',
} as const;

export type MixpanelEvent = typeof MixpanelEvents[keyof typeof MixpanelEvents];

class MixpanelService {
    private static instance: MixpanelService;
    private isInitialized = false;

    private constructor() { }

    public static getInstance(): MixpanelService {
        if (!MixpanelService.instance) {
            MixpanelService.instance = new MixpanelService();
        }
        return MixpanelService.instance;
    }

    public init() {
        if (this.isInitialized) return;

        if (MIXPANEL_TOKEN === 'YOUR_MIXPANEL_TOKEN') {
            console.warn('Mixpanel Token not found. Analytics will not be tracked.');
            return;
        }

        mixpanel.init(MIXPANEL_TOKEN, config);
        this.isInitialized = true;
    }

    public track(name: MixpanelEvent | string, props?: Dict) {
        if (!this.isInitialized) return;
        mixpanel.track(name, props);
    }

    public identify(id: string, props?: Dict) {
        if (!this.isInitialized) return;
        mixpanel.identify(id);
        if (props) {
            mixpanel.people.set(props);
        }
    }

    public alias(id: string) {
        if (!this.isInitialized) return;
        mixpanel.alias(id);
    }

    public people(props: Dict) {
        if (!this.isInitialized) return;
        mixpanel.people.set(props);
    }

    public reset() {
        if (!this.isInitialized) return;
        mixpanel.reset();
    }
}

export const mixpanelService = MixpanelService.getInstance();
