import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export default function NavBar() {
  return (
    <header className="fixed top-0 left-0 w-full bg-white/80 sky-50 backdrop-blur-xl border-b border-slate-200">
      <div className="flex flex-row p-4 w-full place-content-between items-center">
        <h1 className="font-bold text-gray-900">{"EverythingPath"}</h1>
        <SignedOut>
          <SignInButton />
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
    </header>
  )
}
