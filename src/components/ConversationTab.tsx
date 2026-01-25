import { ConversationV2 } from './conversation-v2/ConversationV2';

export const ConversationTab = ({ conversationId, excalidrawAPI }: { conversationId: string; excalidrawAPI: any | null }) => {
    return (
        <div className='max-h-screen h-full'>
            <ConversationV2 conversationId={conversationId} className="h-full border-none" excalidrawAPI={excalidrawAPI} />
        </div>
    );
};
