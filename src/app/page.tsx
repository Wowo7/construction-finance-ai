import ChatInterface from "./components/ChatInterface";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              CF
            </div>
            <div>
              <h1 className="font-semibold text-gray-900 text-sm">
                Construction Finance AI
              </h1>
              <p className="text-xs text-gray-500">
                Apex Construction Group
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5" />
              3 Active Projects
            </span>
          </div>
        </div>
      </header>

      {/* Chat */}
      <ChatInterface />
    </main>
  );
}
