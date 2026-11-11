/**
 * Layer API constants (RFC: docs/rfcs/layer-api.md).
 */

/**
 * Name of the `@wordpress/data` store that holds registered layer types.
 */
export const STORE_NAME = 'godam/layers';

/**
 * Layer types GoDAM ships. They keep their historic, un-namespaced names; every
 * other layer type must be namespaced (`vendor/name`).
 */
export const CORE_LAYER_TYPES = [ 'cta', 'hotspot', 'form', 'poll', 'ad' ];

/**
 * Keys GoDAM manages on every layer. A layer type can't declare them.
 */
export const MANAGED_KEYS = [ 'id', 'type', 'name', 'displayTime' ];

/**
 * Keys whose schema GoDAM owns. A layer type may give one its own `default`,
 * but can't change its `type` or `format`.
 */
export const SHARED_KEYS = [ 'duration', 'allow_skip', 'custom_css', 'trigger', 'watchDepth' ];

/**
 * Default `supports` for a layer type.
 */
export const DEFAULT_SUPPORTS = {
	media: [ 'video' ],
	timeline: true,
	duplicate: true,
	skip: false,
	rawHtml: false,
};

/**
 * Un-namespaced add-on layer types saved before the Layer API existed. They may
 * keep their name (renaming would orphan saved layers); new types need a namespace.
 */
export const LEGACY_LAYER_TYPE_NAMES = [ 'woo' ];

export const NAME_PATTERN = /^[a-z0-9-]+\/[a-z0-9-]+$/;
