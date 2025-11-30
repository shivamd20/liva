import * as Dialog from '@radix-ui/react-dialog';
import { User, ShieldCheck } from 'lucide-react';
import { signIn } from '../lib/auth-client';

interface AuthDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ isOpen, onOpenChange }: AuthDialogProps) {
    const handleGuest = async () => {
        await signIn.anonymous();
        onOpenChange(false);
    };

    const handleGoogle = async () => {
        await signIn.social({ provider: 'google' });
        onOpenChange(false);
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-0 w-full max-w-2xl z-50 animate-in zoom-in-95 duration-200 overflow-hidden border border-gray-100 focus:outline-none">
                    
                    <div className="grid md:grid-cols-2">
                        {/* Left side - Guest */}
                        <div className="p-8 bg-gray-50 flex flex-col justify-center border-b md:border-b-0 md:border-r border-gray-100">
                            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-6 mx-auto md:mx-0">
                                <User className="w-6 h-6 text-gray-600" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2 text-center md:text-left">Continue as Guest</h2>
                            <p className="text-gray-500 mb-6 text-sm text-center md:text-left">
                                Try out Liva instantly without creating an account. Perfect for quick sketches and ideas.
                            </p>
                            
                            <div className="space-y-3 mb-8">
                                <div className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2" />
                                    <p className="text-sm text-gray-600">No registration required</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2" />
                                    <p className="text-sm text-gray-600">Instant access</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-2" />
                                    <p className="text-sm text-gray-600">Data lives only for the duration of your browser session</p>
                                </div>
                            </div>

                            <button 
                                onClick={handleGuest}
                                className="w-full py-2.5 px-4 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-gray-200"
                            >
                                Continue as Guest
                            </button>
                        </div>

                        {/* Right side - Login */}
                        <div className="p-8 bg-white flex flex-col justify-center">
                            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-6 mx-auto md:mx-0">
                                <ShieldCheck className="w-6 h-6 text-indigo-600" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2 text-center md:text-left">Sign In / Sign Up</h2>
                            <p className="text-gray-500 mb-6 text-sm text-center md:text-left">
                                Create an account to sync your boards across devices and collaborate with others.
                            </p>

                            <div className="space-y-3 mb-8">
                                <div className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2" />
                                    <p className="text-sm text-gray-600">Cloud sync across devices</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2" />
                                    <p className="text-sm text-gray-600">Persistent storage</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2" />
                                    <p className="text-sm text-gray-600">Collaborate with others</p>
                                </div>
                            </div>

                            <button 
                                onClick={handleGoogle}
                                className="w-full py-2.5 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Sign in with Google
                            </button>
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

