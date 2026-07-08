import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout";

// Pages
import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients";
import ClientDetail from "@/pages/client-detail";
import Personas from "@/pages/personas";
import PersonaDetail from "@/pages/persona-detail";
import Campaigns from "@/pages/campaigns";
import CampaignDetail from "@/pages/campaign-detail";
import Drafts from "@/pages/drafts";
import DraftDetail from "@/pages/draft-detail";
import SlackApproval from "@/pages/slack-approval";
import SlackAppSetup from "@/pages/slack-app-setup";
import TestFlow from "@/pages/test-flow";
import Onboarding from "@/pages/onboarding";
import InternalSetup from "@/pages/internal-setup";
import Logs from "@/pages/logs";
import Settings from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/clients" component={Clients} />
        <Route path="/clients/:id" component={ClientDetail} />
        <Route path="/personas" component={Personas} />
        <Route path="/personas/:id" component={PersonaDetail} />
        <Route path="/campaigns" component={Campaigns} />
        <Route path="/campaigns/:id" component={CampaignDetail} />
        <Route path="/drafts" component={Drafts} />
        <Route path="/drafts/:id" component={DraftDetail} />
        <Route path="/slack-approval" component={SlackApproval} />
        <Route path="/slack-app-setup" component={SlackAppSetup} />
        <Route path="/test-flow" component={TestFlow} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/internal-setup" component={InternalSetup} />
        <Route path="/logs" component={Logs} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
