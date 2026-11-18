import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import App from './App';
import ApplicationBoundary from './components/ApplicationBoundary';
import {diagnostics,observeBrowserFailures} from './lib/observability';
import './styles.css';
import './brand-theme.css';
import './light-theme.css';
import './design-system.css';
import {initializeTheme} from './lib/theme';
initializeTheme();
const stopObserving=observeBrowserFailures(window);
if(import.meta.hot)import.meta.hot.dispose(stopObserving);

const queryClient = new QueryClient({
  queryCache: new QueryCache({onError:(_error,query)=>{if(query.getObserversCount()>0)diagnostics.record('operation','failure',0);}}),
  mutationCache: new MutationCache({onError:()=>diagnostics.record('operation','failure',0)}),
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } }
});
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ApplicationBoundary><App /></ApplicationBoundary>
    </QueryClientProvider>
  </React.StrictMode>
);
