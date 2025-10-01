"use client"

import { OrganizationSwitcher, SignInButton, UserButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";

export default function NavBar() {
  return (
    <header className="fixed top-0 left-0 w-full bg-gray-50 sky-50 backdrop-blur-xl border-b border-slate-200">
      <div className="flex flex-row p-4 w-full place-content-between items-center">
        <h1 className="font-bold text-gray-900">{"EverythingPath"}</h1>
        <Unauthenticated>
          <SignInButton />
        </Unauthenticated>
        <Authenticated >
          <div className="flex gap-2">
            <OrganizationSwitcher />
            <UserButton />
          </div>
        </Authenticated>
        <AuthLoading>
          <p>Still loading</p>
        </AuthLoading>
      </div>
    </header>
  )
}
