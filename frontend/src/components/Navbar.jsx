function Navbar() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
          RC
        </div>
        <span className="font-semibold text-white">Research Copilot</span>
        <span className="text-xs font-medium bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
          BETA
</span>
      </div>

      <div className="hidden sm:flex items-center gap-6 text-sm text-slate-400">
        <span className="text-white font-medium">Dashboard</span>
        <span>Library</span>
        <span>History</span>
      </div>

      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold text-white">
        {/* Replace with your initials */}
        RS
      </div>
    </nav>
  );
}

export default Navbar;