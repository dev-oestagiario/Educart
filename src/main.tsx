import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import App from './App';
import ApplicationBoundary from './components/ApplicationBoundary';
import {diagnostics,observeBrowserFailures} from './lib/observability';
import {initSentry,reportFailure} from './lib/sentry';
import './styles.css';
import './brand-theme.css';
import './light-theme.css';
import './design-system.css';
import './dropdowns.css';
import {initializeTheme} from './lib/theme';
initSentry();
initializeTheme();
const stopObserving=observeBrowserFailures(window);
if(import.meta.hot)import.meta.hot.dispose(stopObserving);

const queryEpochs=new WeakMap<object,number>(),mutationEpochs=new WeakMap<object,number>();
const queries=new QueryCache({onError:(_error,query)=>{const epoch=queryEpochs.get(query);if(epoch!==undefined&&query.getObserversCount()>0){diagnostics.record('operation','failure',0,epoch);reportFailure('operation');}}});
const mutations=new MutationCache({onMutate:(_variables,mutation)=>{mutationEpochs.set(mutation,diagnostics.generation());},onError:(_error,_variables,_context,mutation)=>{const epoch=mutationEpochs.get(mutation);if(epoch!==undefined){diagnostics.record('operation','failure',0,epoch);reportFailure('operation');}}});
const stopQueries=queries.subscribe(event=>{if(event.type==='updated'&&event.action.type==='fetch')queryEpochs.set(event.query,diagnostics.generation());});
if(import.meta.hot)import.meta.hot.dispose(stopQueries);
const queryClient = new QueryClient({
  queryCache:queries,mutationCache:mutations,
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } }
});
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ApplicationBoundary><App /></ApplicationBoundary>
    </QueryClientProvider>
  </React.StrictMode>
);
