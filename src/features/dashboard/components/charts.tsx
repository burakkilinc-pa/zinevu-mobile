import { Text, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { INTL_LOCALE, useLocale, useT } from '@/lib/i18n';
import { useColors } from '@/lib/theme';
import { useColorScheme } from 'nativewind';
import type { Conversion, LeadSources, MonthPoint } from '@/features/dashboard/types';

/**
 * The three charts on the dashboard.
 *
 * All of them are plain Views with widths in percent — no charting library, no
 * SVG, no reanimated. At this size a chart is a handful of rectangles, and a
 * dependency that renders rectangles is a dependency that also has to be kept
 * building against every Expo SDK bump.
 *
 * Shared rules:
 *  - Bars are thin and sit on a muted track, so an empty month still occupies
 *    its slot on the axis instead of collapsing.
 *  - Every figure that carries meaning is written out. Colour is decoration on
 *    a phone held at arm's length in daylight; the numbers are the message.
 *  - Nothing here shows money. The dashboard is opened in customers' gardens.
 */

/**
 * Categorical hues for the source split — the only chart with more than one
 * series. Both sets pass the palette checks (lightness band, chroma floor,
 * colourblind separation, contrast) against their own card surface, so the
 * dark set is its own choice rather than a lightened flip of the light one.
 */
const CATEGORICAL = {
  light: ['#0891B2', '#C2721A', '#6D5BD0'],
  dark: ['#159BB8', '#B27C33', '#8878D8'],
} as const;

function useCategorical(): readonly string[] {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? CATEGORICAL.dark : CATEGORICAL.light;
}

/** A chart's frame: a title, an optional right-hand note, and the plot. */
function ChartCard({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-4 p-4">
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="text-sm font-semibold text-foreground">{title}</Text>
        {note ? (
          <Text className="shrink text-xs text-muted-foreground" numberOfLines={1}>
            {note}
          </Text>
        ) : null}
      </View>
      {children}
    </Card>
  );
}

const PLOT_HEIGHT = 96;

/**
 * Lead inflow per month, last six.
 *
 * Six and not the twelve the API sends: twelve bars across a phone leaves each
 * one four points wide with an unreadable label under it. Six months is also
 * the horizon a dealer actually reasons about ("is spring busier than winter"),
 * and the twelve-month view is a click away on the web.
 *
 * One series on purpose. Overlaying offers-sent and won here would make three
 * bars per month at this width; the funnel below answers that question better.
 */
export function MonthlyLeadsChart({ months }: { months: MonthPoint[] }) {
  const t = useT();
  const c = useColors();
  const locale = useLocale();
  const palette = useCategorical();

  const recent = months.slice(-6);
  if (recent.length === 0) return null;

  const peak = Math.max(...recent.map((m) => m.leads));
  const total = recent.reduce((sum, m) => sum + m.leads, 0);

  // "2026-08" → "Aug". Parsed as the first of the month at UTC noon so no
  // timezone can walk it back into the month before.
  const label = (month: string) => {
    const [y, m] = month.split('-').map(Number);
    if (!y || !m) return month;
    return new Date(Date.UTC(y, m - 1, 1, 12)).toLocaleDateString(INTL_LOCALE[locale], {
      month: 'short',
    });
  };

  return (
    <ChartCard
      title={t('dash.chart.monthly.title')}
      note={t('dash.chart.monthly.total', { count: total })}
    >
      <View className="flex-row items-end gap-2" style={{ height: PLOT_HEIGHT }}>
        {recent.map((m) => {
          // Against the peak, not the sum: the question is which months were
          // the busy ones. A floor of 3px keeps a zero month visible as a zero
          // rather than as missing data.
          const height = peak > 0 ? Math.max(3, (m.leads / peak) * (PLOT_HEIGHT - 22)) : 3;
          return (
            <View key={m.month} className="flex-1 items-center gap-1">
              <Text className="text-[10px] font-medium text-muted-foreground">{m.leads}</Text>
              <View
                style={{
                  height,
                  width: '100%',
                  borderRadius: 4,
                  backgroundColor: m.leads > 0 ? palette[0] : c.border,
                }}
              />
            </View>
          );
        })}
      </View>
      <View className="flex-row gap-2">
        {recent.map((m) => (
          <Text
            key={m.month}
            className="flex-1 text-center text-[10px] text-muted-foreground"
            numberOfLines={1}
          >
            {label(m.month)}
          </Text>
        ))}
      </View>
    </ChartCard>
  );
}

/**
 * Lead → offer → signed over the last 30 days.
 *
 * A single hue at three depths, because this is one quantity shrinking, not
 * three categories. The rates under each stage are what people read: a dealer
 * who sees "38% of leads got an offer" knows what to do on Monday morning in a
 * way that three bar lengths never tell them.
 *
 * The three counts come off different timestamps (created, sent, signed), so
 * this is a rate of business over the recent, not one cohort followed through
 * — a stage can legitimately exceed the one before it, and the bar just fills.
 */
export function ConversionFunnel({ conversion }: { conversion: Conversion }) {
  const t = useT();
  const c = useColors();
  const palette = useCategorical();

  const { leads, offersSent, won } = conversion;
  if (leads + offersSent + won === 0) return null;

  const stages = [
    { key: 'leads', label: t('dash.chart.funnel.leads'), value: leads, opacity: 1 },
    { key: 'sent', label: t('dash.chart.funnel.sent'), value: offersSent, opacity: 0.7 },
    { key: 'won', label: t('dash.chart.funnel.won'), value: won, opacity: 0.42 },
  ];

  const rate = (part: number, whole: number) =>
    whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—';

  return (
    <ChartCard title={t('dash.chart.funnel.title')} note={t('dash.last30d')}>
      <View className="gap-3">
        {stages.map((s, i) => (
          <View key={s.key} className="gap-1.5">
            <View className="flex-row items-baseline justify-between">
              <Text className="text-xs text-muted-foreground">{s.label}</Text>
              <View className="flex-row items-baseline gap-2">
                <Text className="text-sm font-semibold text-foreground">{s.value}</Text>
                {i > 0 ? (
                  <Text className="text-[11px] text-muted-foreground">
                    {rate(s.value, stages[i - 1].value)}
                  </Text>
                ) : null}
              </View>
            </View>
            <View
              className="overflow-hidden rounded-full"
              style={{ height: 8, backgroundColor: c.muted }}
            >
              <View
                style={{
                  height: 8,
                  borderRadius: 999,
                  // Every stage is measured against the top of the funnel, so
                  // the bars narrow the way the funnel does.
                  width: `${leads > 0 ? Math.min(100, (s.value / leads) * 100) : 0}%`,
                  backgroundColor: palette[0],
                  opacity: s.opacity,
                }}
              />
            </View>
          </View>
        ))}
      </View>
    </ChartCard>
  );
}

/**
 * Where the last 30 days of leads came from: Meta ads, the website funnel, or
 * typed in by hand.
 *
 * One stacked bar rather than a donut — a phone-width donut with three slices
 * and a legend costs more room than the bar and reads worse. Each segment is
 * also named in the legend with its own count, so the split survives both
 * colour blindness and a screenshot in a group chat.
 */
export function SourceSplit({ sources }: { sources: LeadSources }) {
  const t = useT();
  const palette = useCategorical();

  const parts = [
    { key: 'meta', label: t('dash.chart.sources.meta'), value: sources.meta },
    { key: 'form', label: t('dash.chart.sources.form'), value: sources.form },
    { key: 'manual', label: t('dash.chart.sources.manual'), value: sources.manual },
  ];
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  if (total === 0) return null;

  const shown = parts.filter((p) => p.value > 0);

  return (
    <ChartCard title={t('dash.chart.sources.title')} note={t('dash.last30d')}>
      {/* A 2px gap between segments, so two adjacent fills never read as one. */}
      <View className="flex-row overflow-hidden rounded-full" style={{ height: 10, gap: 2 }}>
        {shown.map((p) => (
          <View
            key={p.key}
            style={{
              flex: p.value,
              backgroundColor: palette[parts.indexOf(p)],
              borderRadius: 999,
            }}
          />
        ))}
      </View>

      <View className="gap-2">
        {shown.map((p) => (
          <View key={p.key} className="flex-row items-center gap-2">
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: palette[parts.indexOf(p)],
              }}
            />
            <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
              {p.label}
            </Text>
            <Text className="text-xs font-medium text-foreground">{p.value}</Text>
            <Text className="w-10 text-right text-xs text-muted-foreground">
              {Math.round((p.value / total) * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </ChartCard>
  );
}
