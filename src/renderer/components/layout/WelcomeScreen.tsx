import { Bot, Compass, TerminalSquare } from 'lucide-react';

interface Props {
  onCreateWorkspace: () => void;
}

const featureCards = [
  {
    title: 'Terminal',
    description: 'Integrated high-performance shell with multi-pane support and custom themes.',
    icon: TerminalSquare,
    iconClassName: 'text-green-400',
    badgeClassName: 'bg-green-500/10 border-green-500/20'
  },
  {
    title: 'Agents',
    description: 'Deploy context-aware AI agents to automate tasks and accelerate your workflow.',
    icon: Bot,
    iconClassName: 'text-purple-400',
    badgeClassName: 'bg-purple-500/10 border-purple-500/20'
  },
  {
    title: 'Browser',
    description: 'Built-in web engine optimized for documentation and real-time previewing.',
    icon: Compass,
    iconClassName: 'text-accent-blue',
    badgeClassName: 'bg-accent-blue/10 border-accent-blue/20'
  }
];

export default function WelcomeScreen({ onCreateWorkspace }: Props) {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-bg-primary px-6 py-14 sm:px-10">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-1/2 h-[32rem] w-[32rem] rounded-full"
          style={{
            transform: 'translate(-50%, -58%)',
            background: 'radial-gradient(circle, rgba(255,255,255,0.035), transparent 68%)'
          }}
        />
      </div>

      <div className="relative w-full max-w-[1080px]">
        <div className="mx-auto max-w-[700px] text-center">
          <div className="relative inline-block">
            <div
              className="pointer-events-none absolute left-0 top-1/2 h-14 w-full blur-2xl"
              style={{
                transform: 'translateY(-50%)',
                background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.12), transparent 72%)'
              }}
            />
            <div
              className="pointer-events-none absolute top-1/2 h-20 w-28 blur-2xl"
              style={{
                right: '-4%',
                transform: 'translateY(-50%)',
                background: 'radial-gradient(circle, rgba(139,159,198,0.34), transparent 74%)'
              }}
            />
            <h1 className="relative text-[2.6rem] font-semibold tracking-tight text-gray-50 sm:text-[3.4rem]">
              Welcome to <span className="text-accent-blue">Mx</span>
            </h1>
          </div>

          <p className="mx-auto mt-4 max-w-[580px] text-[15px] leading-7 text-gray-400 sm:text-base">
            Combine terminals, agents, and browsers into one focused workspace for fluid development.
          </p>

          <div className="mt-9 flex items-center justify-center">
            <button
              className="mx-obsidian-button inline-flex items-center gap-3 rounded-xl px-6 py-3 text-sm font-medium text-white active:scale-[0.99]"
              onClick={onCreateWorkspace}
            >
              <span>Create New Workspace</span>
              <kbd className="mx-obsidian-pill rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-200">
                Ctrl+N
              </kbd>
            </button>
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-[1040px] gap-4 md:grid-cols-3">
          {featureCards.map(({ title, description, icon: Icon, iconClassName, badgeClassName }) => (
            <div
              key={title}
              className="rounded-2xl border border-border-default/60 bg-bg-secondary/68 px-5 py-5 shadow-[0_12px_32px_rgba(0,0,0,0.18)] backdrop-blur-sm transition-colors duration-200 hover:border-border-default hover:bg-bg-secondary/82"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${badgeClassName}`}>
                <Icon size={18} className={iconClassName} />
              </div>
              <h2 className="mt-5 text-[15px] font-semibold text-gray-100">{title}</h2>
              <p className="mt-2 text-[13px] leading-6 text-gray-400">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
