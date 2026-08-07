/**
 * External dependencies
 */
import React from 'react';

/**
 * Internal dependencies
 */
import InfoTooltip from './InfoTooltip';
import TrendBadge from './TrendBadge';

/**
 * Format a resolved KPI value for display.
 *
 * Rates get one decimal and a % sign; counts get full numbers with thousands
 * separators (no 1.2K abbreviation and no hover-to-reveal, per the 2.0 number
 * treatment). A null value means "not knowable for this range" and renders an
 * em-less dash rather than 0, so an unknown never reads as a measured zero.
 *
 * @param {Object}      tile       Resolved tile.
 * @param {string}      tile.kind  'rate' | 'count' | 'reachRate'.
 * @param {number|null} tile.value Resolved value.
 * @return {string} Display string.
 */
export function formatKpiValue( { kind, value } ) {
	if ( value === null || value === undefined || ! Number.isFinite( Number( value ) ) ) {
		return '-';
	}
	const num = Number( value );
	if ( kind === 'count' ) {
		return num.toLocaleString();
	}
	return `${ +num.toFixed( 1 ) }%`;
}

/**
 * One tile. The primary variant spans the full width and carries the trend
 * badge; secondary tiles sit side by side beneath it.
 *
 * @param {Object}      props
 * @param {Object}      props.tile       Resolved tile from buildLayerKpis.
 * @param {boolean}     [props.primary]  Render as the wide primary tile.
 * @param {number|null} [props.delta]    Percentage change, primary only.
 * @param {number|null} [props.spanDays] Length of the compared window.
 * @return {JSX.Element} The tile.
 */
const KpiTile = ( { tile, primary = false, delta = null, spanDays = null } ) => (
	<div
		className={ `rounded-lg border border-zinc-200 bg-white px-4 py-3 ${
			primary ? 'w-full' : ''
		}` }
		data-test-id={ `godam-layer-kpi-${ tile.id }` }
	>
		<div className="flex items-center gap-1">
			<span className="text-xs text-zinc-500">{ tile.label }</span>
			{ tile.tooltip && <InfoTooltip size={ 13 } text={ tile.tooltip } /> }
		</div>
		<div
			className={ `mt-0.5 font-semibold text-zinc-900 tabular-nums ${
				primary ? 'text-2xl' : 'text-lg'
			}` }
		>
			{ formatKpiValue( tile ) }
		</div>
		{ primary && (
			<TrendBadge
				delta={ delta }
				spanDays={ spanDays }
				testId={ `godam-layer-kpi-${ tile.id }-trend` }
			/>
		) }
	</div>
);

/**
 * KPI tiles for the layer detail panel (Figma W7–W11): one wide headline tile
 * with a period-over-period badge, and two supporting tiles below it.
 *
 * Composition per layer type comes from LAYER_KPI_SPEC, so this component never
 * branches on `layer_type`.
 *
 * @param {Object}      props
 * @param {Object}      props.kpis           Result of buildLayerKpis().
 * @param {number|null} [props.primaryDelta] Change in the primary metric vs the previous window.
 * @param {number|null} [props.spanDays]     Length of the compared window.
 * @return {JSX.Element|null} The tile grid, or null without KPIs.
 */
const LayerKpiTiles = ( { kpis, primaryDelta = null, spanDays = null } ) => {
	if ( ! kpis ) {
		return null;
	}

	return (
		<div className="flex flex-col gap-3" data-test-id="godam-layer-kpi-tiles">
			<KpiTile
				tile={ kpis.primary }
				primary
				delta={ primaryDelta }
				spanDays={ spanDays }
			/>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				{ kpis.secondary.map( ( tile ) => (
					<KpiTile key={ tile.id } tile={ tile } />
				) ) }
			</div>
		</div>
	);
};

export default LayerKpiTiles;
export { KpiTile };
