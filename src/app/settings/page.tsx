import { UserProfile } from "@clerk/nextjs";
import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-[#0c1929] text-white">
      <header className="flex items-center gap-4 px-6 py-4 border-b border-[#1e3a5f]/30">
        <Link
          href="/dashboard"
          className="text-blue-200/60 hover:text-white transition"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="text-lg font-bold">Settings</h1>
      </header>
      <div className="flex justify-center py-12">
        <UserProfile />
      </div>
    </div>
  );
}
