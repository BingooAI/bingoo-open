/**
 * @bingoo/explainer-web — React/SVG renderer + player for the explainer engine.
 *
 * `Player` plays a compiled ExplainerDoc (seekable, dual-aspect, captioned);
 * `Stage` renders a single RenderModel frame; `InteractiveManipulative` drives a
 * kit directly. Consumed by the end-user player (apps/web) and the studio editor
 * (apps/admin). Design tokens resolve through `theme`.
 */
export { ExplainerPlayer } from './player/ExplainerPlayer'
export { Stage } from './elements/Stage'
export { InteractiveManipulative } from './player/InteractiveManipulative'
export { usePlayer } from './player/usePlayer'
export * from './theme/tokens'

// Studio editor (data-dense) — mounted by apps/admin.
export { ExplainerStudio } from './editor/bingoo/ExplainerStudio'

// Default Vietnamese quiz labels for embedded activity beats (QuizShell is i18n-free).
export { VI_QUIZ_LABELS } from './player/gates/quizLabels'

// Chấm kit (re-export để admin dùng preview mà không cần thêm dep @bingoo/manipulatives trực tiếp).
export { checkAnswer } from '@bingoo/manipulatives'
