/**
 * External dependencies
 */
import React from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import InfoTooltip from './InfoTooltip';

/**
 * Shade for the bar at position `idx` of `count` bars. Same monochrome
 * admin-theme ramp the interaction funnel uses, so the two charts in one panel
 * read as one system.
 *
 * @param {number} idx   Bar position (0-based).
 * @param {number} count Total bars.
 * @return {string} A `color-mix()` value usable as a CSS background.
 */
function barShade( idx, count ) {
	const t = count > 1 ? idx / ( count - 1 ) : 0;
	const mix = Math.round( 100 - ( t * 70 ) );
	return `color-mix(in srgb, var(--wp-admin-theme-color, #ab3a6c) ${ mix }%, white)`;
}

/**
 * Answer Distribution for a Poll layer (Figma W10).
 *
 * The votes belong to the WP Polls plugin, which owns the answers and their
 * tallies. GoDAM's own `voted` event records that a vote happened but not which
 * answer was chosen, so this distribution is necessarily **poll-wide**: it
 * covers every vote on that poll from anywhere on the site, and it cannot be
 * scoped to this video or to the panel's date range. The caption says so
 * rather than letting the placement imply otherwise.
 *
 * Renders nothing when the poll has no answers, when wp-polls is inactive (the
 * REST route 404s and the caller passes no answers), or when the layer carries
 * no poll id. Scoping this properly would need the player to emit the chosen
 * answer, which is new ingestion and forward-only.
 *
 * @param {Object}   props
 * @param {Object[]} props.answers      `[{ answer, votes }]` from the poll results route.
 * @param {number}   [props.totalVotes] Total votes across answers.
 * @param {boolean}  [props.isLoading]  Request in flight.
 * @return {JSX.Element|null} The distribution, or null when there is nothing to show.
 */
const PollAnswerDistribution = ( { answers, totalVotes = 0, isLoading = false } ) => {
	if ( isLoading ) {
		return (
			<div className="mt-4" data-test-id="godam-layer-poll-distribution-loading">
				<div className="h-4 w-40 rounded bg-zinc-100" />
				<div className="mt-3 flex flex-col gap-2">
					<div className="h-7 rounded bg-zinc-100" />
					<div className="h-7 rounded bg-zinc-100" />
				</div>
			</div>
		);
	}

	const rows = Array.isArray( answers ) ? answers : [];
	if ( rows.length === 0 ) {
		return null;
	}

	// Bars are scaled to the most-voted answer so the shape of the distribution
	// stays readable when every option polls low.
	const max = rows.reduce( ( acc, row ) => Math.max( acc, Number( row.votes ) || 0 ), 0 );

	return (
		<div className="mt-4" data-test-id="godam-layer-poll-distribution">
			<div className="flex items-center gap-1">
				<h4 className="text-sm font-semibold text-zinc-900 m-0">
					{ __( 'Answer Distribution', 'godam' ) }
				</h4>
				<InfoTooltip
					size={ 13 }
					text={ __(
						'Vote tallies come from the WP Polls plugin, which stores them per poll. They cover every vote on this poll across your site, so they are not limited to this video or to the selected date range.',
						'godam',
					) }
				/>
			</div>

			<ul className="m-0 mt-2 p-0 list-none rounded-lg border border-zinc-200 divide-y divide-zinc-100">
				{ rows.map( ( row, idx ) => {
					const votes = Number( row.votes ) || 0;
					const width = max > 0 ? ( votes / max ) * 100 : 0;
					return (
						<li
							key={ row.id ?? `${ row.answer }-${ idx }` }
							className="flex items-center gap-3 px-3 py-2"
						>
							<span
								className="text-xs text-zinc-600 shrink-0 truncate"
								style={ { maxWidth: 140 } }
								title={ row.answer }
							>
								{ row.answer }
							</span>
							<span className="flex-1 h-6 rounded bg-zinc-50 overflow-hidden">
								<span
									className="block h-full rounded"
									style={ {
										width: `${ width }%`,
										background: barShade( idx, rows.length ),
										transition: 'width 160ms ease-out',
									} }
								/>
							</span>
							<span className="text-xs font-medium text-zinc-900 tabular-nums shrink-0">
								{ votes.toLocaleString() }
							</span>
						</li>
					);
				} ) }
			</ul>

			<p className="text-[11px] text-zinc-400 m-0 mt-1.5">
				{ __( 'Poll-wide totals from WP Polls, all videos and all dates.', 'godam' ) }
				{ totalVotes > 0 && ` ${ totalVotes.toLocaleString() } ${ __( 'votes', 'godam' ) }.` }
			</p>
		</div>
	);
};

export default PollAnswerDistribution;
export { barShade };
