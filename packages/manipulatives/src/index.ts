/**
 * @bingoo/manipulatives — public surface + kind registration.
 *
 * Importing this module registers every kit. Consumers (the explainer engine's
 * choreographer/frame, and other bingoo surfaces — games, practice, arena) all
 * import from here, so the registry is always populated before use.
 *
 * This package stands alone: it owns its render types (incl. a local `Aspect`),
 * verb baking, and the easing library — no dependency on the explainer engine.
 */
export * from './types'
export * from './bake'
export * from './registry'
export * from './interactions'
export * from './easing'
// `lerp`/`clamp01` are re-exported by util for kit-internal use only; exposing
// them again here would collide with engine/interpolate + engine/easing.
export { TOK, mapRange, addedItems, fmt } from './util'

import { registerManipulative } from './registry'
// batch 1 — general math kit
import { NumberLine } from './numberline'
import { Base10Block } from './base10'
import { Fraction } from './fraction'
import { ArrayArea } from './arrayarea'
import { BarModel } from './barmodel'
import { Graph } from './graph'
import { Expression } from './expression'
import { Clock } from './clock'
import { GeoShape } from './geoshape'
// batch 2 — Cambridge Primary coverage
import { TenFrame } from './tenframe'
import { PartWhole } from './partwhole'
import { PlaceValueChart } from './placevalue'
import { HundredSquare } from './hundredsquare'
import { FractionWall } from './fractionwall'
import { Money } from './money'
import { MeasureScale } from './measurescale'
import { DataChart } from './datachart'
import { ProbabilitySpinner } from './spinner'
import { Net3D } from './net3d'
import { CoordinateGrid } from './coordinategrid'
import { CountObjects } from './count'
import { ShareGroup } from './share'
import { EvenOdd } from './evenodd'
import { Estimate } from './estimate'
import { DataTable } from './table'
// batch 3 — Cambridge Primary English (literacy)
import { PhonicsBlocks } from './phonics'
import { WordBuilder } from './wordbuilder'
import { SyllableSplit } from './syllable'
import { WordClass } from './wordclass'
import { PunctuationFix } from './punctuation'
import { TenseTimeline } from './tense'
import { PrefixSuffix } from './morpheme'
import { StorySequence } from './story'
import { AlphabetArc } from './alphabet'
// batch 4 — Cambridge Primary Science
import { StatesOfMatter } from './states'
import { Circuit } from './circuit'
import { ForcesArrows } from './forces'
import { LifeCycle } from './lifecycle'
import { FoodChain } from './foodchain'
import { OrganismLabel } from './organism'
import { OrbitModel } from './orbit'
import { Thermometer } from './thermometer'
import { ShadowLight } from './shadow'
// batch 5 — early math (mầm non / đầu tiểu học)
import { PatternTrain } from './pattern'
import { Subitize } from './subitize'
import { CompareGroups } from './comparegroups'
import { OrdinalQueue } from './ordinal'
import { AdditionStory } from './addstory'
// batch 6 — secondary math (THCS / THPT)
import { IntegerChips } from './integerchips'
import { AlgebraTiles } from './algebratile'
import { EquationBalance } from './equationbalance'
import { FunctionMachine } from './functionmachine'
import { RatioTable } from './ratiotable'
import { FactorTree } from './factortree'
import { UnitCircle } from './unitcircle'
import { TriangleLab } from './trianglelab'
import { TransformGrid } from './transformgrid'
import { ProbabilityTree } from './probtree'
import { StatPlot } from './statplot'
import { CalculusGraph } from './calculusgraph'
// batch 7 — English: early learners → exam prep (IELTS/TOEFL/TOEIC) → professional
import { RhymeTime } from './rhymetime'
import { MinimalPair } from './minimalpair'
import { WordFormFamily } from './wordform'
import { ParaphrasePair } from './paraphrase'
import { EssayMap } from './essaymap'
import { DialogueFlow } from './dialogue'
import { WordStress } from './stresspattern'

export {
  NumberLine,
  Base10Block,
  Fraction,
  ArrayArea,
  BarModel,
  Graph,
  Expression,
  Clock,
  GeoShape,
  TenFrame,
  PartWhole,
  PlaceValueChart,
  HundredSquare,
  FractionWall,
  Money,
  MeasureScale,
  DataChart,
  ProbabilitySpinner,
  Net3D,
  CoordinateGrid,
  PhonicsBlocks,
  WordBuilder,
  SyllableSplit,
  WordClass,
  PunctuationFix,
  TenseTimeline,
  PrefixSuffix,
  StorySequence,
  AlphabetArc,
  StatesOfMatter,
  Circuit,
  ForcesArrows,
  LifeCycle,
  FoodChain,
  OrganismLabel,
  OrbitModel,
  Thermometer,
  ShadowLight,
  CountObjects,
  ShareGroup,
  EvenOdd,
  Estimate,
  DataTable,
  PatternTrain,
  Subitize,
  CompareGroups,
  OrdinalQueue,
  AdditionStory,
  IntegerChips,
  AlgebraTiles,
  EquationBalance,
  FunctionMachine,
  RatioTable,
  FactorTree,
  UnitCircle,
  TriangleLab,
  TransformGrid,
  ProbabilityTree,
  StatPlot,
  CalculusGraph,
  RhymeTime,
  MinimalPair,
  WordFormFamily,
  ParaphrasePair,
  EssayMap,
  DialogueFlow,
  WordStress,
}

/** All built-in manipulatives (batch 1 general · batch 2 Cambridge maths ·
 *  batch 3 Cambridge English · batch 4 Cambridge science · count objects ·
 *  batch 5 early math · batch 6 secondary math · batch 7 English early→exam→professional). */
export const MANIPULATIVES = [
  NumberLine,
  Base10Block,
  Fraction,
  ArrayArea,
  BarModel,
  Graph,
  Expression,
  Clock,
  GeoShape,
  TenFrame,
  PartWhole,
  PlaceValueChart,
  HundredSquare,
  FractionWall,
  Money,
  MeasureScale,
  DataChart,
  ProbabilitySpinner,
  Net3D,
  CoordinateGrid,
  PhonicsBlocks,
  WordBuilder,
  SyllableSplit,
  WordClass,
  PunctuationFix,
  TenseTimeline,
  PrefixSuffix,
  StorySequence,
  AlphabetArc,
  StatesOfMatter,
  Circuit,
  ForcesArrows,
  LifeCycle,
  FoodChain,
  OrganismLabel,
  OrbitModel,
  Thermometer,
  ShadowLight,
  CountObjects,
  ShareGroup,
  EvenOdd,
  Estimate,
  DataTable,
  PatternTrain,
  Subitize,
  CompareGroups,
  OrdinalQueue,
  AdditionStory,
  IntegerChips,
  AlgebraTiles,
  EquationBalance,
  FunctionMachine,
  RatioTable,
  FactorTree,
  UnitCircle,
  TriangleLab,
  TransformGrid,
  ProbabilityTree,
  StatPlot,
  CalculusGraph,
  RhymeTime,
  MinimalPair,
  WordFormFamily,
  ParaphrasePair,
  EssayMap,
  DialogueFlow,
  WordStress,
] as const

for (const m of MANIPULATIVES) registerManipulative(m)
export * from './verbdoc'
