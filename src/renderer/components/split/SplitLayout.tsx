import type { Workspace } from '../../types';
import AllotmentLayout from './AllotmentLayout';

interface Props {
  workspace: Workspace;
}

export default function SplitLayout({ workspace }: Props) {
  return <AllotmentLayout workspace={workspace} />;
}
