import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { useAnnouncement, useAudio } from '../services/audio';
import { usePersistentState } from '../services/usePersistentState';
import { activityChoices, findTopic, paths, type Topic } from '../topics/topics';
import { cx } from '../ui/cx';
import { Screen } from '../ui/Screen';
import { TopBar } from '../ui/TopBar';
import styles from './TopicScreen.module.css';

export function TopicScreen() {
  const { topicId } = useParams();
  const topic = findTopic(topicId);
  if (!topic) return <Navigate to={paths.home} replace />;
  return <TopicMenu key={topic.id} topic={topic} />;
}

/** Start options for a topic: pick a level, then pick what to play. */
function TopicMenu({ topic }: { topic: Topic }) {
  const navigate = useNavigate();
  const { play } = useAudio();
  useAnnouncement(topic.greeting);

  const levelIds: readonly string[] = topic.levels.map((level) => level.id);
  const [levelId, setLevelId] = usePersistentState(
    `level:${topic.id}`,
    levelIds[0] ?? '',
    (value): value is string => typeof value === 'string' && levelIds.includes(value),
  );

  return (
    <Screen tint={topic.tint}>
      <TopBar onBack={() => void navigate(paths.home)} backLabel="Home" backIcon="🏠">
        <h1 className={styles.title}>
          <span aria-hidden="true">{topic.emoji}</span> {topic.title}
        </h1>
      </TopBar>
      <div className={styles.body}>
        <fieldset className={styles.levels}>
          <legend className={styles.question}>{topic.levelQuestion}</legend>
          <div className={styles.levelOptions}>
            {topic.levels.map((level) => (
              <label
                key={level.id}
                className={cx(styles.level, level.id === levelId && styles.selected)}
              >
                <input
                  type="radio"
                  name="level"
                  className={styles.radio}
                  value={level.id}
                  checked={level.id === levelId}
                  onChange={() => {
                    play('tap');
                    setLevelId(level.id);
                  }}
                />
                {level.label}
              </label>
            ))}
          </div>
        </fieldset>
        <section aria-labelledby="activities-title" className={styles.activitiesSection}>
          <h2 id="activities-title" className={styles.question}>
            {topic.activityQuestion}
          </h2>
          <ul className={styles.activities}>
            {activityChoices(topic).map((activity) => (
              <li key={activity.id}>
                <Link
                  to={paths.play(topic.id, levelId, activity.id)}
                  className={styles.activity}
                  onClick={() => play('tap')}
                >
                  <span className={styles.activityEmoji} aria-hidden="true">
                    {activity.emoji}
                  </span>
                  <span>{activity.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Screen>
  );
}
