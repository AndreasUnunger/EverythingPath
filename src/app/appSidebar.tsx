'use client';
import { OrganizationSwitcher, SignInButton, UserButton } from '@clerk/nextjs';
import { Authenticated, Unauthenticated, AuthLoading } from 'convex/react';
import { HomeIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { KeepIcon } from '~/components/keepIcon';
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
  SidebarRail,
  useSidebar,
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
  const { open } = useSidebar();
  const pathname = usePathname();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarContent className="overflow-x-hidden">
          <div className="w-max py-1">
            <Link
              href={'/'}
              className="flex items-center gap-4 text-2xl font-bold"
            >
              <KeepIcon />
              KEEPNET
            </Link>
          </div>
        </SidebarContent>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname == item.url}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarContent>
          <div className="container flex items-center overflow-x-hidden p-2 pr-4">
            <Unauthenticated>
              <SignInButton />
            </Unauthenticated>
            <Authenticated>
              <div className="container mx-auto flex justify-between">
                <div hidden={!open}>
                  <OrganizationSwitcher />
                </div>
                <div className="ml-[-6]">
                  <UserButton />
                </div>
              </div>
            </Authenticated>
            <AuthLoading>
              <p>Still loading</p>
            </AuthLoading>
          </div>
        </SidebarContent>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

