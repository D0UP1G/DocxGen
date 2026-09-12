import { memo } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DOCUMENT_TYPES, TEMPLATES } from '@/lib/constants';

interface LandingProps {
  onStart: () => void;
}

const STEPS = [
  {
    num: '01',
    title: 'Черновик',
    text: 'Вставьте текст и выберите тип документа и шаблон оформления. Правки не нужны — для этого всё и затевалось.',
  },
  {
    num: '02',
    title: 'Проверка',
    text: 'Исправленный текст и разобранные реквизиты открыты для правки. Чего ИИ не нашёл — допишете сами или оставите пометку.',
  },
  {
    num: '03',
    title: 'Файл',
    text: 'DOCX скачивается и открывается в Word как обычный документ — не картинка и не PDF, всё правится дальше.',
  },
];

const CHANNELS = [
  { title: 'Браузер', text: 'Полная форма: текст, реквизиты и предпросмотр шаблона на одном экране.' },
  { title: 'MAX', text: 'Тот же диалог в мессенджере: прислали черновик — получили файл в переписку.' },
  { title: 'ВКонтакте', text: 'Бот сообщества с теми же шагами и тем же результатом.' },
];

const DRAFT_SAMPLE =
  'прошу выделить средства на закупку 5 мониторов для отдела разработки. текущие мониторы 2016 года, у трех из них битые пиксели и мерцание. директору иванову и.и. от петрова п.п.';

const CORRECTED_SAMPLE =
  'Прошу выделить средства на закупку пяти мониторов для отдела разработки. Используемые мониторы выпущены в 2016 году; у трёх из них выявлены битые пиксели и мерцание изображения.';

const Section = ({ id, children }: { id?: string; children: React.ReactNode }) => (
  <section id={id} className="mx-auto max-w-[1136px] scroll-mt-20 px-5 pt-22 sm:px-12">
    {children}
  </section>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="label-caps tracking-[0.16em]">{children}</span>
);

/**
 * Главная страница. Списки типов и шаблонов берутся из того же каталога,
 * что и форма, — иначе витрина и продукт разъезжаются при первом же изменении.
 */
export const Landing = memo(function Landing({ onStart }: LandingProps) {
  return (
    <div className="pb-4">
      <Section>
        <div className="grid grid-cols-1 items-start gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-18">
          <div>
            <SectionLabel>Служебные документы</SectionLabel>
            <h1 className="mt-5 font-display text-6xl leading-[0.98] font-medium tracking-tight sm:text-[84px]">
              Из черновика
              <br />— в документ
            </h1>
            <p className="mt-6 max-w-[520px] text-lg leading-[30px] text-muted-foreground text-pretty">
              Вставьте текст как есть — со строчных, без запятых, обрывками. Получите оформленный DOCX:
              с реквизитами, по ГОСТовской структуре, редактируемый в Word.
            </p>
            <div className="mt-9">
              <Button onClick={onStart}>Вставить черновик</Button>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Без регистрации. Файл хранится сутки и удаляется.
            </p>
          </div>

          <Card className="px-10 py-9">
            <div className="text-right text-[13px] leading-[21px] text-secondary-foreground">
              Директору
              <br />
              Иванову И. И.
            </div>
            <p className="mt-7 text-center font-display text-[22px] font-medium">Служебная записка</p>
            <div className="mt-6 flex flex-col gap-2.5" aria-hidden="true">
              {['100%', '96%', '99%', '62%'].map((w, i) => (
                <div key={i} className="h-[7px] rounded-xs bg-border" style={{ width: w }} />
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-2.5" aria-hidden="true">
              {['98%', '93%', '78%'].map((w, i) => (
                <div key={i} className="h-[7px] rounded-xs bg-border" style={{ width: w }} />
              ))}
            </div>
            <div className="mt-6 flex items-center gap-2.5">
              <span className="bg-highlight px-2.5 py-0.5 text-xs text-highlight-foreground">[Номер]</span>
              <span className="text-xs text-muted-foreground">незаполненное видно сразу</span>
            </div>
            <div className="mt-7 flex items-baseline justify-between border-t border-border pt-5">
              <span className="text-[13px] text-secondary-foreground">Петров П. П.</span>
              <span className="text-[13px] text-muted-foreground">10.09.2026</span>
            </div>
          </Card>
        </div>
      </Section>

      <Section>
        <SectionLabel>Было — стало</SectionLabel>
        <div className="mt-7 grid grid-cols-1 items-center gap-4 md:grid-cols-[1fr_56px_1fr] md:gap-0">
          <Card className="bg-secondary px-8 py-7">
            <span className="label-caps tracking-[0.18em]">Ваш текст</span>
            <p className="mt-3.5 text-base leading-7 text-muted-foreground">{DRAFT_SAMPLE}</p>
          </Card>
          <div className="flex items-center justify-center py-2" aria-hidden="true">
            <ArrowRight className="h-[26px] w-[26px] text-primary md:rotate-0 rotate-90" strokeWidth={1.3} />
          </div>
          <Card className="px-8 py-7">
            <span className="label-caps tracking-[0.18em]">После обработки</span>
            <p className="mt-3.5 text-base leading-7">{CORRECTED_SAMPLE}</p>
          </Card>
        </div>
        <p className="mt-4.5 text-sm text-muted-foreground">
          Адресат и автор при этом ушли из текста в реквизиты — туда, где им место в документе.
        </p>
      </Section>

      <Section id="how">
        <SectionLabel>Три шага</SectionLabel>
        <div className="mt-7 grid grid-cols-1 gap-10 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.num} className="border-t border-border px-7 py-6.5">
              <span className="font-display text-[40px] font-semibold leading-none text-primary">{step.num}</span>
              <p className="mt-3.5 font-display text-[25px] font-medium">{step.title}</p>
              <p className="mt-2.5 text-[15px] leading-[25px] text-muted-foreground text-pretty">{step.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="types">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:gap-18">
          <div>
            <SectionLabel>Типы документов</SectionLabel>
            <dl className="mt-5.5">
              {DOCUMENT_TYPES.map((type, i) => (
                <div
                  key={type.id}
                  className={`flex justify-between gap-5 border-t border-border py-4 ${
                    i === DOCUMENT_TYPES.length - 1 ? 'border-b' : ''
                  }`}
                >
                  <dt className="text-[17px]">{type.label}</dt>
                  <dd className="text-right text-sm text-muted-foreground">{type.description.toLowerCase()}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <SectionLabel>Два шаблона оформления</SectionLabel>
            <div className="mt-5.5 flex flex-col gap-4.5">
              {TEMPLATES.map((template) => (
                <Card key={template.id} className="px-6.5 py-5.5">
                  <p className="text-[17px] font-medium">{template.label}</p>
                  <p className="mt-2 text-[15px] leading-6 text-muted-foreground text-pretty">
                    {template.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <Card className="grid grid-cols-1 gap-10 px-8 py-10 sm:px-14 sm:py-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionLabel>Главное ограничение</SectionLabel>
            <p className="mt-4 font-display text-[40px] leading-[1.1] font-medium">Ничего не досочиняет</p>
          </div>
          <div>
            <p className="text-[17px] leading-[29px] text-secondary-foreground text-pretty">
              Каждый реквизит, который ИИ извлёк из текста, сверяется с исходником: если подтверждающей
              цитаты в вашем черновике нет — значение отбрасывается, а поле остаётся пустым.
            </p>
            <p className="mt-4 text-[17px] leading-[29px] text-secondary-foreground text-pretty">
              Пустое поле попадает в документ видимой жёлтой пометкой. Лучше заметный пробел, чем
              правдоподобно выдуманный номер приказа.
            </p>
          </div>
        </Card>
      </Section>

      <Section id="bots">
        <SectionLabel>Где работает</SectionLabel>
        <div className="mt-7 grid grid-cols-1 gap-10 md:grid-cols-3">
          {CHANNELS.map((channel) => (
            <div key={channel.title} className="border-t border-border px-7 py-6.5">
              <p className="text-[19px] font-medium">{channel.title}</p>
              <p className="mt-2.5 text-[15px] leading-[25px] text-muted-foreground text-pretty">{channel.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="flex flex-col items-start justify-between gap-9 bg-foreground px-8 py-12 text-background sm:px-14 lg:flex-row lg:items-center">
          <div>
            <p className="font-display text-[46px] leading-[1.06] font-medium">
              Черновик уже написан.
              <br />
              Осталось оформить.
            </p>
            <p className="mt-4 text-base text-background/65">
              Первый документ — минуты полторы вместе с чтением результата.
            </p>
          </div>
          <Button
            onClick={onStart}
            className="shrink-0 bg-background text-foreground hover:bg-background/90"
          >
            Вставить черновик
          </Button>
        </div>
      </Section>

      <footer className="mx-auto mt-18 flex max-w-[1136px] items-center justify-between gap-8 border-t border-border px-5 pb-10 pt-7 sm:px-12">
        <span className="font-display text-[21px] font-medium">DocxGen</span>
        <span className="text-sm text-muted-foreground">[Организация], 2026</span>
      </footer>
    </div>
  );
});
