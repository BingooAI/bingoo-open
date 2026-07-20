/**
 * @bingoo/explainer — public surface of the platform-agnostic engine.
 * Pure TS; imports nothing platform-specific (spec §7.1). The web renderer,
 * the editor, and (later) the RN Skia player all import from here.
 *
 * Manipulative kits live in the standalone `@bingoo/manipulatives` package
 * (reusable beyond the explainer); import them from there directly. This engine
 * owns the doc schema, layout, choreography, runtime, frame and lint.
 */
export * from './schema';
export * from './interpolate';
export * from './layout';
export * from './choreographer';
export * from './runtime';
export * from './frame';
export * from './lint';
export * from './props';
export * from './brief';
export * from './type';
export * from './catalog';
export * from './authoring';
export * from './examples';
export * from './prompt';
export * from './arc';
export * from './reference';
export * from './quizdoc';
export * from './sfx-catalog';
