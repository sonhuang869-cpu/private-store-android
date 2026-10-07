import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-[45vh] place-items-center">
      <div className="max-w-sm px-6 text-center">
        <Compass className="mx-auto mb-3 size-10 text-muted-foreground/60" aria-hidden />
        <h1 className="text-2xl font-bold">That page does not exist</h1>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">
          The demo data may have been reset, or the link is mistyped.
        </p>
        <Link to="/" className={`${buttonVariants()} h-11`}>Go to the fleet</Link>
      </div>
    </div>
  );
}
