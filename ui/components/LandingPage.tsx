import { Link } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';

export function LandingPage() {
    return (
        <div className="min-h-screen min-w-screen bg-gray-50 flex flex-col items-center justify-center">
            <div className="text-center max-w-2xl mx-auto px-4">
                <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg inline-block mb-8">
                    <LayoutGrid className="w-12 h-12 text-white" />
                </div>
                <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
                    Welcome to Liva
                </h1>
                <p className="text-xl text-gray-600 mb-12 max-w-lg mx-auto">
                    Collaborative whiteboarding made simple. Create, share, and visualize your ideas in real-time.
                </p>
                <Link 
                    to="/board"
                    className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white bg-indigo-600 rounded-full hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                >
                    Go to Boards
                </Link>
            </div>
        </div>
    );
}

