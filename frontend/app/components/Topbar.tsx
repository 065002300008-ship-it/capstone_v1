export default function Topbar() {
  return (
    <header className="bg-white h-16 border-b border-gray-200 flex items-center justify-between px-6">
      <div className="font-semibold text-gray-700">
        Website Sistem Informasi Proyek
      </div>
      
      <div className="flex items-center space-x-4">
        <button className="text-gray-500 hover:text-gray-700">
          {/* Ikon Lonceng Sederhana */}
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
            U
          </div>
          <div className="text-sm text-right">
            <div className="font-semibold text-gray-800">User</div>
            <div className="text-xs text-gray-500">Project Manager</div>
          </div>
        </div>
      </div>
    </header>
  );
}