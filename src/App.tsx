import { matchRoute, useLocation } from "./lib/router";
import { JoinPage } from "./participant/JoinPage";
import { ParticipantPage } from "./participant/ParticipantPage";
import { PresenterApp } from "./presenter/PresenterApp";

export default function App() {
  const { pathname } = useLocation();
  const route = matchRoute(pathname);
  switch (route.name) {
    case "presenter":
      return <PresenterApp />;
    case "join":
      return <JoinPage code={route.code} />;
    case "participant":
      return <ParticipantPage token={route.token} />;
    default:
      return (
        <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-800">
          <p>
            Page not found. <a className="text-teal-700 underline" href="/">Open the presenter workspace</a>
          </p>
        </main>
      );
  }
}
