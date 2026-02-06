import mixpanel, { Config, Dict } from 'mixpanel-browser';

const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN || 'YOUR_MIXPANEL_TOKEN';

const isProduction = true; // TODO for later

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

    // System Shots (Reels) - Engagement
    SYSTEM_SHOTS_VIEW_OPEN: 'System Shots: View Open',
    SYSTEM_SHOTS_VIEW_CLOSE: 'System Shots: View Close',
    SYSTEM_SHOTS_REEL_VIEW: 'System Shots: Reel View',
    SYSTEM_SHOTS_REEL_TIME_SPENT: 'System Shots: Reel Time Spent',
    SYSTEM_SHOTS_REEL_ANSWER: 'System Shots: Reel Answer',
    SYSTEM_SHOTS_REEL_CONTINUE: 'System Shots: Reel Continue',
    SYSTEM_SHOTS_REEL_SKIP: 'System Shots: Reel Skip',
    SYSTEM_SHOTS_REEL_SCROLL: 'System Shots: Reel Scroll',
    SYSTEM_SHOTS_SIDEBAR_OPEN: 'System Shots: Sidebar Open',
    SYSTEM_SHOTS_SIDEBAR_CLOSE: 'System Shots: Sidebar Close',
    SYSTEM_SHOTS_TOPIC_SELECT: 'System Shots: Topic Select',
    SYSTEM_SHOTS_TOPIC_CLEAR: 'System Shots: Topic Clear',
    SYSTEM_SHOTS_BACK: 'System Shots: Back',
    SYSTEM_SHOTS_PROGRESS_OPEN: 'System Shots: Progress Open',
    SYSTEM_SHOTS_PROGRESS_CLOSE: 'System Shots: Progress Close',
    SYSTEM_SHOTS_PROGRESS_CONCEPT_EXPAND: 'System Shots: Progress Concept Expand',
    SYSTEM_SHOTS_PROGRESS_LEVEL_BREAKDOWN_EXPAND: 'System Shots: Progress Level Breakdown Expand',
    SYSTEM_SHOTS_FEED_LOAD_START: 'System Shots: Feed Load Start',
    SYSTEM_SHOTS_FEED_LOAD_SUCCESS: 'System Shots: Feed Load Success',
    SYSTEM_SHOTS_FEED_LOAD_ERROR: 'System Shots: Feed Load Error',
    SYSTEM_SHOTS_FEED_END: 'System Shots: Feed End',
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
