import { ConversationTest } from './ConversationTest';

export const ConversationTab = ({ conversationId }: { conversationId: string }) => {
    return (
        <div className='max-h-screen h-full'>

            <ConversationTest id={conversationId} minimal={false} className="h-full border-none" />
        </div>
    );
};
