/**
 * Bingoo UI — web component library public API (@bingoo.ai/ui-web).
 * Primitives built on shared tokens; import from '@bingoo.ai/ui-web' anywhere.
 */
export { cn } from './lib/cn'
export { PackScope, type PackScopeProps, type StylePack, type AccentPack } from './pack-scope'
export { ThemeWorldScope, THEME_WORLDS, type ThemeWorld, type ThemeWorldScopeProps } from './theme-world'
export { Button, buttonVariants, type ButtonProps } from './button'
export { Input, type InputProps } from './input'
export { PasswordInput } from './password-input'
export { Textarea, type TextareaProps } from './textarea'
export { Label, type LabelProps } from './label'
export { Field, type FieldProps } from './field'
export { Checkbox, type CheckboxProps } from './checkbox'
export { Switch, type SwitchProps } from './switch'
export { Select, type SelectProps } from './select'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, type CardProps } from './card'
export { Badge, type BadgeProps, type BadgeColor, type BadgeTone } from './badge'
export { Avatar, type AvatarProps } from './avatar'
export { IconChip, type IconChipProps, type IconChipColor } from './icon-chip'
export { StatCard, type StatCardProps } from './stat-card'

export { Progress, type ProgressProps } from './progress'
export { ProgressRing, type ProgressRingProps } from './progress-ring'

export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'
export { OptionCard, type OptionCardProps } from './option-card'
export { SegmentedControl, type SegmentOption, type SegmentedControlProps } from './segmented-control'

export { Separator, Skeleton, Container, Section } from './misc'

// Overlays (React Aria Components, skinned).
export { Dialog, AlertDialog, type DialogProps } from './dialog'
export { Tooltip, type TooltipProps } from './tooltip'
export { Popover, type PopoverProps } from './popover'
export { Menu, type MenuProps, type MenuOption } from './menu'
export { Sheet, type SheetProps } from './sheet'
export { ToastProvider, useToast, type ToastInput, type ToastVariant } from './toast'

// Input & navigation (P2).
export { RadioGroup, type RadioGroupProps, type RadioOption } from './radio-group'
export { Slider, type SliderProps } from './slider'
export { Combobox, type ComboboxProps, type ComboboxOption } from './combobox'
export { Rating, type RatingProps } from './rating'
export { Breadcrumbs, type BreadcrumbsProps, type Crumb } from './breadcrumbs'
export { Pagination, type PaginationProps } from './pagination'
export { Accordion, type AccordionProps, type AccordionItemData } from './accordion'

// Data display (P3).
export { Table, THead, TBody, TR, TH, TD } from './table'
export { DescriptionList, type DescriptionListProps } from './description-list'
export { Timeline, type TimelineProps, type TimelineItemData } from './timeline'
export { Callout, type CalloutProps, type CalloutVariant } from './callout'
export { EmptyState, type EmptyStateProps } from './empty-state'
export { Tag, type TagProps, type TagColor } from './tag'
export { Spinner, type SpinnerProps } from './spinner'
export { Meter, type MeterProps } from './meter'
export { AvatarGroup, type AvatarGroupProps } from './avatar-group'

// Learning domain (P4).
export { XPBar, type XPBarProps } from './xp-bar'
export { StreakBadge, type StreakBadgeProps } from './streak-badge'
export { BadgeTile, type BadgeTileProps } from './badge-tile'
export { SubjectCard, type SubjectCardProps } from './subject-card'
export { LessonCard, type LessonCardProps } from './lesson-card'
export { Leaderboard, type LeaderboardProps, type LeaderboardEntry } from './leaderboard'
export { AnswerOption, type AnswerOptionProps, type AnswerState } from './answer-option'
export { LearningPath, type LearningPathProps, type PathNode, type PathStatus } from './learning-path'

// Quiz interaction core (P4) — the 6 question types + orchestrator. Grading and
// session flow live in @bingoo.ai/core, so a native renderer could share them.
export { ChoiceList, TrueFalse, type ChoiceListProps, type TrueFalseProps, type Choice } from './quiz-choice'
export { FillBlank, type FillBlankProps } from './fill-blank'
export { OrderList, type OrderListProps, type OrderItem } from './order-list'
export { MatchPairs, type MatchPairsProps, type MatchItem } from './match-pairs'
export { HintReveal, type HintRevealProps } from './hint-reveal'
export { ExplanationCard, type ExplanationCardProps } from './explanation-card'
export { QuizProgress, type QuizProgressProps, type QuizSegmentStatus } from './quiz-progress'
export { ResultScreen, type ResultScreenProps, type ResultLabels } from './result-screen'
export { QuizShell, type QuizShellProps, type QuizLabels } from './quiz-shell'
export { QuestionMedia, type QuestionMediaProps } from './quiz-media'
export { AssistBlock, type AssistBlockProps } from './assist-block'

// Learning Experience pack (@bingoo.ai/learning-experience) — 5-axis experience UI.
export {
  LearningExperienceCard,
  type LearningExperienceCardProps,
  LearningExperienceBadge,
  type LearningExperienceBadgeProps,
  type LearningExperienceLabels,
  axisValueLabel,
} from './learning-experience-card'
export { LearningExperiencePicker, type LearningExperiencePickerProps } from './learning-experience-picker'
export { LearningExperienceShell, type LearningExperienceShellProps } from './learning-experience-shell'

// Preschool canvas (tracing / coloring / free drawing) — geometry, stroke
// scoring and SVG export live in @bingoo.ai/core, platform-free by design.
export { ColorPalette, type ColorPaletteProps } from './color-palette'
export { DrawingCanvas, type DrawingCanvasProps } from './drawing-canvas'
export { TracingBoard, type TracingBoardProps } from './tracing-board'
export { ColoringBoard, type ColoringBoardProps } from './coloring-board'
export { NumericAnswer, type NumericAnswerProps } from './numeric-answer'
export { WordBank, type WordBankProps } from './word-bank'
export { CategorizeBoard, type CategorizeBoardProps } from './categorize-board'
export { HighlightText, type HighlightTextProps } from './highlight-text'
export { NumberLineInput, type NumberLineInputProps } from './number-line-input'
export { ClockInput, type ClockInputProps } from './clock-input'
export { VennBoard, type VennBoardProps } from './venn-board'
export { TableFill, type TableFillProps } from './table-fill'
export { TenFrameInput, type TenFrameInputProps } from './ten-frame-input'
export { PartWholeInput, type PartWholeInputProps } from './part-whole-input'
export { PlaceValueInput, type PlaceValueInputProps } from './place-value-input'
export { PatternInput, type PatternInputProps } from './pattern-input'
export { LabelDiagram, type LabelDiagramProps } from './label-diagram'
export { HotspotFind, type HotspotFindProps } from './hotspot-find'
export { ArrowInput, type ArrowInputProps } from './arrow-input'
export { WordSearch, type WordSearchProps } from './word-search'
export { FractionBar, type FractionBarProps } from './fraction-bar'
export { CarrollGrid, type CarrollGridProps } from './carroll-grid'
export { MoneyTray, type MoneyTrayProps } from './money-tray'
export { BalanceScale, type BalanceScaleProps, type BalanceChoice } from './balance-scale'
export { BarChartBuilder, type BarChartBuilderProps } from './bar-chart-builder'
export { RulerMeasure, type RulerMeasureProps } from './ruler-measure'
export { SymmetryGrid, type SymmetryGridProps } from './symmetry-grid'
export { AnnotateImage, type AnnotateImageProps } from './annotate-image'
export { TallyChart, type TallyChartProps } from './tally-chart'
export { PictogramChart, type PictogramChartProps } from './pictogram-chart'
export { ArrayBuilder, type ArrayBuilderProps } from './array-builder'
export { RotationDial, type RotationDialProps } from './rotation-dial'
export { ScaleReader, type ScaleReaderProps } from './scale-reader'
export { DigitalClock, type DigitalClockProps } from './digital-clock'
export { RouteGrid, type RouteGridProps } from './route-grid'
export { CrosswordGrid, type CrosswordGridProps } from './crossword-grid'
export { SelfAssessment, type SelfAssessmentProps, type SelfAssessmentLevel } from './self-assessment'
export { LearningGoals, type LearningGoalsProps } from './learning-goals'
export { MathField, type MathFieldProps, type MathLevel } from './math-field'
export { SpeechRecorder, type SpeechRecorderProps, type SpeechLabels } from './speech-recorder'
export { ChanceScale, type ChanceScaleProps, type ChanceLevel } from './chance-scale'
export { GridShapeBoard, type GridShapeBoardProps, type GridShapeTarget } from './grid-shape-board'
export { SpinnerWheel, type SpinnerWheelProps, type SpinnerSegment } from './spinner-wheel'
export {
  GeoShape,
  type GeoShapeProps,
  type GeoShapePart,
  type Shape2DName,
  type Shape3DName,
} from './geo-shape'
export { SolidInspector, type SolidInspectorProps } from './solid-inspector'
export { BranchKey, type BranchKeyProps, type BranchKeyLabels } from './branch-key'
export { ProofreadText, type ProofreadTextProps } from './proofread-text'
export { CoordinateGrid, type CoordinateGridProps, type CoordValue } from './coordinate-grid'
export { AngleTool, type AngleToolProps, type AngleLabels } from './angle-tool'
export { LineGraph, type LineGraphProps } from './line-graph'
export { TranslationGrid, type TranslationGridProps } from './translation-grid'
export { CompassRose, type CompassRoseProps, type CompassPlace } from './compass-rose'
export { StemView, type StemViewProps } from './stem-view'
export { NetPicker, NetShape, type NetPickerProps } from './net-picker'
export { RubricList, type RubricListProps } from './rubric-list'
export { DrawingPad, type DrawingPadProps, type DrawingLabels } from './drawing-pad'
export { WritingPad, type WritingPadProps, type WritingLabels } from './writing-pad'
export { EstimateStep, type EstimateStepProps, type EstimateLabels } from './estimate-step'
export { VocabularyList, type VocabularyListProps, type VocabularyWord } from './vocabulary-list'
export { DialogueBubbles, type DialogueBubblesProps, type DialogueTurn } from './dialogue-bubbles'
export { ReadingPassage, type ReadingPassageProps } from './reading-passage'
export { ReflectionPrompt, type ReflectionPromptProps, type ConfidenceFace } from './reflection-prompt'
export { DiscussPrompt, type DiscussPromptProps } from './discuss-prompt'
export { LyricsSheet, type LyricsSheetProps, type LyricLine } from './lyrics-sheet'
export { WaffleGrid, type WaffleGridProps, type WaffleCategory } from './waffle-grid'
export { ExperimentFlow, type ExperimentFlowProps, type ExperimentHypothesis } from './experiment-flow'
export {
  LessonPlayer,
  type LessonPlayerProps,
  type LessonSection,
  type LessonSectionKind,
} from './lesson-player'
export { WorkedExample, type WorkedExampleProps } from './worked-example'

// Gamification & rewards (Batch A) — reused across lesson / game / feed / arena.
// XP/streak/reward math lives in @bingoo.ai/core, platform-free by design.
export { hudSurfaceClass } from './lib/hud'
export {
  Confetti,
  type ConfettiProps,
  CelebrationOverlay,
  type CelebrationOverlayProps,
  RewardCelebration,
  type RewardCelebrationProps,
} from './celebration'
export { LevelUpModal, type LevelUpModalProps } from './level-up-modal'
export { BadgeUnlockModal, type BadgeUnlockModalProps } from './badge-unlock-modal'
export { BadgeGrid, type BadgeGridProps, type BadgeGridItem } from './badge-grid'
export { DailyGoalRing, type DailyGoalRingProps } from './daily-goal-ring'
export { StreakCalendar, type StreakCalendarProps } from './streak-calendar'
export { CoinCounter, type CoinCounterProps } from './coin-counter'
export { ComboMeter, type ComboMeterProps } from './combo-meter'
export { MissionCard, type MissionCardProps } from './mission-card'
export { LeagueTier, type LeagueTierProps } from './league-tier'
export { CountdownTimer, type CountdownTimerProps, type CountdownLabels } from './countdown-timer'
export { MascotMessage, type MascotMessageProps } from './mascot-message'
export { SoundButton, type SoundButtonProps } from './sound-button'
export { AchievementToast, type AchievementToastProps } from './achievement-toast'

// Content & lessons (Batch B) — render the shared, LLM-authorable content schema
// from @bingoo.ai/core (ContentBlock / Flashcard / Course / SRS). Reused across
// lesson / game / feed / arena.
export { ContentBlocks, type ContentBlocksProps, type InteractiveBlock } from './content-blocks'
export {
  Flashcard,
  type FlashcardProps,
  FlashcardDeck,
  type FlashcardDeckProps,
  type FlashcardDeckLabels,
  type DeckCard,
} from './flashcard'
export { TermCard, type TermCardProps } from './term-card'
export { ReadingPane, type ReadingPaneProps } from './reading-pane'
export { LessonHeader, type LessonHeaderProps } from './lesson-header'
export { ResourceCard, type ResourceCardProps } from './resource-card'
export { VideoLessonShell, type VideoLessonShellProps } from './video-lesson-shell'
export { AudioPlayer, type AudioPlayerProps } from './audio-player'
export { StepLesson, type StepLessonProps } from './step-lesson'
export { CourseOutline, type CourseOutlineProps } from './course-outline'
export { CodePlayground, type CodePlaygroundProps } from './code-playground'

// Role surfaces (Batch C) — parent / teacher / community. Runtime data via props
// (i18n-free); schedule layout math lives in @bingoo.ai/core.
export { ChildCard, type ChildCardProps } from './child-card'
export { ClassCard, type ClassCardProps } from './class-card'
export {
  StudentRoster,
  type StudentRosterProps,
  type RosterStudent,
  type StudentStatus,
} from './student-roster'
export { ScheduleCalendar, type ScheduleCalendarProps, type CalendarSlot } from './schedule-calendar'
export { ActivityFeedItem, type ActivityFeedItemProps } from './activity-feed-item'
export { CommunityPostCard, type CommunityPostCardProps } from './community-post-card'
export { CommentThread, type CommentThreadProps, type CommentData } from './comment-thread'
export { NotificationItem, type NotificationItemProps } from './notification-item'

// Page-level patterns (composites).
export {
  PageHeader,
  type PageHeaderProps,
  SectionHeader,
  type SectionHeaderProps,
  Toolbar,
  StatGrid,
  type StatGridProps,
  DashboardWidget,
  type DashboardWidgetProps,
  ErrorState,
  type ErrorStateProps,
  LoadingScreen,
  type LoadingScreenProps,
  Stepper,
  type StepperProps,
  type StepperStep,
} from './patterns'

// Charts (SVG, token-driven) — P5.
export {
  Sparkline,
  type SparklineProps,
  AreaChart,
  type AreaChartProps,
  BarChart,
  type BarChartProps,
  DonutChart,
  type DonutChartProps,
  type DonutSegment,
  RadarChart,
  type RadarChartProps,
  type XYPoint,
  type ChartColor,
} from './charts'

// Form system (react-hook-form + zod).
export { useZodForm, Controller } from './form'
