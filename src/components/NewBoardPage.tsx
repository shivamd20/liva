import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateBoard } from '../hooks/useBoards';

export function NewBoardPage() {
    const [title, setTitle] = useState('');
    const [expiresInHours, setExpiresInHours] = useState(0);
    const [isCreating, setIsCreating] = useState(false);
    const navigate = useNavigate();
    const createBoard = useCreateBoard();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        setIsCreating(true);
        try {
            createBoard.mutate({ title: title.trim(), expiresInHours }, {
                onSuccess: (newBoard) => {
                    navigate(`/board/${newBoard.id}`);
                },
                onError: (error) => {
                    console.error("Failed to create board", error);
                    setIsCreating(false);
                }
            });
        } catch (error) {
            console.error("Failed to create board", error);
            setIsCreating(false);
        }
    };

    return (
        <div className="min-h-screen min-w-screen bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
                <div className="text-center">
                    <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                        Create a new board
                    </h2>
                    <p className="mt-2 text-sm text-gray-500">
                        Start a new collaboration session
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <label htmlFor="board-title" className="sr-only">
                                Board Title
                            </label>
                            <input
                                id="board-title"
                                name="title"
                                type="text"
                                required
                                autoFocus
                                className="appearance-none relative block w-full px-4 py-4 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-base transition-colors duration-200 ease-in-out"
                                placeholder="e.g. Q4 Planning, Brainstorming..."
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>

                        <div>
                            <label htmlFor="expiration" className="sr-only">
                                Expiration
                            </label>
                            <select
                                id="expiration"
                                name="expiration"
                                className="appearance-none relative block w-full px-4 py-4 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-base transition-colors duration-200 ease-in-out mt-4"
                                value={expiresInHours}
                                onChange={(e) => setExpiresInHours(Number(e.target.value))}
                            >
                                <option value={0}>Never Expires</option>
                                <option value={1}>1 Hour</option>
                                <option value={2}>2 Hours</option>
                                <option value={6}>6 Hours</option>
                                <option value={12}>12 Hours</option>
                                <option value={24}>24 Hours</option>
                                <option value={168}>1 Week</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 mt-6">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="w-1/2 flex justify-center py-3 px-4 border border-gray-300 text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200"
                            disabled={isCreating}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isCreating || !title.trim()}
                            className={`w-1/2 flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 ${(isCreating || !title.trim()) ? 'opacity-50 cursor-not-allowed' : 'shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                                }`}
                        >
                            {isCreating ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Creating...
                                </span>
                            ) : (
                                'Create Board'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
