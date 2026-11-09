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
 * reads it from the config, along with `ref`, and keeps `props.children`.
 */

/**
 * External dependencies
 */
import { createElement, Fragment } from 'react';

/**
 * Creates an element the way the automatic JSX runtime does.
 *
 * @param {string|Function} type  Element type.
 * @param {Object}          props Props, including `children`.
 * @param {string}          [key] Element key, passed separately by the runtime.
 *
 * @return {Object} React element.
 */
function jsx( type, props, key ) {
	return createElement( type, undefined === key ? props : { ...props, key } );
}

export { Fragment, jsx, jsx as jsxs, jsx as jsxDEV };
