import { memo } from 'react';
import { Button } from '@/components/ui/button';

interface SiteHeaderProps {
  variant: 'landing' | 'app';
  onStart: () => void;
  onHome: () => void;
}

const NAV = [
  { href: '#how', label: 'Как это работает' },
  { href: '#types', label: 'Типы документов' },
  { href: '#bots', label: 'Боты' },
];

/**
 * Общая шапка обеих страниц. На лендинге — навигация по якорям и призыв,
 * в форме она сжимается до названия и выхода на главную, чтобы не спорить
 * с заголовком страницы.
 */
export const SiteHeader = memo(function SiteHeader({ variant, onStart, onHome }: SiteHeaderProps) {
  const isLanding = variant === 'landing';

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1136px] items-center justify-between gap-8 px-5 py-4 sm:px-12">
        <button
          type="button"
          onClick={onHome}
          className="flex items-baseline gap-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="font-display text-2xl font-medium">DocxGen</span>
          <span className="label-caps hidden tracking-[0.18em] text-muted-foreground/70 sm:block">
            Документ за три шага
          </span>
        </button>

        {isLanding && (
          <nav className="hidden items-center gap-8 lg:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[15px] text-secondary-foreground transition-colors hover:text-primary hover:underline hover:underline-offset-4"
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}

        {isLanding ? (
          <Button size="sm" onClick={onStart}>Открыть</Button>
        ) : (
          <Button variant="link" size="bare" onClick={onHome}>На главную</Button>
        )}
      </div>
    </header>
  );
});
