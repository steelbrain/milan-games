import { Navigate, Route, Routes } from 'react-router';
import { HomeScreen } from '../screens/HomeScreen';
import { PlayScreen } from '../screens/PlayScreen';
import { TopicScreen } from '../screens/TopicScreen';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/topic/:topicId" element={<TopicScreen />} />
      <Route path="/play/:topicId/:levelId/:activityId" element={<PlayScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
