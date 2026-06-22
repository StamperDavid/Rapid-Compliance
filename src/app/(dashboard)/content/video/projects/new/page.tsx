/**
 * Content → Video → Projects → New — the script-first front door (VP-C).
 *
 * Hosts the `VideoScriptForm`: the operator writes a brief (optionally selecting
 * saved characters up front), the Screenwriter agent drafts a full timed script,
 * they review/edit it, then approve to build the multi-document VideoProject
 * (VP-D handoff). On success the form navigates to the new project's detail page.
 *
 * This is a sub-route of the existing video hub (not a new nav entry) — the
 * projects list links here via "Start a new project".
 */

import { VideoScriptForm } from '@/app/(dashboard)/content/video/components/VideoScriptForm';

export default function NewVideoProjectPage(): React.JSX.Element {
  return <VideoScriptForm />;
}
