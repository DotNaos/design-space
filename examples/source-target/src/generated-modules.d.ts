declare module "@clerk/react" {
  export const ClerkProvider: import("react").ComponentType<{ publishableKey: string; children?: import("react").ReactNode }>;
  export const RedirectToSignIn: import("react").ComponentType;
  export const SignInButton: import("react").ComponentType<{ mode?: string; children?: import("react").ReactNode }>;
  export const SignUpButton: import("react").ComponentType<{ mode?: string; children?: import("react").ReactNode }>;
  export const UserButton: import("react").ComponentType;
  export function useAuth(): { isLoaded: boolean; isSignedIn: boolean };
}

declare module "@dotnaos/react-ui" {
  export const Scrollable: import("react").ComponentType<{ className?: string; children?: import("react").ReactNode }>;
}

declare module "@project-design-space-target-daa2facd/client" {
  export interface AppStatus {
    name: string;
    version: string;
    environment: string;
  }

  export function readAppStatus(options: { baseUrl: string }): Promise<AppStatus>;
}
