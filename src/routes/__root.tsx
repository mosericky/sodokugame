import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  Navigate,
} from "@tanstack/react-router";

function NotFoundComponent() {
  return <Navigate to="/" replace />;
}