import { Navigate, useParams } from 'react-router';
import { CountingGame } from '../activities/counting/CountingGame';
import { FindGame } from '../activities/find/FindGame';
import { SayGame } from '../activities/say/SayGame';
import { type Game, paths, resolveGame } from '../topics/topics';
import { Screen } from '../ui/Screen';

export function PlayScreen() {
  const { topicId, levelId, activityId } = useParams();
  const game = resolveGame(topicId, levelId, activityId);
  if (!game) return <Navigate to={paths.home} replace />;
  return <Screen tint={game.topic.tint}>{renderGame(game)}</Screen>;
}

function renderGame(game: Game) {
  const exitTo = paths.topic(game.topic.id);
  // A new key per game, so switching games never carries state across.
  const key = `${game.topic.id}/${game.level.id}/${game.kind === 'count' ? game.story.id : game.kind}`;
  switch (game.kind) {
    case 'find':
      return <FindGame key={key} deck={game.level.deck} exitTo={exitTo} />;
    case 'say':
      return <SayGame key={key} deck={game.level.deck} exitTo={exitTo} />;
    case 'count':
      return <CountingGame key={key} story={game.story} range={game.level} exitTo={exitTo} />;
  }
}
