import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Layout } from "@/components/Layout";
import Fleet from "@/pages/Fleet";
import NotFound from "@/pages/NotFound";

const Catalogue = lazy(() => import("@/pages/Catalogue"));
const Devices = lazy(() => import("@/pages/Devices"));
const DeviceDetail = lazy(() => import("@/pages/DeviceDetail"));
const Notes = lazy(() => import("@/pages/Notes"));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={
        <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Fleet />} />
            <Route path="apps" element={<Catalogue />} />
            <Route path="devices" element={<Devices />} />
            <Route path="device/:id" element={<DeviceDetail />} />
            <Route path="notes" element={<Notes />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  );
}
