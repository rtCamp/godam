/**
 * External dependencies
 */
import React, { useEffect, useMemo, useState } from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import SingleLayerAnalyticsList from './SingleLayerAnalyticsList.js';

/**
 * Built-in tabs registered by the core plugin. Add-ons (godam-for-woo) can
 * append more via window.GoDAM.registerLayerTab({ id, label, component })
 * — see analytics.js for the registry. The default component (when an
 * add-on doesn't supply one) is SingleLayerAnalyticsList, which renders
 * any layer_type by talking to /processed-layer-analytics/.
 */
const BUILTIN_TABS = [
	{ id: 'cta', label: __( 'CTA', 'godam' ) },
	{ id: 'form', label: __( 'Form', 'godam' ) },
	{ id: 'hotspot', label: __( 'Hotspot', 'godam' ) },
];

/**
 * Read the extension-registered tabs from the global registry.
 *
 * The registry is a plain array on window.GoDAM.layerAnalyticsTabs —
 * add-ons push into it before this component mounts. We snapshot at
 * mount time so a late-loading add-on doesn't reorder tabs mid-render;
 * the user can refresh to pick up newly-installed add-ons.
 *
 * @return {Array<{id: string, label: string, component: Function|null}>} Sanitized, shape-checked tab descriptors.
 */
function readRegisteredTabs() {
	const reg = window.GoDAM && Array.isArray( window.GoDAM.layerAnalyticsTabs )
		? window.GoDAM.layerAnalyticsTabs
		: [];
	// Defensive copy + shape check.
	return reg
		.filter( ( t ) => t && typeof t.id === 'string' && typeof t.label === 'string' )
		.map( ( t ) => ( {
			id: t.id,
			label: t.label,
			component: typeof t.component === 'function' ? t.component : null,
		} ) );
}

/**
 * InteractiveLayerAnalytics
 *
 * Top-level "Interactive Layer Performance" section on the single-video
 * analytics page. Tab container (CTA / Form / Hotspot + any add-on tabs)
 * with a shared date-range selector. Built so godam-for-woo (and any
 * future add-on) can register a "Woo Hotspot" tab via
 * window.GoDAM.registerLayerTab without touching this file.
 *
 * @param {Object}        props
 * @param {number|string} props.attachmentID WP attachment ID of the video.
 * @return {JSX.Element} The container element with tabs, date selector, and active tab content.
 */
const InteractiveLayerAnalytics = ( { attachmentID } ) => {
	const [ dateRange, setDateRange ] = useState( '7d' );

	const tabs = useMemo( () => {
		const registered = readRegisteredTabs();
		// Built-in first, then add-on tabs in registration order. Add-ons
		// can't override built-in ids (filtered by id collision).
		const builtinIds = new Set( BUILTIN_TABS.map( ( t ) => t.id ) );
		return [
			...BUILTIN_TABS,
			...registered.filter( ( t ) => ! builtinIds.has( t.id ) ),
		];
	}, [] );

	const [ activeTabId, setActiveTabId ] = useState( tabs[ 0 ]?.id || 'cta' );

	// If the active tab disappears (e.g. add-on deactivated mid-session),
	// fall back to the first available tab.
	useEffect( () => {
		if ( ! tabs.some( ( t ) => t.id === activeTabId ) ) {
			setActiveTabId( tabs[ 0 ]?.id || 'cta' );
		}
	}, [ tabs, activeTabId ] );

	const activeTab = tabs.find( ( t ) => t.id === activeTabId ) || tabs[ 0 ];

	if ( ! activeTab ) {
		return null;
	}

	// Use the add-on-supplied component when present, otherwise the
	// default SingleLayerAnalyticsList (which handles any layer_type).
	const TabComponent = activeTab.component || SingleLayerAnalyticsList;

	return (
		<div className="mx-10 my-6 bg-white border border-zinc-200 rounded-lg">
			<div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-6 pb-2">
				<h3 className="text-base font-semibold m-0">
					{ __( 'Interactive Layer Performance', 'godam' ) }
				</h3>

				<div className="flex items-center gap-3">
					{ /* Tabs */ }
					<div className="flex flex-wrap gap-2">
						{ tabs.map( ( tab ) => (
							<button
								key={ tab.id }
								type="button"
								onClick={ () => setActiveTabId( tab.id ) }
								className={ `px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer border ${
									activeTabId === tab.id
										? 'bg-[#AB3A6C1A] text-[#AB3A6C] border-transparent'
										: 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
								}` }
							>
								{ tab.label }
							</button>
						) ) }
					</div>

					{ /* Date range filter */ }
					<div className="px-3 py-1 rounded-md border border-zinc-200">
						<select
							value={ dateRange }
							onChange={ ( e ) => setDateRange( e.target.value ) }
							className="border-none bg-transparent text-sm focus:outline-none"
							aria-label={ __( 'Date range', 'godam' ) }
						>
							<option value="7d">{ __( 'Last 7 days', 'godam' ) }</option>
							<option value="30d">{ __( 'Last 30 days', 'godam' ) }</option>
							<option value="60d">{ __( 'Last 60 days', 'godam' ) }</option>
							<option value="1y">{ __( 'Last Year', 'godam' ) }</option>
						</select>
					</div>
				</div>
			</div>

			<TabComponent
				activeTab={ activeTab.id }
				dateRange={ dateRange }
				attachmentID={ attachmentID }
			/>
		</div>
	);
};

export default InteractiveLayerAnalytics;
