import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/theme';
import { formatCount, formatPercent } from '@/features/form-analytics/format';
import { useFormFunnel } from '@/features/form-analytics/hooks/use-form-analytics';
import { Section, SectionState } from '@/features/form-analytics/components/section';
import { useAnalyticsVocabulary } from '@/features/form-analytics/vocabulary';
import type {
  AnalyticsRange,
  FormSplit,
  FunnelStep,
  FunnelStepPart,
} from '@/features/form-analytics/types';

/**
 * Where people drop off, one form at a time.
 *
 * Per form because forms are not comparable: they ask different questions in
 * a different order, and the server refuses to blend them for exactly that
 * reason. The busiest form is open by default, so the section answers "where
 * do people leave" without a tap; the others are one chip away, including the
 * ones nobody opened this period — "nobody opened it" is an answer too.
 *
 * Bars, not a chart: each step is a View whose width is its share, on a muted
 * track so a step nobody reached still holds its line.
 */
export function StepFunnelSection({ range, forms }: { range: AnalyticsRange; forms: FormSplit[] }) {
  const t = useT();
  const [picked, setPicked] = useState<string | null>(null);

  // The pick survives a period change only while that form is still listed.
  const formType =
    picked && forms.some((f) => f.formType === picked) ? picked : (forms[0]?.formType ?? null);
  const funnel = useFormFunnel(range, formType);

  return (
    <Section title={t('formAnalytics.funnel.title')} note={t('formAnalytics.funnel.hint')}>
      {forms.length > 1 ? (
        <FormChips forms={forms} value={formType} onChange={setPicked} />
      ) : null}

      {!formType ? (
        <SectionState kind="empty" message={t('formAnalytics.funnel.noForms')} />
      ) : funnel.data ? (
        funnel.data.length > 0 ? (
          <FunnelBars steps={funnel.data} />
        ) : (
          <SectionState kind="empty" message={t('formAnalytics.funnel.empty')} />
        )
      ) : funnel.isError ? (
        <SectionState
          kind="error"
          message={t('formAnalytics.error')}
          onRetry={() => void funnel.refetch()}
        />
      ) : (
        <SectionState kind="loading" />
      )}
    </Section>
  );
}

/**
 * The dealer's forms, busiest first, each with its visits this period — so a
 * chip says whether it is worth opening before it is opened.
 *
 * Scrolls sideways with the page's gutter carried inside it: five languages'
 * worth of product names don't fit a phone's width as equal segments.
 */
function FormChips({
  forms,
  value,
  onChange,
}: {
  forms: FormSplit[];
  value: string | null;
  onChange: (formType: string) => void;
}) {
  const words = useAnalyticsVocabulary();

  return (
    // flexGrow:0 keeps a horizontal ScrollView at its own height instead of
    // stretching every chip to the rest of the column (see FilterTabs).
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-5"
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 2 }}
    >
      {forms.map((form) => {
        const active = form.formType === value;

        return (
          <Pressable
            key={form.formType}
            onPress={() => onChange(form.formType)}
            accessibilityRole="button"
            accessibilityState={active ? { selected: true } : {}}
            className={cn(
              'flex-row items-center gap-2 rounded-full px-4 py-2',
              active ? 'bg-foreground' : 'bg-muted active:opacity-70'
            )}
          >
            <Text
              className={cn('text-sm font-medium', active ? 'text-background' : 'text-foreground')}
            >
              {words.formType(form.formType)}
            </Text>
            <View className={cn('rounded-full px-1.5', active ? 'bg-background' : 'bg-card')}>
              <Text
                className={cn(
                  'text-xs font-semibold',
                  active ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {formatCount(form.visits)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function FunnelBars({ steps }: { steps: FunnelStep[] }) {
  const t = useT();
  // Which question has its bays open. One at a time: the point is a short list.
  const [open, setOpen] = useState<string | null>(null);

  // Widths are against the widest bar, not the first step. A step can be
  // reached by more visits than the first one (a question some forms skip to),
  // and a bar measured against the first would then run off its track.
  const widest = Math.max(1, ...steps.map((s) => s.reached));
  const anyStopped = steps.some((s) => s.stopped > 0 && !s.isConversion);

  return (
    <Card className="gap-4 p-4">
      {anyStopped ? (
        <View className="flex-row flex-wrap gap-x-4 gap-y-1">
          <Legend className="bg-chart" label={t('formAnalytics.funnel.continued')} />
          <Legend className="bg-destructive/70" label={t('formAnalytics.funnel.stoppedLegend')} />
        </View>
      ) : null}

      {steps.map((step, index) => {
        const id = step.key ?? `#${index}`;
        const expanded = open === id && step.parts.length > 0;

        return (
          <View key={`${id}:${index}`} className="gap-3">
            <StepBar
              step={step}
              position={index}
              widest={widest}
              expanded={expanded}
              onToggle={
                step.parts.length > 0
                  ? () => setOpen((current) => (current === id ? null : id))
                  : undefined
              }
            />
            {expanded
              ? step.parts.map((part, i) => (
                  <PartBar key={`${part.key ?? i}`} part={part} widest={widest} />
                ))
              : null}
          </View>
        );
      })}
    </Card>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={cn('h-2 w-2 rounded-full', className)} />
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </View>
  );
}

/**
 * One step: its name, how many reached it, what share of the first step that
 * is, and a bar whose tail marks the visits whose furthest point it was.
 *
 * The request-sent bar is the goal, not a question, so it wears the success
 * colour and has no "stopped" tail — nobody stops at having sent it.
 */
function StepBar({
  step,
  position,
  widest,
  expanded,
  onToggle,
}: {
  step: FunnelStep;
  position: number;
  widest: number;
  expanded: boolean;
  onToggle?: () => void;
}) {
  const t = useT();
  const c = useColors();
  const words = useAnalyticsVocabulary();

  const label = words.step(step.key, step.index ?? position) ?? '';
  const stopped = step.isConversion ? 0 : Math.min(step.stopped, step.reached);
  const width = (step.reached / widest) * 100;

  return (
    <Pressable
      onPress={onToggle}
      disabled={!onToggle}
      accessibilityRole={onToggle ? 'button' : undefined}
      accessibilityLabel={
        onToggle
          ? `${label}, ${t(expanded ? 'formAnalytics.funnel.hideParts' : 'formAnalytics.funnel.showParts')}`
          : undefined
      }
      className="gap-1.5"
    >
      <View className="flex-row items-baseline gap-2">
        <Text
          className={cn(
            'flex-1 text-sm',
            step.isConversion ? 'font-semibold text-foreground' : 'text-foreground'
          )}
          numberOfLines={2}
        >
          {label}
          {onToggle ? ' ' : ''}
          {onToggle ? (
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={13}
              color={c.mutedForeground}
            />
          ) : null}
        </Text>
        <Text className="text-sm font-semibold text-foreground">{formatCount(step.reached)}</Text>
        <Text className="w-14 text-right text-xs text-muted-foreground">
          {formatPercent(step.pctOfFirst)}
        </Text>
      </View>

      <View className="h-2.5 overflow-hidden rounded-full bg-muted">
        <View className="h-2.5 flex-row overflow-hidden rounded-full" style={{ width: `${width}%` }}>
          <View
            className={step.isConversion ? 'bg-success' : 'bg-chart'}
            style={{ flex: step.reached - stopped }}
          />
          {stopped > 0 ? <View className="bg-destructive/70" style={{ flex: stopped }} /> : null}
        </View>
      </View>

      {stopped > 0 ? (
        <Text className="text-xs text-muted-foreground">
          {t('formAnalytics.funnel.stopped', { n: formatCount(stopped) })}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * One bay of a question asked per part — "Front side 2". Indented under its
 * question and drawn lighter: it is part of the bar above, not a step of its
 * own, and the server sends no "stopped" figure for it.
 */
function PartBar({ part, widest }: { part: FunnelStepPart; widest: number }) {
  const words = useAnalyticsVocabulary();
  const width = (part.reached / widest) * 100;

  return (
    <View className="gap-1.5 pl-4">
      <View className="flex-row items-baseline gap-2">
        <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
          {words.step(part.key)}
        </Text>
        <Text className="text-xs font-semibold text-foreground">{formatCount(part.reached)}</Text>
        <Text className="w-14 text-right text-xs text-muted-foreground">
          {formatPercent(part.pctOfFirst)}
        </Text>
      </View>
      <View className="h-1.5 overflow-hidden rounded-full bg-muted">
        <View className="h-1.5 rounded-full bg-chart/40" style={{ width: `${width}%` }} />
      </View>
    </View>
  );
}
