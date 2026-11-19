/**
 * `react/jsx-runtime` for the admin pages, built on the React WordPress loads.
 *
 * Packages bundled from node_modules (such as `@wordpress/dataviews`) are
 * compiled with the automatic JSX runtime and import `react/jsx-runtime`.
 * Bundling that package inlines React's own element factory, so elements are
 * created by a different copy of React from the one rendering them, and
 * Plugin Check reports it (`inlined_react_jsx_runtime`). WordPress registers a
 * shared `react-jsx-runtime` script only from 6.6, and GoDAM supports 6.5, so
 * webpack resolves the import here instead: every element goes through
 * `createElement` of the externalized `React` global.
 *
 * `jsx( type, props, key )` passes the key outside `props`; `createElement`
 * reads it from the config, along with `ref`. Children go to `createElement`
 * as arguments, the way the classic transform passes them: `jsxs` marks
 * children written out in the source (static, so no keys needed), and passing
 * them as one array instead made React's development build warn about missing
 * keys on every such element.
 */

/**
 * External dependencies
 */
import { createElement, Fragment } from 'react';

/**
 * Split the runtime's props into the config `createElement` takes.
 *
 * @param {Object} props Props, including `children`.
 * @param {string} [key] Element key, passed separately by the runtime.
 *
 * @return {Object} Config without `children`, with `key` when given.
 */
function toConfig( props, key ) {
	const { children, ...config } = props; // eslint-disable-line no-unused-vars
	return undefined === key ? config : { ...config, key };
}

/**
 * Create an element with one child (or none), as the automatic runtime's `jsx`.
 * A child that is an array is a dynamic list, so React still checks its keys.
 *
 * @param {string|Function} type  Element type.
 * @param {Object}          props Props, including `children`.
 * @param {string}          [key] Element key.
 *
 * @return {Object} React element.
 */
function jsx( type, props, key ) {
	const config = toConfig( props, key );
	return 'children' in props ? createElement( type, config, props.children ) : createElement( type, config );
}

/**
 * Create an element with children written out in the source, as `jsxs`. They
 * are passed as separate arguments, so React treats them as static.
 *
 * @param {string|Function} type  Element type.
 * @param {Object}          props Props, with `children` as an array.
 * @param {string}          [key] Element key.
 *
 * @return {Object} React element.
 */
function jsxs( type, props, key ) {
	const config = toConfig( props, key );
	const children = Array.isArray( props.children ) ? props.children : [ props.children ];
	return createElement( type, config, ...children );
}

/**
 * The development runtime: `isStaticChildren` says which of the two applies.
 *
 * @param {string|Function} type             Element type.
 * @param {Object}          props            Props, including `children`.
 * @param {string}          [key]            Element key.
 * @param {boolean}         isStaticChildren Whether children were written out in the source.
 *
 * @return {Object} React element.
 */
function jsxDEV( type, props, key, isStaticChildren ) {
	return isStaticChildren ? jsxs( type, props, key ) : jsx( type, props, key );
}

export { Fragment, jsx, jsxs, jsxDEV };
