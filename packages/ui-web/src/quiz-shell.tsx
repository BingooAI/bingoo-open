'use client';

import {
  currentQuestion,
  initQuiz,
  isResponded,
  pickText,
  quizReducer,
  quizSummary,
  revealFor,
  translateCells,
  type QuizQuestion,
  type Solid3DName,
  type QuizResponse,
  type QuizSummary,
} from '@bingoo/core';
import { QuizLocaleProvider, useQuizText } from './quiz-locale';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useReducer, useRef, type ReactNode } from 'react';
import { AssistBlock } from './assist-block';
import { Button } from './button';
import { Card } from './card';
import { CategorizeBoard } from './categorize-board';
import { ChoiceList, TrueFalse } from './quiz-choice';
import { ClockInput } from './clock-input';
import { ExplanationCard } from './explanation-card';
import { FillBlank } from './fill-blank';
import { HighlightText } from './highlight-text';
import { HintReveal } from './hint-reveal';
import { ArrayBuilder } from './array-builder';
import { ArrowInput } from './arrow-input';
import { BalanceScale } from './balance-scale';
import { AnnotateImage } from './annotate-image';
import { PictogramChart } from './pictogram-chart';
import { TallyChart } from './tally-chart';
import { BarChartBuilder } from './bar-chart-builder';
import { CarrollGrid } from './carroll-grid';
import { AngleTool, type AngleLabels } from './angle-tool';
import { BranchKey, type BranchKeyLabels } from './branch-key';
import { CoordinateGrid } from './coordinate-grid';
import { LineGraph } from './line-graph';
import { TranslationGrid } from './translation-grid';
import { CompassRose } from './compass-rose';
import { NetPicker } from './net-picker';
import { DrawingPad, type DrawingLabels } from './drawing-pad';
import { WritingPad, type WritingLabels } from './writing-pad';
import { EstimateStep, type EstimateLabels } from './estimate-step';
import { WaffleGrid } from './waffle-grid';
import { ChanceScale } from './chance-scale';
import { ProofreadText } from './proofread-text';
import { SolidInspector } from './solid-inspector';
import { GridShapeBoard } from './grid-shape-board';
import { CrosswordGrid } from './crossword-grid';
import { MathField } from './math-field';
import { SpeechRecorder, type SpeechLabels } from './speech-recorder';
import { DigitalClock } from './digital-clock';
import { RotationDial } from './rotation-dial';
import { RouteGrid } from './route-grid';
import { ScaleReader } from './scale-reader';
import { RulerMeasure } from './ruler-measure';
import { SymmetryGrid } from './symmetry-grid';
import { FractionBar } from './fraction-bar';
import { WordSearch } from './word-search';
import { HotspotFind } from './hotspot-find';
import { LabelDiagram } from './label-diagram';
import { cn } from './lib/cn';
import { MatchPairs } from './match-pairs';
import { MoneyTray } from './money-tray';
import { NumberLineInput } from './number-line-input';
import { NumericAnswer } from './numeric-answer';
import { OrderList } from './order-list';
import { PartWholeInput } from './part-whole-input';
import { PatternInput } from './pattern-input';
import { PlaceValueInput } from './place-value-input';
import { QuestionMedia } from './quiz-media';
import { StemView } from './stem-view';
import { QuizProgress, type QuizSegmentStatus } from './quiz-progress';
import { ResultScreen, type ResultLabels } from './result-screen';
import { TableFill } from './table-fill';
import { TenFrameInput } from './ten-frame-input';
import { VennBoard } from './venn-board';
import { WordBank } from './word-bank';

/** All chrome copy for the shell — data supplied by the caller (i18n-free). */
export interface QuizLabels {
  /** Header, e.g. "Câu 3/10" (caller formats the numbers). */
  questionOf?: (index: number, total: number) => ReactNode;
  check: ReactNode;
  next: ReactNode;
  finish: ReactNode;
  /** "Skip" — advance without answering (no life lost). Omit to hide the button. */
  skip?: ReactNode;
  /** Undo label for the annotate (draw-on-image) tool. */
  undo?: string;
  /** Crossword clue-list headings. */
  crosswordAcross?: string;
  crosswordDown?: string;
  /** Copy for the speech (read-aloud) recorder. */
  speech?: SpeechLabels;
  /** Readout labels for grid-shape (area / perimeter) questions. */
  gridShape?: { area: string; perimeter: string };
  /** Copy for the 3D solid inspector (tap every face/edge/vertex). */
  solid?: { found: string; hint?: string };
  /** Copy for the open (rubric-assessed) tasks — drawing & writing. */
  drawing?: DrawingLabels;
  writing?: WritingLabels;
  /** Copy for the estimate-then-check task. */
  estimate?: EstimateLabels;
  /** Localized solid names (cube, cuboid…) for the net task. */
  solidNames?: Partial<Record<Solid3DName, string>>;
  /** Yes/No/Back copy for the identification key. */
  branchKey?: BranchKeyLabels;
  /** Placeholder for the proofreading inline editor. */
  proofreadPlaceholder?: string;
  /** Angle-kind names (acute / right / obtuse …). */
  angle?: AngleLabels;
  showHint: ReactNode;
  correct: ReactNode;
  incorrect: ReactNode;
  explanationTitle?: ReactNode;
  moveUp?: string;
  moveDown?: string;
  fillPlaceholder?: string;
  progressLabel?: string;
  /** A11y label for a question's attached audio play button. */
  playMedia?: string;
  /** Minute-button labels for clock questions, e.g. { 0: "o'clock", 30: "half past" }. */
  clockMinuteLabels?: Record<number, string>;
  /** "outside / neither" label for Venn questions. */
  vennNeither?: string;
  /** Column labels for place-value questions, e.g. { tens: "Chục", ones: "Đơn vị" }. */
  placeValueLabels?: { tens: string; ones: string };
  result: {
    passTitle: ReactNode;
    failTitle: ReactNode;
    passSubtitle?: ReactNode;
    failSubtitle?: ReactNode;
    accuracyLabel: ReactNode;
    correctLabel: ReactNode;
    retry: ReactNode;
    continueLabel: ReactNode;
    /** Format the "8 / 10" correct count; defaults to `${correct} / ${total}`. */
    correctText?: (correct: number, total: number) => ReactNode;
  };
}

export interface QuizShellProps {
  questions: QuizQuestion[];
  labels: QuizLabels;
  /** Locale hiển thị cho text đa ngôn ngữ của quiz (đề/nhãn). Mặc định 'vi'. Content một-ngôn-ngữ (chuỗi) không đổi. */
  locale?: string;
  /** Lives mode: wrong checks cost a life. Omit for unlimited. */
  lives?: number;
  /** Pass mark 0–1 for the result screen (default 0.6). */
  passMark?: number;
  /** Fired once when the session ends (complete or failed). */
  onComplete?: (summary: QuizSummary) => void;
  /** Continue button on the result screen. */
  onContinue?: () => void;
  className?: string;
}

/**
 * The quiz orchestrator: drives `@bingoo/core`'s reducer, renders the right input
 * for each of the six question types, reveals grading, offers hints + explanation,
 * and shows a result screen. Pure UI over shared logic — its native twin behaves
 * identically. Every string is data (i18n-free); it re-skins with the active pack.
 */
export function QuizShell({
  questions,
  labels,
  locale = 'vi',
  lives,
  passMark = 0.6,
  onComplete,
  onContinue,
  className,
}: QuizShellProps) {
  const [state, dispatch] = useReducer(quizReducer, { questions, lives }, initQuiz);
  const done = state.status === 'complete' || state.status === 'failed';

  // Fire onComplete exactly once when the session finishes (ref guards re-runs).
  const firedRef = useRef(false);
  useEffect(() => {
    if (done && !firedRef.current) {
      firedRef.current = true;
      onComplete?.(quizSummary(state, passMark));
    }
    if (!done) firedRef.current = false;
  }, [done, state, passMark, onComplete]);

  if (done) {
    const summary = quizSummary(state, passMark);
    const correctText =
      labels.result.correctText?.(summary.correct, summary.total) ??
      `${summary.correct} / ${summary.total}`;
    const resultLabels: ResultLabels = {
      title: summary.passed ? labels.result.passTitle : labels.result.failTitle,
      subtitle: summary.passed ? labels.result.passSubtitle : labels.result.failSubtitle,
      accuracyLabel: labels.result.accuracyLabel,
      correctText,
      correctLabel: labels.result.correctLabel,
      retry: labels.result.retry,
      continueLabel: labels.result.continueLabel,
    };
    return (
      <ResultScreen
        summary={summary}
        labels={resultLabels}
        onRetry={() => dispatch({ type: 'restart' })}
        onContinue={onContinue}
        className={className}
      />
    );
  }

  const q = currentQuestion(state);
  if (!q) return null;
  const response = state.responses[q.id];
  const grade = state.grades[q.id];
  const checked = !!grade;
  const isLast = state.index === state.questions.length - 1;

  const statuses: QuizSegmentStatus[] = state.questions.map((question) => {
    const g = state.grades[question.id];
    return g ? (g.correct ? 'correct' : 'incorrect') : 'pending';
  });

  return (
    <QuizLocaleProvider value={locale}>
      <Card className={cn('flex flex-col gap-5 p-5 sm:p-6', className)}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            {labels.questionOf ? (
              <span className="text-sm font-semibold text-foreground-muted">
                {labels.questionOf(state.index, state.questions.length)}
              </span>
            ) : (
              <span />
            )}
          </div>
          <QuizProgress
            total={state.questions.length}
            index={state.index}
            statuses={statuses}
            lives={
              state.livesLeft != null && state.livesMax != null
                ? { left: state.livesLeft, max: state.livesMax }
                : undefined
            }
            label={labels.progressLabel}
          />
        </div>

        <div key={q.id} className="flex flex-col gap-4 motion-safe:animate-pop-in">
          {q.media ? <QuestionMedia media={q.media} playLabel={labels.playMedia} /> : null}
          {q.body?.length ? <StemView body={q.body} playLabel={labels.playMedia} /> : null}
          {q.prompt ? (
            <h3 className="font-display text-xl font-bold text-foreground">
              {pickText(q.prompt, locale)}
            </h3>
          ) : null}

          {/* Support layers: guide (how-to) + instruction (detailed steps). */}
          {q.guide ? (
            <AssistBlock assist={q.guide} tone="guide" playLabel={labels.playMedia} />
          ) : null}
          {q.instruction ? (
            <AssistBlock assist={q.instruction} tone="instruction" playLabel={labels.playMedia} />
          ) : null}

          <QuestionInput
            q={q}
            response={response}
            checked={checked}
            labels={labels}
            onRespond={(r) => dispatch({ type: 'respond', response: r })}
          />

          {q.hints && q.hints.length > 0 && !checked ? (
            <HintReveal
              hints={q.hints}
              revealed={state.hintsUsed[q.id] ?? 0}
              onReveal={() => dispatch({ type: 'hint' })}
              buttonLabel={labels.showHint}
              playLabel={labels.playMedia}
            />
          ) : null}

          {checked ? (
            <div className="flex flex-col gap-3 motion-safe:animate-fade-up">
              {/* The verdict is the moment the learner is waiting for — give it a surface,
                not a bare line of text, and let it pop in. */}
              <div
                className={cn(
                  'flex items-center gap-2 rounded-2xl border-2 px-3 py-2 font-display text-lg font-bold shadow-pop motion-safe:animate-pop-in',
                  grade!.correct
                    ? 'border-success bg-success-soft text-success'
                    : 'border-danger bg-danger-soft text-danger',
                )}
              >
                {grade!.correct ? (
                  <CheckCircle2 className="size-6" />
                ) : (
                  <XCircle className="size-6" />
                )}
                {grade!.correct ? labels.correct : labels.incorrect}
              </div>
              {q.explanation ? (
                <ExplanationCard
                  variant={grade!.correct ? 'success' : 'danger'}
                  title={labels.explanationTitle}
                >
                  {pickText(q.explanation, locale)}
                </ExplanationCard>
              ) : null}
              {/* Concept teaching (giảng giải) — shown with the explanation. */}
              {q.teach ? (
                <ExplanationCard variant="info">
                  <AssistBlock assist={q.teach} tone="guide" playLabel={labels.playMedia} />
                </ExplanationCard>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3">
          {!checked && labels.skip ? (
            <Button variant="ghost" onClick={() => dispatch({ type: 'next' })}>
              {labels.skip}
            </Button>
          ) : (
            <span />
          )}
          {!checked ? (
            <Button
              size="lg"
              disabled={!isResponded(q, response)}
              onClick={() => dispatch({ type: 'check' })}
            >
              {labels.check}
            </Button>
          ) : (
            <Button size="lg" onClick={() => dispatch({ type: 'next' })}>
              {isLast ? labels.finish : labels.next}
            </Button>
          )}
        </div>
      </Card>
    </QuizLocaleProvider>
  );
}

interface QuestionInputProps {
  q: QuizQuestion;
  response: QuizResponse | undefined;
  checked: boolean;
  labels: QuizLabels;
  onRespond: (r: QuizResponse) => void;
}

/** Renders the controlled input for whichever question type is active. */
function QuestionInput({ q, response, checked, labels, onRespond }: QuestionInputProps) {
  const reveal = checked ? revealFor(q, response) : undefined;
  const t = useQuizText(); // rút nhãn đa-locale theo locale hiện hành

  switch (q.type) {
    case 'single':
      return (
        <ChoiceList
          mode="single"
          letters
          choices={q.choices.map((c) => ({
            id: c.id,
            label: t(c.label),
            emoji: c.emoji,
            image: c.image,
            audioSrc: c.audio?.src,
          }))}
          playLabel={labels.playMedia}
          value={response?.type === 'single' && response.choiceId ? [response.choiceId] : []}
          onChange={(ids) => onRespond({ type: 'single', choiceId: ids[0] ?? null })}
          reveal={reveal?.type === 'single' ? reveal.choices : undefined}
        />
      );
    case 'multiple':
      return (
        <ChoiceList
          mode="multiple"
          choices={q.choices.map((c) => ({
            id: c.id,
            label: t(c.label),
            emoji: c.emoji,
            image: c.image,
            audioSrc: c.audio?.src,
          }))}
          playLabel={labels.playMedia}
          value={response?.type === 'multiple' ? response.choiceIds : []}
          onChange={(ids) => onRespond({ type: 'multiple', choiceIds: ids })}
          reveal={reveal?.type === 'multiple' ? reveal.choices : undefined}
        />
      );
    case 'boolean':
      return (
        <TrueFalse
          trueLabel={q.trueLabel}
          falseLabel={q.falseLabel}
          value={response?.type === 'boolean' ? response.value : null}
          onChange={(v) => onRespond({ type: 'boolean', value: v })}
          reveal={reveal?.type === 'boolean' ? { answer: reveal.answer } : undefined}
        />
      );
    case 'fill':
      return (
        <FillBlank
          segments={q.segments}
          values={response?.type === 'fill' ? response.values : q.answers.map(() => '')}
          onChange={(values) => onRespond({ type: 'fill', values })}
          reveal={reveal?.type === 'fill' ? reveal.blanks : undefined}
          placeholder={labels.fillPlaceholder}
        />
      );
    case 'order':
      return (
        <OrderList
          items={q.items.map((i) => ({ ...i, label: t(i.label) }))}
          order={response?.type === 'order' ? response.order : q.items.map((i) => i.id)}
          onChange={(order) => onRespond({ type: 'order', order })}
          reveal={reveal?.type === 'order' ? reveal.items : undefined}
          labels={
            labels.moveUp && labels.moveDown
              ? { moveUp: labels.moveUp, moveDown: labels.moveDown }
              : undefined
          }
        />
      );
    case 'match':
      return (
        <MatchPairs
          left={q.left.map((i) => ({ ...i, label: t(i.label) }))}
          right={q.right.map((i) => ({ ...i, label: t(i.label) }))}
          pairs={response?.type === 'match' ? response.pairs : {}}
          onChange={(pairs) => onRespond({ type: 'match', pairs })}
          reveal={reveal?.type === 'match' ? reveal.left : undefined}
        />
      );
    case 'numeric':
      return (
        <NumericAnswer
          value={response?.type === 'numeric' ? response.value : ''}
          onChange={(value) => onRespond({ type: 'numeric', value })}
          reveal={
            reveal?.type === 'numeric'
              ? { correct: reveal.correct, answer: reveal.answer }
              : undefined
          }
          unitLabel={q.unitLabel}
          placeholder={q.placeholder ?? labels.fillPlaceholder}
        />
      );
    case 'wordbank':
      return (
        <WordBank
          bank={q.bank}
          picks={response?.type === 'wordbank' ? response.picks : []}
          onChange={(picks) => onRespond({ type: 'wordbank', picks })}
          reveal={
            reveal?.type === 'wordbank'
              ? { positions: reveal.positions, answer: reveal.answer }
              : undefined
          }
        />
      );
    case 'categorize':
      return (
        <CategorizeBoard
          categories={q.categories}
          items={q.items}
          assignment={response?.type === 'categorize' ? response.assignment : {}}
          onChange={(assignment) => onRespond({ type: 'categorize', assignment })}
          reveal={reveal?.type === 'categorize' ? reveal.items : undefined}
        />
      );
    case 'highlight':
      return (
        <HighlightText
          tokens={q.tokens}
          indexes={response?.type === 'highlight' ? response.indexes : []}
          onChange={(indexes) => onRespond({ type: 'highlight', indexes })}
          reveal={reveal?.type === 'highlight' ? reveal.tokens : undefined}
        />
      );
    case 'numberline':
      return (
        <NumberLineInput
          min={q.min}
          max={q.max}
          step={q.step}
          value={response?.type === 'numberline' ? response.value : null}
          onChange={(value) => onRespond({ type: 'numberline', value })}
          reveal={
            reveal?.type === 'numberline'
              ? { correct: reveal.correct, answer: reveal.answer }
              : undefined
          }
        />
      );
    case 'clock':
      return (
        <ClockInput
          hour={response?.type === 'clock' ? response.hour : null}
          minute={response?.type === 'clock' ? response.minute : null}
          onChange={(hour, minute) => onRespond({ type: 'clock', hour, minute })}
          minuteOptions={q.minuteOptions}
          minuteLabels={labels.clockMinuteLabels}
          reveal={
            reveal?.type === 'clock'
              ? { correct: reveal.correct, hour: reveal.hour, minute: reveal.minute }
              : undefined
          }
        />
      );
    case 'venn':
      return (
        <VennBoard
          labelA={q.labelA}
          labelB={q.labelB}
          items={q.items}
          assignment={response?.type === 'venn' ? response.assignment : {}}
          onChange={(assignment) => onRespond({ type: 'venn', assignment })}
          reveal={reveal?.type === 'venn' ? reveal.items : undefined}
          neitherLabel={labels.vennNeither}
        />
      );
    case 'tablefill':
      return (
        <TableFill
          columns={q.columns}
          rows={q.rows}
          values={response?.type === 'tablefill' ? response.values : {}}
          onChange={(values) => onRespond({ type: 'tablefill', values })}
          reveal={reveal?.type === 'tablefill' ? reveal.cells : undefined}
        />
      );
    case 'tenframe':
      return (
        <TenFrameInput
          frames={q.frames}
          count={response?.type === 'tenframe' ? response.count : 0}
          onChange={(count) => onRespond({ type: 'tenframe', count })}
          reveal={
            reveal?.type === 'tenframe'
              ? { correct: reveal.correct, answer: reveal.answer }
              : undefined
          }
        />
      );
    case 'partwhole':
      return (
        <PartWholeInput
          whole={q.whole}
          parts={q.parts}
          value={response?.type === 'partwhole' ? response.value : ''}
          onChange={(value) => onRespond({ type: 'partwhole', value })}
          reveal={
            reveal?.type === 'partwhole'
              ? { correct: reveal.correct, answer: reveal.answer }
              : undefined
          }
        />
      );
    case 'placevalue':
      return (
        <PlaceValueInput
          tens={response?.type === 'placevalue' ? response.tens : 0}
          ones={response?.type === 'placevalue' ? response.ones : 0}
          onChange={(tens, ones) => onRespond({ type: 'placevalue', tens, ones })}
          reveal={
            reveal?.type === 'placevalue'
              ? { correct: reveal.correct, answer: reveal.answer }
              : undefined
          }
          columnLabels={labels.placeValueLabels}
        />
      );
    case 'pattern':
      return (
        <PatternInput
          sequence={q.sequence}
          blanks={q.blanks}
          palette={q.palette}
          picks={response?.type === 'pattern' ? response.picks : []}
          onChange={(picks) => onRespond({ type: 'pattern', picks })}
          reveal={
            reveal?.type === 'pattern'
              ? { positions: reveal.positions, answer: reveal.answer }
              : undefined
          }
        />
      );
    case 'label':
      return (
        <LabelDiagram
          hotspots={q.hotspots}
          labels={q.labels}
          imageSrc={q.imageSrc}
          assignment={response?.type === 'label' ? response.assignment : {}}
          onChange={(assignment) => onRespond({ type: 'label', assignment })}
          reveal={reveal?.type === 'label' ? reveal.items : undefined}
        />
      );
    case 'hotspot':
      return (
        <HotspotFind
          hotspots={q.hotspots}
          imageSrc={q.imageSrc}
          selected={response?.type === 'hotspot' ? response.selected : []}
          onChange={(selected) => onRespond({ type: 'hotspot', selected })}
          reveal={reveal?.type === 'hotspot' ? reveal.spots : undefined}
        />
      );
    case 'arrow':
      return (
        <ArrowInput
          nodes={q.nodes}
          directed={q.directed}
          imageSrc={q.imageSrc}
          edges={response?.type === 'arrow' ? response.edges : []}
          onChange={(edges) => onRespond({ type: 'arrow', edges })}
          reveal={
            reveal?.type === 'arrow' ? { answer: reveal.answer, marks: reveal.marks } : undefined
          }
        />
      );
    case 'wordsearch':
      return (
        <WordSearch
          rows={q.rows}
          words={q.words}
          found={response?.type === 'wordsearch' ? response.found : []}
          onChange={(found) => onRespond({ type: 'wordsearch', found })}
          reveal={
            reveal?.type === 'wordsearch' ? { words: reveal.words, found: reveal.found } : undefined
          }
        />
      );
    case 'fraction':
      return (
        <FractionBar
          parts={q.parts}
          shape={q.shape}
          shaded={response?.type === 'fraction' ? response.shaded : []}
          onChange={(shaded) => onRespond({ type: 'fraction', shaded })}
          reveal={
            reveal?.type === 'fraction'
              ? { correct: reveal.correct, answer: reveal.answer, parts: reveal.parts }
              : undefined
          }
        />
      );
    case 'carroll':
      return (
        <CarrollGrid
          rows={q.rows}
          cols={q.cols}
          items={q.items}
          assignment={response?.type === 'carroll' ? response.assignment : {}}
          onChange={(assignment) => onRespond({ type: 'carroll', assignment })}
          reveal={
            reveal?.type === 'carroll' ? { items: reveal.items, answer: reveal.answer } : undefined
          }
        />
      );
    case 'money':
      return (
        <MoneyTray
          denominations={q.denominations}
          currency={q.currency}
          picks={response?.type === 'money' ? response.picks : []}
          onChange={(picks) => onRespond({ type: 'money', picks })}
          reveal={
            reveal?.type === 'money'
              ? { correct: reveal.correct, target: reveal.target, total: reveal.total }
              : undefined
          }
        />
      );
    case 'balance':
      return (
        <BalanceScale
          left={q.left}
          right={q.right}
          leftLabel={q.leftLabel}
          rightLabel={q.rightLabel}
          leftEmoji={q.leftEmoji}
          rightEmoji={q.rightEmoji}
          choice={response?.type === 'balance' ? response.choice : null}
          onChange={(choice) => onRespond({ type: 'balance', choice })}
          reveal={
            reveal?.type === 'balance'
              ? { correct: reveal.correct, answer: reveal.answer }
              : undefined
          }
        />
      );
    case 'barchart':
      return (
        <BarChartBuilder
          categories={q.categories}
          maxValue={q.maxValue}
          unitLabel={q.unitLabel}
          heights={response?.type === 'barchart' ? response.heights : {}}
          onChange={(heights) => onRespond({ type: 'barchart', heights })}
          reveal={
            reveal?.type === 'barchart' ? { cells: reveal.cells, answer: reveal.answer } : undefined
          }
        />
      );
    case 'ruler':
      return (
        <RulerMeasure
          max={q.max}
          start={q.start}
          length={q.length}
          unitLabel={q.unitLabel}
          value={response?.type === 'ruler' ? response.value : null}
          onChange={(value) => onRespond({ type: 'ruler', value })}
          reveal={
            reveal?.type === 'ruler'
              ? { correct: reveal.correct, answer: reveal.answer }
              : undefined
          }
        />
      );
    case 'symmetry':
      return (
        <SymmetryGrid
          rows={q.rows}
          cols={q.cols}
          axis={q.axis}
          filled={q.filled}
          userFilled={response?.type === 'symmetry' ? response.filled : []}
          onChange={(f) => onRespond({ type: 'symmetry', filled: f })}
          reveal={
            reveal?.type === 'symmetry'
              ? {
                  mode: reveal.mode,
                  correct: reveal.correct,
                  expected: reveal.expected,
                  filled: reveal.filled,
                }
              : undefined
          }
        />
      );
    case 'annotate':
      return (
        <AnnotateImage
          imageSrc={q.imageSrc}
          color={q.brushColor}
          strokes={response?.type === 'annotate' ? response.strokes : []}
          onChange={(strokes) => onRespond({ type: 'annotate', strokes })}
          locked={reveal?.type === 'annotate'}
          undoLabel={labels.undo}
        />
      );
    case 'tally':
      return (
        <TallyChart
          categories={q.categories}
          counts={response?.type === 'tally' ? response.counts : {}}
          onChange={(counts) => onRespond({ type: 'tally', counts })}
          reveal={
            reveal?.type === 'tally' ? { cells: reveal.cells, answer: reveal.answer } : undefined
          }
        />
      );
    case 'pictogram':
      return (
        <PictogramChart
          categories={q.categories}
          maxIcons={q.maxIcons}
          iconValue={q.iconValue}
          counts={response?.type === 'pictogram' ? response.counts : {}}
          onChange={(counts) => onRespond({ type: 'pictogram', counts })}
          reveal={
            reveal?.type === 'pictogram'
              ? { cells: reveal.cells, answer: reveal.answer }
              : undefined
          }
        />
      );
    case 'array':
      return (
        <ArrayBuilder
          maxRows={q.maxRows}
          maxCols={q.maxCols}
          emoji={q.emoji}
          rows={response?.type === 'array' ? response.rows : 0}
          cols={response?.type === 'array' ? response.cols : 0}
          onChange={(rows, cols) => onRespond({ type: 'array', rows, cols })}
          reveal={
            reveal?.type === 'array'
              ? { correct: reveal.correct, rows: reveal.rows, cols: reveal.cols }
              : undefined
          }
        />
      );
    case 'rotation':
      return (
        <RotationDial
          steps={q.steps}
          start={q.start}
          emoji={q.emoji}
          position={response?.type === 'rotation' ? response.position : null}
          onChange={(position) => onRespond({ type: 'rotation', position })}
          reveal={
            reveal?.type === 'rotation'
              ? { correct: reveal.correct, answer: reveal.answer }
              : undefined
          }
        />
      );
    case 'scale':
      return (
        <ScaleReader
          shape={q.shape}
          min={q.min}
          max={q.max}
          step={q.step}
          unitLabel={q.unitLabel}
          value={response?.type === 'scale' ? response.value : null}
          onChange={(value) => onRespond({ type: 'scale', value })}
          reveal={
            reveal?.type === 'scale'
              ? { correct: reveal.correct, answer: reveal.answer }
              : undefined
          }
        />
      );
    case 'digitalclock':
      return (
        <DigitalClock
          mode={q.mode}
          hour={response?.type === 'digitalclock' ? response.hour : null}
          minute={response?.type === 'digitalclock' ? response.minute : null}
          onChange={(hour, minute) => onRespond({ type: 'digitalclock', hour, minute })}
          reveal={
            reveal?.type === 'digitalclock'
              ? { correct: reveal.correct, hour: reveal.hour, minute: reveal.minute }
              : undefined
          }
        />
      );
    case 'route':
      return (
        <RouteGrid
          rows={q.rows}
          cols={q.cols}
          start={q.start}
          target={q.target}
          blocked={q.blocked}
          startEmoji={q.startEmoji}
          targetEmoji={q.targetEmoji}
          path={response?.type === 'route' ? response.path : []}
          onChange={(path) => onRespond({ type: 'route', path })}
          reveal={
            reveal?.type === 'route'
              ? { correct: reveal.correct, target: reveal.target, solution: reveal.solution }
              : undefined
          }
        />
      );
    case 'crossword':
      return (
        <CrosswordGrid
          rows={q.rows}
          cols={q.cols}
          entries={q.entries}
          letters={response?.type === 'crossword' ? response.letters : {}}
          onChange={(letters) => onRespond({ type: 'crossword', letters })}
          reveal={reveal?.type === 'crossword' ? { cells: reveal.cells } : undefined}
          acrossLabel={labels.crosswordAcross}
          downLabel={labels.crosswordDown}
        />
      );
    case 'math':
      return (
        <MathField
          level={q.level}
          keys={q.keys}
          placeholder={q.placeholder}
          value={response?.type === 'math' ? response.value : ''}
          onChange={(value) => onRespond({ type: 'math', value })}
          reveal={
            reveal?.type === 'math' ? { correct: reveal.correct, answer: reveal.answer } : undefined
          }
        />
      );
    case 'gridshape':
      return (
        <GridShapeBoard
          rows={q.rows}
          cols={q.cols}
          given={q.given}
          target={q.target}
          unitLabel={q.unitLabel}
          labels={labels.gridShape}
          cells={response?.type === 'gridshape' ? response.cells : []}
          onChange={(cells) => onRespond({ type: 'gridshape', cells })}
          reveal={
            reveal?.type === 'gridshape'
              ? {
                  correct: reveal.correct,
                  area: reveal.area,
                  perimeter: reveal.perimeter,
                  target: reveal.target,
                }
              : undefined
          }
        />
      );
    case 'linegraph':
      return (
        <LineGraph
          style={q.style}
          xLabels={q.xLabels}
          maxY={q.maxY}
          stepY={q.stepY}
          xTitle={q.xTitle}
          yTitle={q.yTitle}
          values={response?.type === 'linegraph' ? response.values : []}
          onChange={(values) => onRespond({ type: 'linegraph', values })}
          reveal={
            reveal?.type === 'linegraph'
              ? { correct: reveal.correct, marks: reveal.marks, answer: reveal.answer }
              : undefined
          }
        />
      );
    case 'drawing':
      return labels.drawing ? (
        <DrawingPad
          strokes={response?.type === 'drawing' ? response.strokes : []}
          met={response?.type === 'drawing' ? response.met : []}
          onChange={({ strokes, met }) => onRespond({ type: 'drawing', strokes, met })}
          criteria={q.criteria}
          referenceImage={q.referenceImage}
          labels={labels.drawing}
          reveal={
            reveal?.type === 'drawing'
              ? { correct: reveal.correct, need: reveal.need, exemplarImage: reveal.exemplarImage }
              : undefined
          }
        />
      ) : null;
    case 'writing':
      return labels.writing ? (
        <WritingPad
          text={response?.type === 'writing' ? response.text : ''}
          met={response?.type === 'writing' ? response.met : []}
          onChange={({ text, met }) => onRespond({ type: 'writing', text, met })}
          criteria={q.criteria}
          minWords={q.minWords}
          maxWords={q.maxWords}
          starters={q.starters}
          labels={labels.writing}
          reveal={
            reveal?.type === 'writing'
              ? { correct: reveal.correct, need: reveal.need, exemplar: reveal.exemplar }
              : undefined
          }
        />
      ) : null;
    case 'estimate':
      return labels.estimate ? (
        <EstimateStep
          estimate={response?.type === 'estimate' ? response.estimate : null}
          actual={response?.type === 'estimate' ? response.actual : null}
          onChange={({ estimate, actual }) => onRespond({ type: 'estimate', estimate, actual })}
          unit={q.unit}
          step={q.step}
          labels={labels.estimate}
          reveal={
            reveal?.type === 'estimate'
              ? {
                  correct: reveal.correct,
                  actual: reveal.actual,
                  close: reveal.close,
                  off: reveal.off,
                }
              : undefined
          }
        />
      ) : null;
    case 'net':
      return (
        <NetPicker
          task={q.task}
          solid={q.solid}
          options={q.options}
          net={q.net}
          solidOptions={q.solidOptions}
          solidLabels={labels.solidNames}
          value={response?.type === 'net' ? response.choice : null}
          onChange={(choice) => onRespond({ type: 'net', choice })}
          reveal={
            reveal?.type === 'net' ? { correct: reveal.correct, answer: reveal.answer } : undefined
          }
        />
      );
    case 'translation':
      return (
        <TranslationGrid
          rows={q.rows}
          cols={q.cols}
          cells={q.cells}
          task={q.task}
          movedCells={q.task === 'describe' ? translateCells(q.cells, q.dx, q.dy) : undefined}
          dx={response?.type === 'translation' ? response.dx : null}
          dy={response?.type === 'translation' ? response.dy : null}
          onChange={({ dx, dy }) => onRespond({ type: 'translation', dx, dy })}
          reveal={
            reveal?.type === 'translation'
              ? { correct: reveal.correct, dx: reveal.dx, dy: reveal.dy }
              : undefined
          }
        />
      );
    case 'compass':
      return (
        <CompassRose
          maxX={q.maxX}
          maxY={q.maxY}
          places={q.places}
          from={q.from}
          to={q.to}
          value={response?.type === 'compass' ? response.direction : null}
          onChange={(direction) => onRespond({ type: 'compass', direction })}
          reveal={
            reveal?.type === 'compass'
              ? { correct: reveal.correct, answer: reveal.answer }
              : undefined
          }
        />
      );
    case 'waffle':
      return (
        <WaffleGrid
          size={q.size}
          categories={q.categories}
          cells={response?.type === 'waffle' ? response.cells : {}}
          onChange={(cells) => onRespond({ type: 'waffle', cells })}
          reveal={
            reveal?.type === 'waffle'
              ? {
                  correct: reveal.correct,
                  cells: reveal.cells,
                  counts: reveal.counts,
                  answer: reveal.answer,
                }
              : undefined
          }
        />
      );
    case 'coordinates':
      return (
        <CoordinateGrid
          maxX={q.maxX}
          maxY={q.maxY}
          task={q.task}
          coords={q.coords}
          value={response?.type === 'coordinates' ? response.coords : []}
          onChange={(coords) => onRespond({ type: 'coordinates', coords })}
          reveal={
            reveal?.type === 'coordinates'
              ? { correct: reveal.correct, marks: reveal.marks, answer: reveal.answer }
              : undefined
          }
        />
      );
    case 'angle':
      return (
        <AngleTool
          task={q.task}
          angle={q.angle}
          showProtractor={q.showProtractor}
          degrees={response?.type === 'angle' ? response.degrees : null}
          kind={response?.type === 'angle' ? response.kind : null}
          onChange={({ degrees, kind }) => onRespond({ type: 'angle', degrees, kind })}
          labels={
            labels.angle ?? { acute: 'Acute', right: 'Right', obtuse: 'Obtuse', reflex: 'Reflex' }
          }
          reveal={
            reveal?.type === 'angle'
              ? { correct: reveal.correct, answer: reveal.answer, kind: reveal.kind }
              : undefined
          }
        />
      );
    case 'branchkey':
      return (
        <BranchKey
          subject={q.subject}
          subjectEmoji={q.subjectEmoji}
          subjectImage={q.subjectImage}
          nodes={q.nodes}
          root={q.root}
          answers={response?.type === 'branchkey' ? response.answers : {}}
          onChange={(answers) => onRespond({ type: 'branchkey', answers })}
          labels={labels.branchKey ?? { yes: 'Yes', no: 'No', back: 'Back' }}
          reveal={
            reveal?.type === 'branchkey'
              ? { correct: reveal.correct, reached: reveal.reached, answer: reveal.answer }
              : undefined
          }
        />
      );
    case 'proofread':
      return (
        <ProofreadText
          tokens={q.tokens}
          fixes={response?.type === 'proofread' ? response.fixes : {}}
          onChange={(fixes) => onRespond({ type: 'proofread', fixes })}
          placeholder={labels.proofreadPlaceholder}
          reveal={
            reveal?.type === 'proofread'
              ? { marks: reveal.marks, errors: reveal.errors }
              : undefined
          }
        />
      );
    case 'solid':
      return (
        <SolidInspector
          shape={q.shape}
          task={q.task}
          labels={labels.solid}
          selected={response?.type === 'solid' ? response.selected : []}
          onChange={(selected) => onRespond({ type: 'solid', selected })}
          reveal={
            reveal?.type === 'solid'
              ? { correct: reveal.correct, expected: reveal.expected, count: reveal.count }
              : undefined
          }
        />
      );
    case 'chance':
      return (
        <ChanceScale
          levels={q.levels}
          items={q.items}
          assignment={response?.type === 'chance' ? response.assignment : {}}
          onChange={(assignment) => onRespond({ type: 'chance', assignment })}
          reveal={
            reveal?.type === 'chance' ? { items: reveal.items, answer: reveal.answer } : undefined
          }
        />
      );
    case 'speech':
      return (
        <SpeechRecorder
          text={q.text}
          maxSeconds={q.maxSeconds}
          recorded={response?.type === 'speech' ? response.recorded : false}
          durationMs={response?.type === 'speech' ? response.durationMs : undefined}
          onRecorded={(durationMs) => onRespond({ type: 'speech', recorded: true, durationMs })}
          onReset={() => onRespond({ type: 'speech', recorded: false })}
          disabled={checked}
          labels={
            labels.speech ?? {
              record: 'Record',
              stop: 'Stop',
              rerecord: 'Re-record',
              play: 'Play',
              recording: 'Recording…',
            }
          }
        />
      );
  }
}
