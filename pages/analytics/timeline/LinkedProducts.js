/**
 * External dependencies
 */
import React from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Linked Products chips for a Woo layer (Figma W11).
 *
 * Lists the products a Woo hotspot layer points at, so the panel names its
 * subjects before showing the metrics. Name and thumbnail come from the
 * `layer_metadata` the Woo player already emits with each event
 * (`product_name`, `product_image`), which is a snapshot from when the event
 * fired; no extra lookup is made against WooCommerce here.
 *
 * Chips carry no per-product metric on purpose. The sub-hotspot rail below is
 * where per-product performance lives, and the rail's per-sub conversion rate
 * is still subject to godam-analytics#196 (a sub inherits its parent's
 * full-range impressions), so duplicating a rate up here would spread a known
 * caveat across two places.
 *
 * Order follows the rail (best-performing first), and renders nothing when the
 * layer has no sub-hotspot rows for the range.
 *
 * @param {Object}   props
 * @param {Object[]} props.subHotspots Sub-hotspot entries from useVideoLayerData.
 * @return {JSX.Element|null} The chip row, or null when there are no products.
 */
const LinkedProducts = ( { subHotspots } ) => {
	const products = Array.isArray( subHotspots ) ? subHotspots : [];
	if ( products.length === 0 ) {
		return null;
	}

	return (
		<div className="px-6 pt-5" data-test-id="godam-layer-linked-products">
			<h4 className="text-sm font-semibold text-zinc-900 m-0">
				{ __( 'Linked Products', 'godam' ) }
			</h4>
			<ul className="m-0 mt-2 p-0 list-none flex flex-wrap gap-2">
				{ products.map( ( product ) => (
					<li
						key={ product.id }
						className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 min-w-0"
						style={ { opacity: product.isActive === false ? 0.55 : 1 } }
					>
						{ product.product_image ? (
							<img
								src={ product.product_image }
								alt=""
								width={ 24 }
								height={ 24 }
								className="rounded object-cover shrink-0"
								style={ { width: 24, height: 24 } }
							/>
						) : (
							<span
								className="rounded bg-zinc-100 shrink-0"
								style={ { width: 24, height: 24 } }
							/>
						) }
						<span
							className="text-xs text-zinc-700 truncate"
							style={ { maxWidth: 180 } }
							title={ product.name }
						>
							{ product.name }
						</span>
						{ product.isActive === false && (
							<span className="text-[10px] uppercase tracking-wide text-zinc-400 shrink-0">
								{ __( 'Removed', 'godam' ) }
							</span>
						) }
					</li>
				) ) }
			</ul>
		</div>
	);
};

export default LinkedProducts;
