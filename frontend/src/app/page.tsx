"use client";



import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center">
      <Link href="/create" className="px-6 py-3 text-sm font-medium text-white bg-zinc-900 rounded-full hover:bg-zinc-800 transition-colors dark:bg-white dark:text-black dark:hover:bg-zinc-200 shadow-lg">
        Create a Fund
      </Link>
    </div>
  );
}
