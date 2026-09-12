import Link from "next/link";
import { hydrateStore, getRecentSequenceFailures, getSequenceEnrollments, getSequenceQueueStats } from "@/lib/store";
import { SequenceOperations } from "@/components/crm/SequenceOperations";
import { SequencesLibrary } from "@/components/crm/SequencesLibrary";
import { SequenceIcon } from "@/components/crm/SequenceIcon";
import styles from "@/components/crm/SequenceOperations.module.css";

export const dynamic = "force-dynamic";

export default async function SequencesPage() {
  await hydrateStore();
  const [queue, failures, enrollments] = await Promise.all([
    getSequenceQueueStats(), getRecentSequenceFailures(), getSequenceEnrollments(),
  ]);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div><h1>Sequences</h1><p>Manage automated follow-ups and resolve sending issues.</p></div>
        <Link href="/crm/settings#sequences" className={styles.settingsLink}><SequenceIcon name="settings" />Email settings</Link>
      </header>
      <SequenceOperations initialStats={queue} initialEnrollments={enrollments} initialFailures={failures} />
      <SequencesLibrary />
    </div>
  );
}
