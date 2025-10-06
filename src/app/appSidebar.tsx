'use client';
import { OrganizationSwitcher, SignInButton, UserButton } from '@clerk/nextjs';
import { Authenticated, Unauthenticated, AuthLoading } from 'convex/react';
import { HomeIcon } from 'lucide-react';
import Link from 'next/link';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '~/components/ui/sidebar';

const items = [
  {
    title: 'My Keep',
    url: '/',
    icon: HomeIcon,
  },
  {
    title: 'Campaigns',
    url: '/campaigns',
    icon: HomeIcon,
  },
];

export default function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="container flex w-max items-center p-4">
          <Link href={'/'} className="text-2xl font-bold">
            KEEPNET
          </Link>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="container bg-gray-50 p-2 pr-4">
          <div className="container flex items-center">
            <Unauthenticated>
              <SignInButton />
            </Unauthenticated>
            <Authenticated>
              <div className="container mx-auto flex justify-between">
                <div>
                  <OrganizationSwitcher />
                </div>
                <div>
                  <UserButton />
                </div>
              </div>
            </Authenticated>
            <AuthLoading>
              <p>Still loading</p>
            </AuthLoading>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
