import { Celebrations } from './components/game';
import { TabBar } from './components/small';
import { StoreProvider } from './data/store';
import { useRoute } from './router';
import { DayScreen } from './screens/Day';
import { PlanScreen } from './screens/Plan';
import { Progress } from './screens/Progress';
import { Settings } from './screens/Settings';
import { Today } from './screens/Today';

export function App() {
  const route = useRoute();
  return (
    <StoreProvider>
      <div className="app">
        {route.name === 'today' && <Today />}
        {route.name === 'plan' && <PlanScreen />}
        {route.name === 'day' && <DayScreen key={route.date} date={route.date} />}
        {route.name === 'progress' && <Progress />}
        {route.name === 'settings' && <Settings />}
      </div>
      <TabBar current={route.name} />
      <Celebrations />
    </StoreProvider>
  );
}
